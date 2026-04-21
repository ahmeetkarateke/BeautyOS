'use client'

import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'

interface Step4WhatsAppProps {
  onNext: () => void
  onBack: () => void
}

export function Step4WhatsApp({ onNext, onBack }: Step4WhatsAppProps) {
  function handleSendInstructions() {
    toast('Kurulum talimatları e-posta adresinize gönderildi!')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center space-y-4 py-4">
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: '#25D366' }}>
          <MessageCircle className="w-8 h-8 text-white" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">WhatsApp Business Bağlantısı</h3>
          <p className="text-salon-muted text-sm max-w-sm">
            WhatsApp Business numaranızı bağlayın ve randevu hatırlatmaları ile
            müşteri bildirimleri gönderin.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-salon-border bg-salon-bg p-4 space-y-3">
        <p className="text-sm font-medium text-gray-900">Kurulum adımları:</p>
        <ol className="text-sm text-salon-muted space-y-1.5 list-decimal list-inside">
          <li>WhatsApp Business uygulamasını indirin</li>
          <li>İşletme telefon numaranızla kayıt olun</li>
          <li>Ayarlar &gt; Entegrasyonlar sayfasından bağlantı kodunu girin</li>
        </ol>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleSendInstructions}
      >
        Kurulum Talimatlarını E-postayla Gönder
      </Button>

      <p className="text-xs text-center text-salon-muted">
        Bu adımı atlayabilirsiniz, daha sonra{' '}
        <span className="font-medium">Ayarlar &gt; Entegrasyonlar</span>&apos;dan yapabilirsiniz.
      </p>

      <div className="flex justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>
          Geri
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onNext}>
            Atla
          </Button>
          <Button type="button" onClick={onNext}>
            İleri
          </Button>
        </div>
      </div>
    </div>
  )
}
