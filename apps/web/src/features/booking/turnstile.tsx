'use client'

import { useEffect, useRef } from 'react'

// Görünmez bot koruması (Cloudflare Turnstile): yalnız site anahtarı tanımlıysa çizilir; formda tek satır bilgi.
type TurnstileApi = {
  render: (el: HTMLElement, options: { sitekey: string; appearance: string; callback: (token: string) => void; 'expired-callback': () => void }) => string
  remove: (id: string) => void
}
const api = () => (window as unknown as { turnstile?: TurnstileApi }).turnstile

export function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = box.current
    let widget: string | null = null
    const mount = () => {
      const t = api()
      if (t && el && widget === null) widget = t.render(el, { sitekey: siteKey, appearance: 'interaction-only', callback: onToken, 'expired-callback': () => onToken('') })
    }
    if (api()) mount()
    else {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      script.async = true
      script.onload = mount
      document.head.appendChild(script)
    }
    return () => {
      if (widget !== null) api()?.remove(widget)
    }
  }, [siteKey, onToken])
  return (
    <>
      <div ref={box} />
      <p className="text-xs text-text-muted">Bu form otomatik gönderimlere karşı korunur.</p>
    </>
  )
}
