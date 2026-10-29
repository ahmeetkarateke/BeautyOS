import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// S9: iki imaj ve CI ayni Node 22 hattinda olmali (ADR-0024). Sürüm sabit etiketlidir, 'latest'/'22' gibi kayan etiket yok.
const root = path.resolve(__dirname, '../../../..')
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8')

describe('S9: Node 22 tek hat', () => {
  it.each(['apps/api/Dockerfile', 'apps/web/Dockerfile'])('%s taban imaji node:22.x.y-bookworm-slim (sabit etiket)', (file) => {
    const froms = [...read(file).matchAll(/^FROM (\S+)/gm)].map((m) => m[1])
    const nodeFroms = froms.filter((f) => f.startsWith('node:'))
    expect(nodeFroms.length).toBeGreaterThan(0)
    for (const image of nodeFroms) expect(image).toMatch(/^node:22\.\d+\.\d+-bookworm-slim$/)
  })

  it('ci.yml tum isleri Node 22 ile kurar', () => {
    const versions = [...read('.github/workflows/ci.yml').matchAll(/node-version:\s*'?(\d+)/g)].map((m) => m[1])
    expect(versions.length).toBeGreaterThan(0)
    expect(new Set(versions)).toEqual(new Set(['22']))
  })

  it('kok package.json engines.node >=22', () => {
    const pkg = JSON.parse(read('package.json')) as { engines: { node: string } }
    expect(pkg.engines.node).toBe('>=22.0.0')
  })
})
