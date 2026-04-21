'use client'

import * as React from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { X, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Store ────────────────────────────────────────────────────────────────────

type ToastVariant = 'success' | 'error'

interface ToastItem {
  id: string
  title: string
  variant: ToastVariant
}

type Listener = (toasts: ToastItem[]) => void

let toasts: ToastItem[] = []
const listeners: Set<Listener> = new Set()

function notify(listeners: Set<Listener>) {
  listeners.forEach((l) => l([...toasts]))
}

export function toast(title: string, variant: ToastVariant = 'success') {
  const id = Math.random().toString(36).slice(2)
  toasts = [...toasts, { id, title, variant }]
  notify(listeners)
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    notify(listeners)
  }, 4000)
}

function useToasts() {
  const [items, setItems] = React.useState<ToastItem[]>([])
  React.useEffect(() => {
    const handler = (next: ToastItem[]) => setItems(next)
    listeners.add(handler)
    return () => { listeners.delete(handler) }
  }, [])
  return items
}

// ─── Toaster component ────────────────────────────────────────────────────────

export function Toaster() {
  const items = useToasts()

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {items.map((item) => (
        <ToastPrimitive.Root
          key={item.id}
          open
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-80 data-[state=open]:fade-in-0',
            'data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-bottom-full',
            item.variant === 'success'
              ? 'bg-white border-green-200 text-gray-900'
              : 'bg-white border-red-200 text-gray-900',
          )}
        >
          {item.variant === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          )}
          <ToastPrimitive.Title className="flex-1 text-sm font-medium">
            {item.title}
          </ToastPrimitive.Title>
          <ToastPrimitive.Close className="text-salon-muted hover:text-gray-900 transition-colors">
            <X className="w-4 h-4" />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 max-sm:w-[calc(100vw-2rem)] max-sm:right-4" />
    </ToastPrimitive.Provider>
  )
}
