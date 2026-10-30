'use client'

import { useState } from 'react'
import type { CSSProperties, ReactNode, Ref } from 'react'
import { createApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import { safeBrandColor } from './logic'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

/** Kimliksiz müşteri yüzeyinin tek apiClient'ı. */
export function PublicClientProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => createApiClient({ baseUrl: API_URL }))
  return <ApiClientProvider client={client}>{children}</ApiClientProvider>
}

/** Salonun rengi birincil renk olur; açık renkte okunurluk için yazı rengi de seçilir. */
export function brandStyle(color: unknown): CSSProperties | undefined {
  const hex = safeBrandColor(color)
  if (!hex) return undefined
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const light = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6
  return { '--salon-renk': hex, '--color-primary': hex, '--color-primary-hover': hex, ...(light ? { '--color-on-primary': 'var(--color-text)' } : {}) } as CSSProperties
}

type ShellProps = { title: string; lead?: ReactNode; style?: CSSProperties; stepLabel?: string; headingRef?: Ref<HTMLHeadingElement>; children?: ReactNode }

export function PublicShell({ title, lead, style, stepLabel, headingRef, children }: ShellProps) {
  return (
    <div style={style} className="flex min-h-dvh flex-col items-center bg-page px-4 py-6">
      <main className="w-full max-w-110">
        {stepLabel ? <p className="text-sm text-text-muted">{stepLabel}</p> : null}
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl leading-8 font-semibold tracking-tight outline-none sm:text-[2rem] sm:leading-10">
          {title}
        </h1>
        {lead ? <p className="mt-1.5 text-text-secondary">{lead}</p> : null}
        <div className="mt-6 grid gap-4">{children}</div>
      </main>
      <footer className="mt-auto pt-8 text-xs text-text-muted">BeautyOS altyapısıyla</footer>
    </div>
  )
}
