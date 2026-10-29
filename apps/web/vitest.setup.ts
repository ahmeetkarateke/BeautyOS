import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// RTL, globals açık olsa da vitest ile otomatik temizlemez.
afterEach(() => {
  cleanup()
})
