'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Toaster } from '@/components/ui/toaster'
import { useThemeStore } from '@/store/theme'

function ThemeProvider() {
  const dark = useThemeStore((s) => s.dark)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])
  return null
}

// ReactQueryDevtools production'da CSP (eval/new Function blok) ile
// çakışıyordu — modal/dialog mount edince donmaya sebep oluyor.
// Sadece development'ta yükle.
const isDev = process.env.NODE_ENV === 'development'
const DevtoolsLazy = isDev
  ? require('@tanstack/react-query-devtools').ReactQueryDevtools as React.ComponentType<{ initialIsOpen?: boolean }>
  : null

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider />
      {children}
      <Toaster />
      {DevtoolsLazy ? <DevtoolsLazy initialIsOpen={false} /> : null}
    </QueryClientProvider>
  )
}
