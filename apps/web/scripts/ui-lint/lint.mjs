// Yeni arayüz (v2) klasörleri için kural denetimi (ADR-UI-04, ADR-UI-02). eslint.config.mjs korumalı olduğundan yalıtım ve
// gevşetilmiş kural ihlalleri burada denetlenir; `npm test` içindeki src/ui-lint.test.ts bu modülü gerçek klasörlere uygular.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

// v2 klasörleri (apps/web/src altında). Eski klasörler (components, hooks, store, lib/*.ts, app/(legacy)) denetlenmez.
export const V2_DIRS = ['ui', 'styles', 'fonts', 'features', 'content', 'lib/v2', 'app/(v2)']

const EXTENSIONS = new Set(['.ts', '.tsx', '.css'])

// tokens.css ham katman dosyası: hex yalnız orada serbest.
const HEX_ALLOWED_FILES = new Set(['styles/tokens.css'])

// İçe aktarma beyaz listesi (ADR-UI-02): v2 dosyası yalnız v2 köklerinden içe aktarabilir.
// Kara liste yeni eklenen eski dosyayı kaçırırdı.
const V2_ROOTS = V2_DIRS.map((d) => d + '/')
const isV2Path = (p) => V2_ROOTS.some((root) => (p + '/').startsWith(root))
// from 'x' | import 'x' | import('x') | require('x'); "export ... from 'x'" de from ile yakalanır.
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(['"])([^'"]+)\1/g
// CSS: @import "x" | @import url('x')
const CSS_IMPORT = /@import\s+(?:url\(\s*)?(['"])([^'"]+)\1/g

/**
 * @param {string} importer apps/web/src'ye göre içe aktaran dosya
 * @param {string} spec
 */
function isForbiddenImport(importer, spec) {
  if (spec.startsWith('@/')) return !isV2Path(spec.slice(2))
  if (spec.startsWith('.')) {
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(importer), spec))
    // Kök dışına çıkan ya da v2 kökü olmayan yol ihlaldir (proxy.ts src kökündedir).
    return resolved.startsWith('..') || !isV2Path(resolved)
  }
  return false // paket adı
}

/** @typedef {{ rule: string, line: number, text: string }} Finding */

/**
 * @param {string} relativePath apps/web/src'ye göre yol (eğik çizgili)
 * @param {string} content
 * @returns {Finding[]}
 */
export function lintSource(relativePath, content) {
  /** @type {Finding[]} */
  const findings = []
  const isCss = relativePath.endsWith('.css')
  const hexAllowed = HEX_ALLOWED_FILES.has(relativePath)
  const lines = content.split(/\r?\n/)
  let inBlockComment = false

  lines.forEach((raw, index) => {
    let line = raw
    // Basit yorum ayıklama: ihlal yorum satırında sayılmaz.
    if (inBlockComment) {
      const end = line.indexOf('*/')
      if (end === -1) return
      line = line.slice(end + 2)
      inBlockComment = false
    }
    line = line.replace(/\/\*.*?\*\//g, '')
    const open = line.indexOf('/*')
    if (open !== -1) {
      line = line.slice(0, open)
      inBlockComment = true
    }
    if (!isCss) line = line.replace(/(^|\s)\/\/.*$/, '$1')
    const at = (rule) => findings.push({ rule, line: index + 1, text: raw.trim() })

    if (!hexAllowed && /#[0-9a-fA-F]{3,8}\b/.test(line) && !/^\s*import\b/.test(line)) at('hex-renk')
    if (/\b(?:bg-white|bg-black|text-white|text-black)\b/.test(line)) at('ham-renk-sinifi')
    if (/\b(?:bg|text|border|ring|fill|stroke)-(?:gray|slate|zinc|neutral|stone|red|green|blue|amber|purple|violet|indigo)-\d{2,3}\b/.test(line)) at('ham-renk-sinifi')
    if (/(?:^|[\s"'`{(])dark:/.test(line)) at('dark-varyanti')
    if (/\btext-\[(?:[0-9]|1[01])(?:\.\d+)?px\]/.test(line) || /font-size:\s*(?:[0-9]|1[01])(?:\.\d+)?px/.test(line) || /\btext-\[0?\.(?:[0-6]\d*|7(?:[0-4]\d*)?)r?em\]/.test(line)) at('12px-alti-yazi')
    if (/\bfont-(?:bold|extrabold|black)\b|font-weight:\s*[7-9]00\b|\bfont-\[[7-9]00\]/.test(line)) at('kalin-700')
    if ([...line.matchAll(isCss ? CSS_IMPORT : SPECIFIER)].some((m) => isForbiddenImport(relativePath, m[2]))) at('eski-klasor-importu')
  })
  return findings
}

/** @param {string} srcRoot apps/web/src mutlak yolu */
export function listV2Files(srcRoot) {
  /** @type {string[]} */
  const out = []
  const walk = (dir) => {
    let entries
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const name of entries) {
      const full = path.join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (EXTENSIONS.has(path.extname(name)) && !/\.test\.(?:ts|tsx)$/.test(name)) out.push(full)
    }
  }
  for (const d of V2_DIRS) walk(path.join(srcRoot, d))
  // proxy.ts v2 yollarını yönetir; eski klasörlerden içe aktarma yapmamalıdır.
  out.push(path.join(srcRoot, 'proxy.ts'))
  return out
}

/** @param {string} srcRoot */
export function lintV2(srcRoot) {
  /** @type {Array<Finding & { file: string }>} */
  const all = []
  for (const file of listV2Files(srcRoot)) {
    let content
    try {
      content = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    const rel = path.relative(srcRoot, file).split(path.sep).join('/')
    for (const f of lintSource(rel, content)) all.push({ ...f, file: rel })
  }
  return all
}
