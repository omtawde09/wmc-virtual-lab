#!/usr/bin/env node
/**
 * Stamps the public site URL across every file that hardcodes it.
 *
 *   node scripts/set-site-url.mjs https://wmc-virtual-lab.onrender.com
 *
 * The canonical value lives in src/useSEO.js (SITE_URL); this script reads the
 * current value from there and replaces it in the static files that cannot read
 * JS at runtime (index.html meta/JSON-LD, robots.txt, sitemap.xml).
 *
 * Run this whenever you move host or attach a custom domain — otherwise your
 * canonical tags, Open Graph URLs and sitemap keep pointing at the old origin,
 * which quietly wrecks indexing.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const TARGETS = [
  'src/useSEO.js',
  'index.html',
  'public/robots.txt',
  'public/sitemap.xml',
]

const next = (process.argv[2] || '').trim().replace(/\/+$/, '')
if (!next) {
  console.error('Usage: node scripts/set-site-url.mjs https://your-site.onrender.com')
  process.exit(1)
}
if (!/^https?:\/\/[^/\s]+$/.test(next)) {
  console.error(`Invalid URL: "${next}" (expected an origin like https://example.onrender.com)`)
  process.exit(1)
}

// Current value = single source of truth in useSEO.js
const seoPath = join(root, 'src/useSEO.js')
const seoSrc = readFileSync(seoPath, 'utf8')
const m = /SITE_URL\s*=\s*'([^']+)'/.exec(seoSrc)
if (!m) {
  console.error('Could not find SITE_URL in src/useSEO.js')
  process.exit(1)
}
const current = m[1].replace(/\/+$/, '')

if (current === next) {
  console.log(`Site URL already set to ${next} — nothing to do.`)
  process.exit(0)
}

console.log(`Updating site URL:\n  from  ${current}\n  to    ${next}\n`)

let total = 0
for (const rel of TARGETS) {
  const file = join(root, rel)
  if (!existsSync(file)) {
    console.log(`  skip  ${rel} (not found)`)
    continue
  }
  const before = readFileSync(file, 'utf8')
  const after = before.split(current).join(next)
  const hits = before.split(current).length - 1
  if (hits > 0) writeFileSync(file, after)
  total += hits
  console.log(`  ${hits > 0 ? 'ok  ' : '--  '}  ${rel}  (${hits} replaced)`)
}

console.log(`\nDone — ${total} reference(s) updated.`)
console.log('Rebuild (npm run build) so the change reaches dist/.')
