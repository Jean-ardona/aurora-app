import { create } from 'zustand'

export type Priority = 'housing' | 'nature' | 'mobility' | 'culture'

interface AuroraState {
  choices: Priority[]
  lifeScore: number
  waitlistCount: number
  joinedWaitlist: boolean

  toggleChoice: (p: Priority) => void
  joinWaitlist: () => void
}

export const useAuroraStore = create<AuroraState>((set) => ({
  choices: [],
  lifeScore: 0,
  waitlistCount: 1,
  joinedWaitlist: false,

  toggleChoice: (p) =>
    set((state) => {
      const exists = state.choices.includes(p)
      const next = exists
        ? state.choices.filter((c) => c !== p)
        : [...state.choices, p]
      return { choices: next, lifeScore: next.length * 25 }
    }),

  joinWaitlist: () =>
    set((state) => ({
      joinedWaitlist: true,
      waitlistCount: state.waitlistCount + 1,
    })),
}))
