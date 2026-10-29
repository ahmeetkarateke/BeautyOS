// Test hedef koruması: BEYAZ LİSTE. Kara liste (bilinen canlı adları saymak) yeni bir canlı adı eklenince
// sessizce açık kalır; bu yüzden yalnız açıkça test veritabanı olan hedefe izin verilir.
const FORBIDDEN_HOST_PARTS = ['.supabase.co', '.pooler.supabase.com', 'beautyossapp.com']

export function assertSafeTestDatabaseUrl(rawUrl: string): void {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('Test DATABASE_URL çözümlenemedi; postgresql://.../<ad>_test biçiminde bir adres ver.')
  }
  const host = url.hostname.toLowerCase()
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, '')).toLowerCase()
  const shown = `${host}/${dbName}`
  if (FORBIDDEN_HOST_PARTS.some((p) => host.includes(p))) {
    throw new Error(`Testler paylaşılan ya da canlı veritabanına çalışmaz (${shown}).`)
  }
  // Beyaz liste: veritabanı adı `_test` ile bitmeli (canlı `beautyos` ve `beautyos_staging` geçmez).
  if (!dbName.endsWith('_test')) {
    throw new Error(
      `Test veritabanı adı '_test' ile bitmeli; gelen: ${shown}. Geçici bir test veritabanı kullan (tests/sunucu/api-test.sh).`,
    )
  }
}
