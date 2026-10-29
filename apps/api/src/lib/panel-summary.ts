export const SETUP_STEP_IDS = ['salon', 'working-hours', 'services', 'staff', 'first-appointment', 'online-link'] as const
export type SetupStepId = (typeof SETUP_STEP_IDS)[number]

export function istanbulDayBounds(_now: Date): { start: Date; end: Date } {
  throw new Error('not implemented')
}

export function trialStatus(_plan: string, _trialEndsAt: Date | null, _now: Date): null {
  throw new Error('not implemented')
}

export function buildSetupSteps(_input: unknown): never {
  throw new Error('not implemented')
}
