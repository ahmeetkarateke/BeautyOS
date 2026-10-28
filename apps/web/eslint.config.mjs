import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

// Next 16'da `next lint` kalktı; ESLint doğrudan çalışır. Bu depoda daha önce ESLint yapılandırması yoktu:
// eski arayüz koduna yeni react-hooks kuralları ilk kez uygulanıyor. Bu kurallar eski kodda uyarı düzeyindedir
// (eski arayüz geçişte silinecek); yeni arayüz klasörleri W0'da bu kurallarla ve içe aktarma yalıtımıyla ayrıca sıkılaşır.
const legacyRelaxed = {
  'react-hooks/set-state-in-effect': 'warn',
  'react-hooks/use-memo': 'warn',
  'react-hooks/refs': 'warn',
  'react/no-unescaped-entities': 'warn',
  '@typescript-eslint/no-require-imports': 'warn',
}

const config = [
  ...nextVitals,
  ...nextTs,
  { rules: legacyRelaxed },
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
]

export default config
