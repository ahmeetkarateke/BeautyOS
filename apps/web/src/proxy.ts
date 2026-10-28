import { NextResponse, type NextRequest } from 'next/server'
import { enabledSurfaces } from '@/lib/v2/flags'
import { resolveRoute } from '@/lib/v2/routes'

// Next 16'da middleware'in yeni adı. Bayrak kapalıyken (canlı) hiçbir eski yol değişmez; yalnız v2 yolları 404 olur.
export function proxy(request: NextRequest) {
  const decision = resolveRoute(request.nextUrl.pathname, enabledSurfaces)

  switch (decision.kind) {
    case 'next':
      return NextResponse.next()
    case 'notFound':
      // Var olmayan bir yola yeniden yazmak Next'in kendi 404 yanıtını üretir.
      return NextResponse.rewrite(new URL('/_v2-kapali', request.url))
    case 'rewrite': {
      const url = request.nextUrl.clone()
      url.pathname = decision.pathname
      return NextResponse.rewrite(url)
    }
    case 'redirect': {
      const url = request.nextUrl.clone()
      url.pathname = decision.pathname
      return NextResponse.redirect(url, decision.status)
    }
  }
}

export const config = {
  // Yalnız Next iç yolları ve kök dosyalar proxy dışındadır. Noktalı yollar (/v2/a.b) dışarıda bırakılmaz: bayrak kapalıyken 404 olmalıdır.
  matcher: ['/((?!_next/|favicon.ico$|robots.txt$|sitemap.xml$).*)'],
}
