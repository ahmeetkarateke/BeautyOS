import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Skeleton, SkeletonGroup } from './skeleton'

describe('Skeleton (tasarim.md §4 İskelet)', () => {
  it('W3: tek çubuk ekran okuyucudan gizlenir, grup "Yükleniyor…" duyurur', () => {
    const { container } = render(
      <SkeletonGroup>
        <Skeleton variant="text" />
        <Skeleton variant="value" />
      </SkeletonGroup>,
    )
    for (const bar of container.querySelectorAll('[data-skeleton]')) {
      expect(bar.getAttribute('aria-hidden')).toBe('true')
    }
    expect(screen.getByRole('status').textContent).toContain('Yükleniyor…')
  })

  it('W3: parıltı animasyonu yok (düz gri çubuk)', () => {
    const { container } = render(<Skeleton variant="text" />)
    const cls = container.querySelector('[data-skeleton]')?.className ?? ''
    expect(cls).not.toMatch(/animate-|shimmer|pulse/)
  })

  it('W3: dairesel varyant tam yuvarlak köşe alır', () => {
    const { container } = render(<Skeleton variant="circle" />)
    expect(container.querySelector('[data-skeleton]')?.className).toContain('rounded-full')
  })
})
