'use client'

import { MessageCircle } from 'lucide-react'
import { toast } from '@/components/ui/toaster'
import { OnboardingActions } from '../OnboardingInput'

interface Step4WhatsAppProps {
  onNext: () => void
  onBack: () => void
}

export function Step4WhatsApp({ onNext, onBack }: Step4WhatsAppProps) {
  function handleSendInstructions() {
    toast('Kurulum talimatları e-posta adresinize gönderildi!')
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); onNext() }} className="space-y-5">
      {/* Icon + title */}
      <div className="flex flex-col items-center text-center space-y-3 py-2">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(37,211,102,0.15)', border: '1px solid rgba(37,211,102,0.25)', boxShadow: '0 0 20px rgba(37,211,102,0.15)' }}
        >
          <MessageCircle className="w-7 h-7" style={{ color: '#25D366' }} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">WhatsApp Business Bağlantısı</h3>
          <p className="text-white/40 text-sm mt-1 max-w-sm">
            Randevu hatırlatmaları ve müşteri bildirimleri için WhatsApp numaranızı bağlayın.
          </p>
        </div>
      </div>

      {/* Steps */}
      <div
        className="rounded-xl p-4 space-y-3"
        style={{ background: 'rgba(37,211,102,0.05)', border: '1px solid rgba(37,211,102,0.12)' }}
      >
        <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Kurulum adımları</p>
        <ol className="space-y-2">
          {[
            'WhatsApp Business uygulamasını indirin',
            'İşletme telefon numaranızla kayıt olun',
            'Ayarlar → Entegrasyonlar sayfasından bağlantı kodunu girin',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                style={{ background: 'rgba(37,211,102,0.15)', color: '#25D366' }}
              >
                {i + 1}
              </span>
              <span className="text-sm text-white/60">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Send email button */}
      <button
        type="button"
        onClick={handleSendInstructions}
        className="w-full h-10 rounded-xl text-sm font-medium text-white/60 hover:text-white/90 transition-all duration-150"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        Kurulum Talimatlarını E-postayla Gönder
      </button>

      <p className="text-xs text-center text-white/25">
        Bu adımı atlayabilirsiniz — daha sonra <span className="text-white/40">Ayarlar → Entegrasyonlar</span>&apos;dan yapabilirsiniz.
      </p>

      <OnboardingActions onBack={onBack} submitLabel="İleri" skipLabel="Atla" onSkip={onNext} />
    </form>
  )
}
