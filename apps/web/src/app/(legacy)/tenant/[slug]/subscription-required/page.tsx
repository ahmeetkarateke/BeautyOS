'use client'

import { AlertCircle } from 'lucide-react'

export default function SubscriptionRequiredPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-6 mx-auto">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-3">Deneme Süreniz Doldu</h1>
        <p className="text-salon-muted mb-6">
          Devam etmek için bizimle iletişime geçin.
        </p>
        <a
          href="mailto:destek@beautyos.app"
          className="inline-block px-6 py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          destek@beautyos.app
        </a>
      </div>
    </div>
  )
}
