import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { handleRequest } from '../worker/index.js'

const root = new URL('../public/', import.meta.url)
const origin = 'https://agency-agents.space'
const required = [
  'index.html',
  'planner/index.html',
  'nexus-sprint/index.html',
  'codex-agents/index.html',
  'marketing-team/index.html',
  'security-qa/index.html',
  'templates/index.html',
  'integrations/index.html',
  'agency-agents-alternative/index.html',
  'docs/index.html',
  'pricing/index.html',
  'checkout/index.html',
  'success/index.html',
  'cancel/index.html',
  'source-notes/index.html',
  'faq/index.html',
  'privacy/index.html',
  'terms/index.html',
  'changelog/index.html',
  '404.html',
  'styles.css',
  'app.js',
  'product.json',
  'sitemap.xml',
  'robots.txt',
  'llms.txt',
  '590a3ab02487cffe4cfd55b0df769f65.txt',
  'BingSiteAuth.xml',
  'favicon.svg',
  'site.webmanifest',
  'assets/agent-roster-planner-hero.jpg',
]

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...await walk(full))
    else files.push(full)
  }
  return files
}

for (const file of required) {
  const info = await stat(new URL(file, root))
  if (!info.isFile() || info.size < 20) throw new Error('Required file missing or empty: ' + file)
}

const heroInfo = await stat(new URL('assets/agent-roster-planner-hero.jpg', root))
if (heroInfo.size > 1_000_000) throw new Error('Hero image is over 1MB: ' + heroInfo.size)

const product = JSON.parse(await readFile(new URL('product.json', root), 'utf8'))
if (!product.trustDataLedger || product.trustDataLedger.length < 3) throw new Error('trustDataLedger is incomplete')
if (product.gates.trust_data_gate !== 'pass' || product.gates.trust_content_gate !== 'pass') {
  throw new Error('Trust gates should pass locally')
}
if (product.repoFacts.agentMarkdownCount !== 233 || product.repoFacts.supportedToolCount !== 14) {
  throw new Error('Source facts changed unexpectedly; regenerate evidence intentionally')
}

const files = await walk(root.pathname)
const textFiles = files.filter((file) => /\.(html|txt|json|js|css|svg|webmanifest|xml)$/.test(file))
const bannedPublic = [
  /NOWPayments/i,
  /MiroFish/i,
  /internal requirement/i,
  /private path/i,
  /secret key/i,
  /\/Users\//,
  /API key/i,
]

for (const file of textFiles) {
  const text = await readFile(file, 'utf8')
  if (/[\u4e00-\u9fff]/.test(text)) throw new Error('Public file contains CJK text: ' + file)
  for (const pattern of bannedPublic) {
    if (pattern.test(text)) throw new Error('Public file contains banned/internal wording ' + pattern + ': ' + file)
  }
}

const htmlFiles = textFiles.filter((file) => file.endsWith('.html'))
for (const file of htmlFiles) {
  const text = await readFile(file, 'utf8')
  const h1Count = (text.match(/<h1\b/g) || []).length
  if (h1Count !== 1) throw new Error('HTML page must have exactly one H1: ' + file + ' saw ' + h1Count)
  const canonical = text.match(/<link rel="canonical" href="([^"]+)"/)?.[1]
  const ogUrl = text.match(/<meta property="og:url" content="([^"]+)"/)?.[1]
  if (!canonical || !ogUrl || canonical !== ogUrl) throw new Error('Canonical and og:url mismatch: ' + file)
  if (!canonical.startsWith(origin)) throw new Error('Canonical outside production origin: ' + file)
}

const pricing = await readFile(new URL('pricing/index.html', root), 'utf8')
for (const needle of [
  'Annual, 50% off',
  'Checkout Pro annual',
  '$174 due today',
  'does not renew automatically',
  'Paid API export for the full planning brief',
]) {
  if (!pricing.includes(needle)) throw new Error('Pricing missing expected copy: ' + needle)
}
if (/renews automatically/i.test(pricing)) throw new Error('Pricing contains auto-renewal wording')

const index = await readFile(new URL('index.html', root), 'utf8')
for (const needle of [
  'Assemble the right AI specialist team',
  '120,374',
  '233 agent files scanned',
  'agent-roster-planner-hero.jpg',
]) {
  if (!index.includes(needle)) throw new Error('Homepage missing expected copy: ' + needle)
}

const sourceNotes = await readFile(new URL('source-notes/index.html', root), 'utf8')
if (!sourceNotes.includes('Official Sources') || !sourceNotes.includes('rel="noopener noreferrer nofollow"')) {
  throw new Error('Source notes should isolate official links')
}

for (const file of htmlFiles) {
  if (file.endsWith('/source-notes/index.html')) continue
  const text = await readFile(file, 'utf8')
  const hrefs = Array.from(text.matchAll(/href="(https?:\/\/[^"]+)"/g)).map((match) => match[1])
  const external = hrefs.filter((href) => !href.startsWith(origin))
  if (external.length) throw new Error('External visible link outside source notes: ' + file + ' -> ' + external.join(', '))
}

