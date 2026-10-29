import * as matchers from '@testing-library/jest-dom/matchers'
import { cleanup } from '@testing-library/react'
import { afterEach, expect } from 'vitest'

// '@testing-library/jest-dom/vitest' kökteki (api) vitest'e bağlanıyor; web kendi vitest sürümünü
// kullandığı için eşleştiriciler elle eklenir.
expect.extend(matchers)

// RTL, globals açık olsa da vitest ile otomatik temizlemez.
afterEach(() => {
  cleanup()
})
