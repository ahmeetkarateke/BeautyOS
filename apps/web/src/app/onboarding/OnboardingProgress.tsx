'use client'

const STEP_ICONS = ['🏠', '✂️', '👤', '💬', '✅']

interface OnboardingProgressProps {
  step: number
  totalSteps?: number
}

export function OnboardingProgress({ step, totalSteps = 5 }: OnboardingProgressProps) {
  const percent = Math.round((step / totalSteps) * 100)

  return (
    <div className="w-full space-y-3">
      {/* Step dots */}
      <div className="flex items-center justify-between">
        {Array.from({ length: totalSteps }).map((_, i) => {
          const s = i + 1
          const done = s < step
          const active = s === step
          return (
            <div key={i} className="flex items-center flex-1">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-300"
                style={{
                  background: done
                    ? '#6B48FF'
                    : active
                    ? 'rgba(107,72,255,0.2)'
                    : 'rgba(255,255,255,0.05)',
                  border: active
                    ? '1px solid rgba(107,72,255,0.7)'
                    : done
                    ? 'none'
                    : '1px solid rgba(255,255,255,0.08)',
                  boxShadow: active ? '0 0 12px rgba(107,72,255,0.4)' : 'none',
                  color: done || active ? 'white' : 'rgba(255,255,255,0.25)',
                }}
              >
                {done ? '✓' : s}
              </div>
              {s < totalSteps && (
                <div
                  className="flex-1 h-px mx-1.5 transition-all duration-500"
                  style={{
                    background: done
                      ? 'linear-gradient(90deg, #6B48FF, rgba(107,72,255,0.4))'
                      : 'rgba(255,255,255,0.06)',
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${percent}%`,
            background: 'linear-gradient(90deg, #6B48FF, #FF6B8A)',
            boxShadow: '0 0 8px rgba(107,72,255,0.5)',
          }}
        />
      </div>

      <div className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
        <span>Adım {step} / {totalSteps}</span>
        <span>%{percent} tamamlandı</span>
      </div>
    </div>
  )
}
