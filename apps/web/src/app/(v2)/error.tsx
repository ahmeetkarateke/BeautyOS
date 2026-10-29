'use client'

import { ErrorScreen } from '@/features/shell/system-screens'

// Yeni arayüzün genel hata sınırı (W6 K5). Teknik ayrıntı ve hata metni kullanıcıya gösterilmez; log sunucu tarafında tutulur.
export default function V2Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen reset={reset} />
}
