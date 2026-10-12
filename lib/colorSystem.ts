import type { Priority } from './store'

// Hue values for each priority
const PRIORITY_HUES: Record<Priority, number> = {
  housing: 35,   // warm amber
  nature: 165,   // green/teal
  mobility: 210, // electric blue
  culture: 300,  // magenta/violet
}

export function computeTintHue(choices: Priority[]): number {
  if (choices.length === 0) return 35
  const avg = choices.reduce((sum, p) => sum + PRIORITY_HUES[p], 0) / choices.length
  return avg
}

export function generateAuroraLine(choices: Priority[]): string {
  if (choices.length === 0) return 'A city waiting to be imagined.'
  if (choices.length === 1) {
    const lines: Record<Priority, string> = {
      housing: 'A city where everyone has a door to open.',
      nature: 'A city that breathes.',
      mobility: 'A city with no waiting.',
      culture: 'A city that never stops telling stories.',
    }
    return lines[choices[0]]
  }
  if (choices.length === 2) {
    const nouns: Record<Priority, string> = {
      housing: 'homes',
      nature: 'green',
      mobility: 'movement',
      culture: 'culture',
    }
    return `A city of ${nouns[choices[0]]} and ${nouns[choices[1]]}.`
  }
  return 'A city that has it all, and the people to prove it.'
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  housing: 'Homes for everyone',
  nature: 'Living nature',
  mobility: 'Moving freely',
  culture: 'Culture everywhere',
}

export const PRIORITY_DESCRIPTIONS: Record<Priority, string> = {
  housing: 'Affordable, human-scale housing for every resident.',
  nature: 'Parks, forests, and waterways woven into daily life.',
  mobility: 'A city you can cross in 20 minutes, on foot or by bike.',
  culture: 'Galleries, stages, and studios open to everyone.',
}

export const PRIORITY_ICONS: Record<Priority, string> = {
  housing: '⌂',
  nature: '◈',
  mobility: '→',
  culture: '◇',
}

export const PRIORITY_ACCENT: Record<Priority, string> = {
  housing: 'hsl(35, 80%, 60%)',
  nature: 'hsl(165, 70%, 50%)',
  mobility: 'hsl(210, 90%, 60%)',
  culture: 'hsl(300, 70%, 60%)',
}
