/**
 * MP4 keyframe analyser — flat recursive box walker.
 * Uses absolute file offsets throughout; no slice/copy.
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const raw   = readFileSync(join(__dir, '../public/city.mp4'))
const dv    = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
const size  = raw.byteLength

// ── Primitives ───────────────────────────────────────────────────────────────
const u8  = (o) => dv.getUint8(o)
const u32 = (o) => dv.getUint32(o)
const u64 = (o) => dv.getBigUint64(o)
const str = (o) => String.fromCharCode(u8(o),u8(o+1),u8(o+2),u8(o+3))

// ── Walk boxes at [start, end) calling cb(type, dataStart, dataLen) ─────────
function walk(start, end, cb) {
  let o = start
  while (o + 8 <= end) {
    let boxSize = u32(o)
    const boxType = str(o + 4)
    let headerLen = 8

    if (boxSize === 1) {                          // 64-bit size
      boxSize = Number(u64(o + 8))
      headerLen = 16
    } else if (boxSize === 0) {                   // box extends to EOF
      boxSize = end - o
    }
    if (boxSize < headerLen || o + boxSize > end + 1) break

    cb(boxType, o + headerLen, boxSize - headerLen)
    o += boxSize
  }
}

// ── Find first box of given type at depth-1 inside parent ────────────────────
function findOne(parentDataStart, parentDataLen, type) {
  let result = null
  walk(parentDataStart, parentDataStart + parentDataLen, (t, ds, dl) => {
    if (!result && t === type) result = { ds, dl }
  })
  return result
}

// ── Find all boxes of given type at depth-1 ──────────────────────────────────
function findAll(parentDataStart, parentDataLen, type) {
  const results = []
  walk(parentDataStart, parentDataStart + parentDataLen, (t, ds, dl) => {
    if (t === type) results.push({ ds, dl })
  })
  return results
}

// ── Full-box helpers (skip version+flags = 4 bytes) ──────────────────────────
const fbData = (ds) => ds + 4          // full-box: data starts after version(1)+flags(3)

// ── Top-level ────────────────────────────────────────────────────────────────
const moov = findOne(0, size, 'moov')
if (!moov) { console.error('No moov box'); process.exit(1) }

// mvhd
const mvhd = findOne(moov.ds, moov.dl, 'mvhd')
let movieTimescale = 1000, movieDurationS = 0
if (mvhd) {
  const ver = u8(mvhd.ds)
  if (ver === 0) {
    movieTimescale    = u32(mvhd.ds + 12)
    const durTicks    = u32(mvhd.ds + 16)
    movieDurationS    = durTicks / movieTimescale
  } else {
    movieTimescale    = u32(mvhd.ds + 20)
    const durTicks    = Number(u64(mvhd.ds + 24))
    movieDurationS    = durTicks / movieTimescale
  }
}
console.log(`\n── Movie ────────────────────────────────────────────`)
console.log(`Duration : ${movieDurationS.toFixed(3)} s`)
console.log(`Timescale: ${movieTimescale} ticks/s`)

// ── Walk all trak boxes ───────────────────────────────────────────────────────
const traks = findAll(moov.ds, moov.dl, 'trak')
console.log(`Tracks found: ${traks.length}`)

for (const trak of traks) {
  const mdia = findOne(trak.ds, trak.dl, 'mdia')
  if (!mdia) continue

  // hdlr — check handler type
  const hdlr = findOne(mdia.ds, mdia.dl, 'hdlr')
  if (!hdlr) continue
  // handler_type is at full-box offset +4 (pre_defined) then 4 bytes type
  const handlerType = str(hdlr.ds + 8)   // version(1)+flags(3)+pre_defined(4) = 8
  if (handlerType !== 'vide') continue
  console.log(`\n── Video track ──────────────────────────────────────`)

  // mdhd — media timescale
  const mdhd = findOne(mdia.ds, mdia.dl, 'mdhd')
  let mediaTimescale = movieTimescale
  if (mdhd) {
    const ver = u8(mdhd.ds)
    mediaTimescale = ver === 0 ? u32(mdhd.ds + 12) : u32(mdhd.ds + 20)
  }
  console.log(`Media timescale: ${mediaTimescale} ticks/s`)

  // stbl
  const minf = findOne(mdia.ds, mdia.dl, 'minf')
  if (!minf) { console.log('No minf'); continue }
  const stbl = findOne(minf.ds, minf.dl, 'stbl')
  if (!stbl) { console.log('No stbl'); continue }

  // ── stsd: sample description (codec) ─────────────────────────────────────
  const stsd = findOne(stbl.ds, stbl.dl, 'stsd')
  if (stsd) {
    // entry count at fbData+0, first entry type at fbData+4+4 = fbData+8
    const entryType = str(stsd.ds + 12)  // version(1)+flags(3)+entry_count(4)+size(4)+type
    console.log(`Codec box type : ${entryType} (avc1=H.264, hev1=H.265, mp4v=MPEG-4)`)
  }

  // ── stsz: frame count ────────────────────────────────────────────────────
  const stsz = findOne(stbl.ds, stbl.dl, 'stsz')
  let frameCount = 0
  if (stsz) {
    // version(1)+flags(3)+sample_size(4)+sample_count(4)
    frameCount = u32(stsz.ds + 8)
    console.log(`Frame count    : ${frameCount}`)
  }

  // ── stts: time-to-sample → FPS ───────────────────────────────────────────
  let fps = 30
  const stts = findOne(stbl.ds, stbl.dl, 'stts')
  if (stts) {
    const entryCount = u32(stts.ds + 4)
    let totalSamples = 0, totalTicks = 0
    for (let i = 0; i < entryCount; i++) {
      const sc = u32(stts.ds + 8 + i * 8)
      const sd = u32(stts.ds + 8 + i * 8 + 4)
      totalSamples += sc
      totalTicks   += sc * sd
    }
    fps = totalSamples / (totalTicks / mediaTimescale)
    console.log(`FPS (computed) : ${fps.toFixed(3)}`)
    console.log(`Duration check : ${(totalTicks / mediaTimescale).toFixed(3)} s via stts`)
  }

  // ── stss: sync sample table = keyframes ──────────────────────────────────
  const stss = findOne(stbl.ds, stbl.dl, 'stss')
  if (!stss) {
    console.log(`\nNo stss box → every frame is a keyframe (all-intra codec, e.g. ProRes/MJPEG)`)
    console.log(`Seek latency will be minimal — no decoder needs to walk back to find a keyframe.`)
    process.exit(0)
  }

  const kfCount = u32(stss.ds + 4)
  const kf = []
  for (let i = 0; i < kfCount; i++) {
    kf.push(u32(stss.ds + 8 + i * 4))
  }

  console.log(`\n── Keyframe analysis ────────────────────────────────`)
  console.log(`Keyframes      : ${kfCount} / ${frameCount} (${(kfCount/frameCount*100).toFixed(1)}%)`)
  console.log(`First 10       : ${kf.slice(0, 10).join(', ')}`)
  console.log(`Last 5         : ${kf.slice(-5).join(', ')}`)

  const gaps = []
  for (let i = 1; i < kf.length; i++) gaps.push(kf[i] - kf[i-1])

  if (gaps.length === 0) {
    console.log('Single keyframe.')
  } else {
    const avgGap = gaps.reduce((a,b) => a+b, 0) / gaps.length
    const maxGap = Math.max(...gaps)
    const minGap = Math.min(...gaps)
    const avgS   = avgGap / fps
    const maxS   = maxGap / fps

    console.log(`Gap avg        : ${avgGap.toFixed(1)} frames  (${avgS.toFixed(3)} s)`)
    console.log(`Gap max        : ${maxGap} frames  (${maxS.toFixed(3)} s)`)
    console.log(`Gap min        : ${minGap} frames  (${(minGap/fps).toFixed(3)} s)`)
    console.log(`All gaps       : ${gaps.join(', ')}`)

    if (maxS > 1.0) {
      console.log(`\n⚠️  MAX KEYFRAME INTERVAL > 1 s (${maxS.toFixed(2)} s)`)
      console.log(`   This is a primary cause of seek hiccups.`)
      console.log(`\nffmpeg command to re-encode with keyframe on every frame:`)
      console.log(`  ffmpeg -i public/city.mp4 -c:v libx264 -preset fast -crf 18 \\`)
      console.log(`    -x264-params "keyint=1:min-keyint=1:scenecut=0" \\`)
      console.log(`    -an public/city-allkey.mp4`)
      console.log(`\n  (This makes every frame a keyframe so every seek is instant.`)
      console.log(`   File size will grow ~2-3× but seek latency drops to near-zero.)`)
    } else {
      console.log(`\nKeyframe interval is ≤ 1 s — seek hiccups are likely caused by`)
      console.log(`other factors (decoder pipeline stall, backdrop-filter, main-thread work).`)
    }
  }

  // File size & bitrate
  const fileSizeMB = (raw.byteLength / 1048576).toFixed(2)
  const bitrate    = (raw.byteLength * 8 / movieDurationS / 1000).toFixed(0)
  console.log(`\n── File ─────────────────────────────────────────────`)
  console.log(`File size      : ${fileSizeMB} MB`)
  console.log(`Avg bitrate    : ${bitrate} kbps`)
}
