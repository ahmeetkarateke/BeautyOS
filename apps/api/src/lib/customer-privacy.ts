// R4: uzmana (staff) musteri telefonu yalniz kendi musterisinde acik; baskalarinda maskeli, arama kisitli.

/** Uzman aramasinda en az karakter (kirpilmis metin uzerinden). */
export const STAFF_SEARCH_MIN_LENGTH = 3
/** Uzman aramasinda donen en cok sonuc; sayfalama yok (toplu liste/disa aktarma engeli). */
export const STAFF_SEARCH_MAX_RESULTS = 10

/** PostgreSQL ILIKE jokerlerini (% _) ve kaçış karakterini (\) kaçışlar: Prisma `contains` bunları kaçışlamaz, `___` her kaydı eşleştirirdi. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, '\\$&')
}

/** "0532 *** ** 67" bicimi. Kisa ya da bos deger numara sizdirmamak icin "***" olur. */
export function maskPhone(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('90')) digits = `0${digits.slice(2)}`
  else if (digits.length === 10 && digits.startsWith('5')) digits = `0${digits}`
  if (digits.length < 7) return '***'
  return `${digits.slice(0, 4)} *** ** ${digits.slice(-2)}`
}
