import Link from 'next/link'

// Geçici yer tutucu: yeni yüzeyler (W30, W32, W33, W40) gelene kadar iç /v2 yolları bu bilgiyi gösterir.
export default function V2PlaceholderPage() {
  return (
    <main>
      <h1>Bu ekran yeni arayüzde hazırlanıyor</h1>
      <p>
        <Link href="/">Ana sayfaya dön</Link>
      </p>
    </main>
  )
}