const sitemap = await readFile(new URL('sitemap.xml', root), 'utf8')
const urlCount = (sitemap.match(/<url>/g) || []).length
if (urlCount < 19) throw new Error('Sitemap has too few URLs: ' + urlCount)
if (!sitemap.includes(origin + '/pricing/')) throw new Error('Sitemap missing pricing')

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8'
  if (file.endsWith('.css')) return 'text/css; charset=utf-8'
  if (file.endsWith('.js')) return 'application/javascript; charset=utf-8'
  if (file.endsWith('.json') || file.endsWith('.webmanifest')) return 'application/json; charset=utf-8'
  if (file.endsWith('.xml')) return 'application/xml; charset=utf-8'
  if (file.endsWith('.svg')) return 'image/svg+xml'
  if (file.endsWith('.jpg')) return 'image/jpeg'
  return 'text/plain; charset=utf-8'
}

const assetBinding = {
  async fetch(request) {
    const url = new URL(request.url)
    let route = decodeURIComponent(url.pathname)
    let file = route === '/' ? 'index.html' : route.replace(/^\//, '')
    if (file.endsWith('/')) file += 'index.html'
    try {
      const body = await readFile(new URL(file, root))
      return new Response(body, { status: 200, headers: { 'Content-Type': contentType(file) } })
    } catch {
      return new Response('not found', { status: 404 })
    }
  },
}

const env = { SITE_ASSETS: assetBinding }
let response = await handleRequest(new Request('http://127.0.0.1:8797/api/runtime'), env)
let json = await response.json()
if (!json.ok || json.defaultBilling !== 'annual' || json.paymentConfigured !== false || !json.pricing.pro) {
  throw new Error('Runtime API should expose honest pricing and missing checkout config')
}
if (/renews automatically/i.test(json.terms)) throw new Error('Runtime terms contain auto-renewal wording')

response = await handleRequest(new Request('http://127.0.0.1:8797/api/planner', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ projectType: 'saas', timelineWeeks: 4, launchChannels: 4, riskLevel: 'high', needsSecurity: 'yes', needsCompliance: 'no' }),
}), env)
json = await response.json()
if (response.status !== 402 || !json.paymentRequired || !json.preview || !json.pricingUrl) {
  throw new Error('Planner should return a 402 paid gate when no access token is configured')
}
if (!json.preview.roster.includes('Security Architect')) throw new Error('Planner preview should include security role when requested')

response = await handleRequest(new Request('http://127.0.0.1:8797/api/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ plan: 'pro', billing: 'annual' }),
}), env)
json = await response.json()
if (response.status !== 503 || json.paymentConfigured !== false || json.requiredSecret !== 'AGENCY_AGENTS_SPACE_CHECKOUT_PRO_ANNUAL') {
  throw new Error('Checkout should return explicit missing Polar configuration')
}

response = await handleRequest(new Request('http://127.0.0.1:8797/api/analytics', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ event: 'validation', path: '/' }),
}), env)
json = await response.json()
if (response.status !== 202 || json.stored !== false || json.sink !== 'missing_d1_binding') {
  throw new Error('Analytics should be honest about missing D1 binding')
}

const capturedAnalytics = []
const dbBinding = {
  prepare(sql) {
    if (!/insert into analytics_events/i.test(sql)) {
      throw new Error('Unexpected analytics SQL: ' + sql)
    }
    return {
      bind(event, pathValue, planId, billing, source, createdAt) {
        return {
          async run() {
            capturedAnalytics.push({ event, path: pathValue, planId, billing, source, createdAt })
            return { success: true }
          },
        }
      },
    }
  },
}

response = await handleRequest(new Request('http://127.0.0.1:8797/api/analytics', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event: 'validation_d1',
    path: '/pricing/',
    planId: 'pro',
    billing: 'annual',
    source: 'validate',
  }),
}), { ...env, DB: dbBinding })
json = await response.json()
if (
  response.status !== 202 ||
  json.stored !== true ||
  json.sink !== 'cloudflare_d1' ||
  capturedAnalytics.length !== 1 ||
  capturedAnalytics[0].event !== 'validation_d1' ||
  capturedAnalytics[0].path !== '/pricing/'
) {
  throw new Error('Analytics should write to the D1 binding when DB is configured')
}

response = await handleRequest(new Request('http://127.0.0.1:8797/missing-page'), env)
if (response.status !== 404) throw new Error('Unknown route should return 404')

console.log('Validated agency-agents.space: ' + htmlFiles.length + ' HTML pages, ' + textFiles.length + ' public text files, ' + urlCount + ' sitemap URLs, hero asset budget, paid gate, checkout blocker, analytics D1 blocker/write path, source-link isolation, and trust gates.')
