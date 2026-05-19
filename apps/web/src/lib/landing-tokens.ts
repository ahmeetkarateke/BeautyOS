// Landing page brand tokens. Application UI buna bağımlı değildir — sadece marketing route'unda kullanılır.

export const landing = {
  color: {
    // Krem zemin (sıcak, butik salon hissi)
    cream: '#FFF8F3',
    creamMuted: '#F5EDE4',
    // Petrol mürekkep (saf siyah yerine — premium SaaS pattern)
    ink: '#1F3E47',
    inkSoft: 'rgba(31,62,71,0.78)',
    inkMuted: 'rgba(31,62,71,0.60)',
    inkSubtle: 'rgba(31,62,71,0.40)',
    // Brand accents
    rose: '#E89B96',
    roseDark: '#D67D78',
    primary: '#6B48FF',
    primaryHover: '#5A3CFB',
    // Surface
    border: 'rgba(31,62,71,0.10)',
    borderStrong: 'rgba(31,62,71,0.18)',
  },
  shadow: {
    // Premium kalkma efekti — primary CTA hover'da
    ctaLift: '0 8px 24px -8px rgba(107, 72, 255, 0.40)',
    card: '0 1px 3px rgba(31, 62, 71, 0.06), 0 1px 2px rgba(31, 62, 71, 0.04)',
    cardHover: '0 12px 32px -12px rgba(31, 62, 71, 0.14), 0 4px 8px -4px rgba(31, 62, 71, 0.06)',
  },
  easing: {
    // Asla saf `ease` kullanma — bu eğriler premium SaaS standardı
    hover: 'cubic-bezier(0.4, 0, 0.2, 1)',
    reveal: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
  noise: {
    // SVG noise data URI — krem zemine 0.035 opacity ile mix-blend-overlay
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.8'/></svg>`,
  },
} as const

// Framer Motion variants — sayfada tutarlı reveal
export const fadeUpVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
}

export const fadeUpStaggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
}
