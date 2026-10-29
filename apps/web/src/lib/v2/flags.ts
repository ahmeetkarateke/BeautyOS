// Yeni arayüz (v2) yüzey bayrağı. Değer derleme anında `NEXT_PUBLIC_UI_V2` olarak gömülür:
// açık yüzeylerin virgülle ayrılmış listesi (ör. "site,auth,panel,book,admin"). Boş ya da tanımsız = hepsi kapalı.
// Kapalı başarısızlık: bilinmeyen ya da bozuk bir parça sessizce yok sayılır, hiçbir yüzeyi açmaz.

export const SURFACES = ['site', 'auth', 'panel', 'book', 'admin'] as const

export type Surface = (typeof SURFACES)[number]

export function parseSurfaces(raw: string | undefined): ReadonlySet<Surface> {
  const open = new Set<Surface>()
  if (!raw) return open
  for (const part of raw.split(',')) {
    // toLowerCase dil bağımsızdır; büyük I içeren girdi Türk I'sına takılmaz.
    const name = part.trim().toLowerCase()
    if ((SURFACES as readonly string[]).includes(name)) open.add(name as Surface)
  }
  return open
}

// process.env.NEXT_PUBLIC_UI_V2 doğrudan yazılmalı: derleyici yalnız bu biçimi satır içine alır.
export const enabledSurfaces: ReadonlySet<Surface> = parseSurfaces(process.env.NEXT_PUBLIC_UI_V2)

export function isSurfaceEnabled(surface: Surface): boolean {
  return enabledSurfaces.has(surface)
}
