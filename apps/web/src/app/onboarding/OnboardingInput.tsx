'use client'

import React, { useState } from 'react'

// Dark-themed input for onboarding flow
export const OnboardingInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { error?: string; label?: string }
>(function OnboardingInput({ error, label, ...props }, ref) {
  const [focused, setFocused] = useState(false)
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-xs font-medium text-white/50 uppercase tracking-wider">{label}</label>
      )}
      <input
        ref={ref}
        {...props}
        onFocus={(e) => { setFocused(true); props.onFocus?.(e) }}
        onBlur={(e) => { setFocused(false); props.onBlur?.(e) }}
        className="w-full h-10 rounded-xl px-3.5 text-sm text-white placeholder-white/20 outline-none transition-all duration-200"
        style={{
          background: focused ? 'rgba(107,72,255,0.08)' : 'rgba(255,255,255,0.05)',
          border: error
            ? '1px solid rgba(239,68,68,0.6)'
            : focused
            ? '1px solid rgba(107,72,255,0.7)'
            : '1px solid rgba(255,255,255,0.10)',
          boxShadow: focused && !error ? '0 0 0 3px rgba(107,72,255,0.12)' : 'none',
        }}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
})

// Dark-themed select for onboarding flow
export const OnboardingSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { error?: string; label?: string }
>(function OnboardingSelect({ error, label, children, ...props }, ref) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-xs font-medium text-white/50 uppercase tracking-wider">{label}</label>
      )}
      <select
        ref={ref}
        {...props}
        className="w-full h-10 rounded-xl px-3.5 text-sm text-white outline-none transition-all duration-200 appearance-none cursor-pointer"
        style={{
          background: '#1a1535',
          border: error ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.10)',
          colorScheme: 'dark',
        }}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
})

// Dark action buttons
export function OnboardingActions({
  onBack,
  isPending,
  submitLabel = 'İleri',
  skipLabel,
  onSkip,
}: {
  onBack?: () => void
  isPending?: boolean
  submitLabel?: string
  skipLabel?: string
  onSkip?: () => void
}) {
  return (
    <div className="flex justify-between pt-4">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="h-10 px-4 rounded-xl text-sm font-medium text-white/50 hover:text-white/80 transition-colors flex items-center gap-1.5"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          ← Geri
        </button>
      ) : <div />}

      <div className="flex gap-2">
        {skipLabel && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="h-10 px-4 rounded-xl text-sm font-medium text-white/40 hover:text-white/70 transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {skipLabel}
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="h-10 px-6 rounded-xl text-sm font-semibold text-white flex items-center gap-2 transition-all duration-200"
          style={{
            background: isPending ? 'rgba(107,72,255,0.4)' : 'linear-gradient(135deg, #6B48FF 0%, #8B68FF 100%)',
            boxShadow: isPending ? 'none' : '0 0 20px rgba(107,72,255,0.3)',
          }}
          onMouseEnter={(e) => { if (!isPending) e.currentTarget.style.boxShadow = '0 0 28px rgba(107,72,255,0.5)' }}
          onMouseLeave={(e) => { if (!isPending) e.currentTarget.style.boxShadow = '0 0 20px rgba(107,72,255,0.3)' }}
        >
          {isPending && (
            <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {submitLabel} {!isPending && '→'}
        </button>
      </div>
    </div>
  )
}
