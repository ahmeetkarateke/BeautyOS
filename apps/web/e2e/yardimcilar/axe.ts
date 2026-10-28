import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

// UI-DoD: ciddi (serious) ve kritik (critical) axe ihlali 0 olmalı.
export async function expectNoSeriousA11yViolations(page: Page, context?: string) {
  const sonuc = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const ciddi = sonuc.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ kural: v.id, etki: v.impact, dugumSayisi: v.nodes.length, ornek: v.nodes[0]?.target }))
  expect(ciddi, `axe ihlalleri${context ? ` (${context})` : ''}`).toEqual([])
}
