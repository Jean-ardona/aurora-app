/**
 * SoftScrim — a soft radial/linear gradient scrim behind text blocks.
 * No hard edges. Fades to fully transparent at all edges.
 * Max opacity 0.45. City stays visible through it.
 */

interface SoftScrimProps {
  /** 'center' uses a radial gradient. 'full' uses a vertical linear gradient. */
  variant?: 'center' | 'full' | 'top' | 'bottom'
  opacity?: number
}

export default function SoftScrim({ variant = 'center', opacity = 0.45 }: SoftScrimProps) {
  const gradients: Record<string, string> = {
    center: `radial-gradient(ellipse 80% 65% at 50% 50%, rgba(0,0,0,${opacity}) 0%, transparent 100%)`,
    full:   `linear-gradient(180deg, transparent 0%, rgba(0,0,0,${opacity}) 25%, rgba(0,0,0,${opacity}) 75%, transparent 100%)`,
    top:    `linear-gradient(180deg, rgba(0,0,0,${opacity}) 0%, transparent 60%)`,
    bottom: `linear-gradient(0deg,   rgba(0,0,0,${opacity}) 0%, transparent 60%)`,
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: gradients[variant],
        pointerEvents: 'none',
      }}
    />
  )
}
