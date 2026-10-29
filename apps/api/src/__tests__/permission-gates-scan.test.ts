import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { PERMISSIONS, can, type PermissionKey } from '@beautyos/shared'
import { GATES } from './helpers/gates'

// Bu test veritabani gerektirmez. Kaynaktaki yetki kapilarini (requirePermission / ensurePermission) tarar.
const ROUTES_DIR = path.resolve(__dirname, '../routes')
const ROUTE_RE = /router\.(get|post|put|patch|delete)\(\s*'([^']+)'([\s\S]*?)(?=\n\s*router\.(?:get|post|put|patch|delete)\(|\n\s*return router)/g
const GATE_RE = /(?:ensurePermission\(req, res, |requirePermission\()'([a-z_.]+)'/

function scanSourceGates(): string[] {
  const found: string[] = []
  for (const file of readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.route.ts'))) {
    const text = readFileSync(path.join(ROUTES_DIR, file), 'utf8')
    for (const m of text.matchAll(ROUTE_RE)) {
      const key = GATE_RE.exec(m[3])?.[1]
      if (key) found.push(`${file.replace('.route.ts', '')} ${m[1]} ${m[2]} ${key}`)
    }
  }
  return found.sort()
}

describe('S1-K5: yetki kapisi tablosu kaynakla birebir ayni', () => {
  it('kaynaktaki her kapi tabloda, tablodaki her satir kaynakta (dosya, yontem, yol, anahtar)', () => {
    const table = GATES.map((g) => `${g.file} ${g.method} ${g.route} ${g.permission}`).sort()
    expect(scanSourceGates()).toEqual(table)
  })

  it('tablodaki her izin anahtari PERMISSIONS icinde tanimli', () => {
    for (const gate of GATES) expect(Object.keys(PERMISSIONS)).toContain(gate.permission)
  })

  it('S1 yeni anahtarlar: customer.write, waitlist.view ve waitlist.write yalniz owner ve manager', () => {
    for (const key of ['customer.write', 'waitlist.view', 'waitlist.write'] as PermissionKey[]) {
      expect(can('owner', key)).toBe(true)
      expect(can('manager', key)).toBe(true)
      expect(can('staff', key)).toBe(false)
    }
  })
})
