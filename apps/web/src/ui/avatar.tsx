import { cn } from './cn'

// Prototip karşılığı: .avatar. Kişi kimliği: baş harfler + kişi tonu (personel); müşteri avatarı nötr gri.
// Süstür: ad her zaman yanındaki metinden okunur.

const TR = 'tr-TR'

/** Gösterim için (anahtar değil): Türkçe büyük harf kuralıyla ilk iki sözcüğün baş harfleri. */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  if (words.length === 0) return '?'
  return words.map((word) => Array.from(word)[0].toLocaleUpperCase(TR)).join('')
}

/** Aynı kimlik her zaman aynı tonu (1-5) alır. */
export function personTone(id: string): 1 | 2 | 3 | 4 | 5 {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.codePointAt(0)!) >>> 0
  return ((hash % 5) + 1) as 1 | 2 | 3 | 4 | 5
}

// Sınıflar tam yazılır: Tailwind dinamik birleştirilen adları bulamaz.
const tones = {
  1: 'bg-person-1-bg text-person-1-text',
  2: 'bg-person-2-bg text-person-2-text',
  3: 'bg-person-3-bg text-person-3-text',
  4: 'bg-person-4-bg text-person-4-text',
  5: 'bg-person-5-bg text-person-5-text',
} as const

const sizes = {
  sm: 'size-7 text-xs',
  md: 'size-9 text-sm',
  lg: 'size-14 text-lg',
} as const

export function Avatar({
  name,
  tone,
  size = 'md',
  className,
}: {
  name: string
  /** Verilmezse nötr gri (müşteri). Personel için `personTone(id)`. */
  tone?: 1 | 2 | 3 | 4 | 5
  size?: keyof typeof sizes
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-grid flex-none place-items-center rounded-full font-semibold',
        tone ? tones[tone] : 'bg-surface-active text-text-secondary',
        sizes[size],
        className,
      )}
    >
      {getInitials(name)}
    </span>
  )
}
