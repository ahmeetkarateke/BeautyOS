import path from 'node:path'
import { fileURLToPath } from 'node:url'

const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker imajı için: yalnız gereken dosyalarla bağımsız sunucu üretir.
  output: 'standalone',
  // Monorepo'da bağımlılıklar kökte olduğundan izleme kökü depo köküdür.
  experimental: { outputFileTracingRoot: monorepoRoot },
  transpilePackages: [
    '@fullcalendar/core',
    '@fullcalendar/react',
    '@fullcalendar/daygrid',
    '@fullcalendar/timegrid',
    '@fullcalendar/interaction',
  ],
}

export default nextConfig
