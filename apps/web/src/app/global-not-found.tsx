import './(legacy)/globals.css'
import type { Metadata } from 'next'

// İki kök düzen olduğundan eşleşmeyen yollar için Next'in genel 404'ü burada çizilir (eski arayüzdeki 404 ile aynı görünüm).
// Markalı yeni 404 W6'da, yüzey bayrağına göre gelir.
export const metadata: Metadata = { title: '404: Sayfa bulunamadı' }

export default function GlobalNotFound() {
  return (
    <html lang="tr">
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>404</h1>
          <p>Bu sayfa bulunamadı.</p>
        </div>
      </body>
    </html>
  )
}
