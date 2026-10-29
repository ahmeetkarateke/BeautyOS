'use client'

import * as RadixTabs from '@radix-ui/react-tabs'
import type { ReactNode } from 'react'
import { cn } from './cn'

// Prototip karşılığı: .sekmeler. Alt çizgili; ok tuşlarıyla gezilir; sayfayı değil kendi satırını kaydırır.
export function Tabs({
  value,
  onValueChange,
  children,
  className,
}: {
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
  className?: string
}) {
  return (
    <RadixTabs.Root value={value} onValueChange={onValueChange} className={className}>
      {children}
    </RadixTabs.Root>
  )
}

export function TabList({ children, className, 'aria-label': ariaLabel }: { children: ReactNode; className?: string; 'aria-label': string }) {
  return (
    <RadixTabs.List
      aria-label={ariaLabel}
      className={cn('flex gap-1 overflow-x-auto [&_:focus-visible]:-outline-offset-2 border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}
    >
      {children}
    </RadixTabs.List>
  )
}

export function Tab({ value, children }: { value: string; children: ReactNode }) {
  return (
    <RadixTabs.Trigger
      value={value}
      className={cn(
        '-mb-px min-h-(--size-control) flex-none cursor-pointer border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-text-secondary',
        'transition-colors duration-(--duration-fast) hover:text-text',
        'data-[state=active]:border-primary data-[state=active]:text-text',
      )}
    >
      {children}
    </RadixTabs.Trigger>
  )
}

export function TabPanel({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  return (
    <RadixTabs.Content value={value} className={cn('pt-4', className)}>
      {children}
    </RadixTabs.Content>
  )
}
