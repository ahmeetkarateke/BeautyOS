// Tasarım sistemi vitrin sayfası (/v2/tasarim-sistemi) yalnız staging'de açılır. Yüzey bayrağından ayrıdır: üretimde
// "panel" gibi yüzeyler açık olsa bile vitrin kapalı kalır. Derleme anında NEXT_PUBLIC_UI_V2_SHOWCASE=1 ile açılır.
export function parseShowcaseFlag(raw: string | undefined): boolean {
  return raw === '1'
}

// process.env.NEXT_PUBLIC_UI_V2_SHOWCASE doğrudan yazılmalı: derleyici yalnız bu biçimi satır içine alır.
export const showcaseEnabled: boolean = parseShowcaseFlag(process.env.NEXT_PUBLIC_UI_V2_SHOWCASE)
