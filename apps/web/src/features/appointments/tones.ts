// Personel kimlik tonları (tasarim.md §3.1): kimliktir, veri değildir. Sınıflar tam yazılır (Tailwind dinamik adı bulamaz).
export type Tone = 1 | 2 | 3 | 4 | 5

/** Personel listesindeki sıraya göre ton; altıncı kişiden sonra döngü (baş harf ayrımı avatarda kalır). */
export const toneForIndex = (index: number): Tone => ((((index % 5) + 5) % 5) + 1) as Tone

export const toneClasses: Record<Tone, { avatar: string; soft: string; border: string; solid: string; dashed: string; bar: string }> = {
  1: { avatar: 'bg-person-1-bg text-person-1-text', soft: 'bg-person-1-bg border-person-1-mark/45', border: 'border-person-1-mark', solid: 'bg-person-1-mark border-person-1-mark', dashed: 'border-person-1-mark', bar: 'bg-person-1-mark' },
  2: { avatar: 'bg-person-2-bg text-person-2-text', soft: 'bg-person-2-bg border-person-2-mark/45', border: 'border-person-2-mark', solid: 'bg-person-2-mark border-person-2-mark', dashed: 'border-person-2-mark', bar: 'bg-person-2-mark' },
  3: { avatar: 'bg-person-3-bg text-person-3-text', soft: 'bg-person-3-bg border-person-3-mark/45', border: 'border-person-3-mark', solid: 'bg-person-3-mark border-person-3-mark', dashed: 'border-person-3-mark', bar: 'bg-person-3-mark' },
  4: { avatar: 'bg-person-4-bg text-person-4-text', soft: 'bg-person-4-bg border-person-4-mark/45', border: 'border-person-4-mark', solid: 'bg-person-4-mark border-person-4-mark', dashed: 'border-person-4-mark', bar: 'bg-person-4-mark' },
  5: { avatar: 'bg-person-5-bg text-person-5-text', soft: 'bg-person-5-bg border-person-5-mark/45', border: 'border-person-5-mark', solid: 'bg-person-5-mark border-person-5-mark', dashed: 'border-person-5-mark', bar: 'bg-person-5-mark' },
}

/** Takvim olayının durum görünümü: onay bekleyen kesikli, devam eden dolu, tamamlanan/gelmeyen geçmiş tonu (opaklık değil). */
export function eventClasses(status: string, tone: Tone): string {
  const t = toneClasses[tone]
  if (status === 'in_progress') return `${t.solid} text-text-inverse`
  if (status === 'pending') return `border-dashed bg-surface ${t.dashed}`
  if (status === 'completed' || status === 'no_show') return 'border-border bg-past-bg text-past-text'
  if (status === 'cancelled') return 'border-border bg-surface-subtle text-text-muted line-through'
  return t.soft
}
