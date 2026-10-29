// "09:30’a kadar": yönelme eki saatin OKUNUŞUNA göre seçilir (otuz -> a, iki -> ye, altı -> ya).
// Okunuşun son sözcüğü: dakika sıfırdan farklıysa dakika, değilse saat. Ek, o sözcüğün son ünlüsüne ve sesli/sessiz bitişine bağlıdır.
const UNIT_SUFFIX = ['a', 'e', 'ye', 'e', 'e', 'e', 'ya', 'ye', 'e', 'a'] as const // sıfır bir iki üç dört beş altı yedi sekiz dokuz
// 10 on, 20 yirmi, 30 otuz, 40 kırk, 50 elli
const TENS_SUFFIX: Record<number, string> = { 1: 'a', 2: 'ye', 3: 'a', 4: 'a', 5: 'ye' }

function suffixOfNumber(n: number): string {
  const unit = n % 10
  if (unit !== 0) return UNIT_SUFFIX[unit]
  return n === 0 ? UNIT_SUFFIX[0] : TENS_SUFFIX[n / 10]
}

export function untilLabel(clock: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(clock)
  if (!match) return `${clock} saatine kadar`
  const hours = Number(match[1])
  const minutes = Number(match[2])
  return `${clock}’${suffixOfNumber(minutes !== 0 ? minutes : hours)} kadar`
}
