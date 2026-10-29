import { expect, test } from '@playwright/test'

// W0 kabul dumanı: yüzey bayrağı (NEXT_PUBLIC_UI_V2). Aynı dosya iki derlemede koşar:
//   E2E_UI_V2 boş            -> canlı gibi: v2 yolları 404, eski yollar çalışır
//   E2E_UI_V2 = tüm yüzeyler -> staging gibi: eski panel yolları yeni panele yönlenir
// Yönlendirmeler izlenmez (maxRedirects: 0), böylece durum kodu ve Location doğrudan okunur.
const BAYRAK = (process.env.E2E_UI_V2 ?? '').trim()
const KAPALI = BAYRAK === ''

async function git(request: import('@playwright/test').APIRequestContext, yol: string) {
  return request.get(yol, { maxRedirects: 0, failOnStatusCode: false })
}

test.describe('bayrak kapalı (canlı)', () => {
  test.skip(!KAPALI, 'yalnız bayrak kapalı derlemede')

  // Denetçi koşulu (W0-1 Önemli 1): noktalı, yüzde-kodlu ve büyük harfli (Türk I'sı vakası dahil) v2 yolları 404 vermeli.
  const kapaliYollar = [
    '/v2',
    '/v2/login',
    '/v2/a.b',
    '/%76%32',
    '/%76%32/login',
    '/panel/defne',
    '/panel/x/y.z',
    '/panel/%64efne/bugun',
    '/V2',
    '/PANEL/defne',
    '/ozellikler',
    '/kvkk',
  ]
  for (const yol of kapaliYollar) {
    test(`K1: ${yol} 404 verir`, async ({ request }) => {
      const yanit = await git(request, yol)
      expect(yanit.status()).toBe(404)
    })
  }

  test('K1: eski yollar aynen çalışır (/login, /book/<slug>, /tenant/<slug>/dashboard yönlenmez)', async ({ request }) => {
    for (const yol of ['/login', '/book/yok-salon', '/tenant/yok-salon/dashboard']) {
      const yanit = await git(request, yol)
      expect(yanit.status(), yol).toBe(200)
    }
  })
})

test.describe('bayrak açık (staging)', () => {
  test.skip(KAPALI, 'yalnız bayrak açık derlemede')

  test('K2: eski panel yolu yeni panele yönlenir, sorgu dizesi korunur', async ({ request }) => {
    const yanit = await git(request, '/tenant/defne/dashboard?x=1')
    expect(yanit.status()).toBe(307)
    const hedef = new URL(yanit.headers()['location'], 'http://web:3000')
    expect(hedef.pathname).toBe('/panel/defne/bugun')
    expect(hedef.search).toBe('?x=1')
  })

  test('K2: ayrıntı yolu kimliği taşır', async ({ request }) => {
    const yanit = await git(request, '/tenant/defne/customers/abc123')
    expect(yanit.status()).toBe(307)
    expect(new URL(yanit.headers()['location'], 'http://web:3000').pathname).toBe('/panel/defne/musteri/abc123')
  })

  test('K2: /panel ve /v2 yolları açılır', async ({ request }) => {
    for (const yol of ['/panel/defne/bugun', '/v2']) {
      expect((await git(request, yol)).status(), yol).toBe(200)
    }
  })

  test('K2: segment sınırı: /panelist ve /bookings yanlış yüzeye düşmez', async ({ request }) => {
    for (const yol of ['/panelist', '/bookings']) {
      expect((await git(request, yol)).status(), yol).toBe(404)
    }
  })
})
