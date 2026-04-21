'use client'

interface OnboardingProgressProps {
  step: number
  totalSteps?: number
}

export function OnboardingProgress({ step, totalSteps = 5 }: OnboardingProgressProps) {
  const percent = Math.round((step / totalSteps) * 100)

  return (
    <div className="w-full space-y-1.5">
      <div className="flex justify-between text-xs text-salon-muted">
        <span>Adım {step} / {totalSteps}</span>
        <span>%{percent}</span>
      </div>
      <div className="w-full h-2 bg-primary-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
