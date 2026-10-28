import { defineConfig } from 'vitest/config'

import path from 'node:path'

export default defineConfig({
  resolve: {
    // Testler paylasilan paketin kaynagini dogrudan kullanir (dist derlemesi gerekmez).
    alias: { '@beautyos/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts') },
  },
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: ['./src/__tests__/helpers/dotenv.ts'],
  },
})
