// Marka işareti (prototip P.isaret): petrol halka + pudra yay. Renkler tokenlardan gelir; dekoratiftir.
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="flex-none">
      <circle cx="16" cy="16" r="12.5" fill="none" stroke="var(--color-primary)" strokeWidth="3.5" />
      <path d="M16 3.5A12.5 12.5 0 0 1 28.5 16" fill="none" stroke="var(--color-accent)" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2.4" fill="var(--color-primary)" />
    </svg>
  )
}
