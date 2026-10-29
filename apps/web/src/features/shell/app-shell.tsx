'use client'

import type { ReactNode } from 'react'
import { ToastProvider } from '@/ui/toast'
import { BottomNav } from './bottom-nav'
import { SideNav } from './side-nav'
import { TopBar } from './top-bar'

// Uygulama kabuğu (tasarim.md §5): 1024 px ve üstünde yan menü, altında üst bar + alt menü.
// Hangisinin görüneceğini CSS (lg:) belirler; gizlenen yüzey display:none olduğu için erişilebilirlik ağacında da yoktur.
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <a
        href="#icerik"
        className="fixed left-3 top-3 z-(--z-toast) -translate-y-20 rounded-control bg-surface px-4 py-2.5 text-sm font-medium text-text shadow-menu focus:translate-y-0"
      >
        Ana içeriğe geç
      </a>
      <div className="min-h-dvh lg:grid lg:grid-cols-[var(--size-sidebar)_minmax(0,1fr)]">
        <SideNav className="hidden lg:flex" />
        <div className="min-w-0">
          <TopBar className="lg:hidden" />
          <main
            id="icerik"
            tabIndex={-1}
            className="w-full max-w-(--size-content-max) px-4 pb-[calc(var(--size-bottombar)+2rem+env(safe-area-inset-bottom))] pt-2 outline-none lg:px-8 lg:pb-12 lg:pt-7"
          >
            {children}
          </main>
        </div>
      </div>
      <BottomNav className="lg:hidden" />
    </ToastProvider>
  )
}
