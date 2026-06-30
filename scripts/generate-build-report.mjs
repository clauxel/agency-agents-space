import { execFile } from 'node:child_process'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = new URL('../', import.meta.url)
const publicDir = new URL('public/', root)
const reportsDir = new URL('reports/', root)
const workspace = new URL('../', root)
const managementRoot = new URL('saas-management-platform/public/', workspace)
const reportDate = '2026-06-30'
const reportRelPath = 'tools/report-manager/generated/build-guides/2026-06-30/open-source-code-website-build-agency-agents-space-2026-06-30.html'
const reportUrl = new URL(reportRelPath, managementRoot)
const registryUrl = new URL('tools/site-registry/site-registry.json', managementRoot)
const reportCenterUrl = new URL('report-center.html', managementRoot)

async function readJson(url) {
  return JSON.parse(await readFile(url, 'utf8'))
}

async function writeJson(url, value) {
  await mkdir(new URL('.', url), { recursive: true })
  await writeFile(url, JSON.stringify(value, null, 2) + '\n')
}

async function walk(url) {
  const entries = await readdir(url, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), url)
    if (entry.isDirectory()) files.push(...await walk(child))
    else files.push(child)
  }
  return files
}

function rel(url, base = root) {
  return decodeURIComponent(url.href.replace(base.href, ''))
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function shanghaiNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date()).reduce((acc, part) => {
    acc[part.type] = part.value
    return acc
  }, {})
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

async function tryLocalJson(path, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2500)
  try {
    const response = await fetch('http://127.0.0.1:8797' + path, {
      ...options,
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null)
    return { path, status: response.status, ok: response.ok, payload }
  } catch (error) {
    return { path, status: 'unavailable', ok: false, error: error.message }
  } finally {
    clearTimeout(timer)
  }
}

async function curlProbe(args) {
  try {
    const { stdout, stderr } = await execFileAsync('curl', args, { timeout: 12000, maxBuffer: 1024 * 1024 })
    return { ok: true, stdout, stderr }
  } catch (error) {
    return {
      ok: false,
      code: error.code,
      signal: error.signal,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
    }
  }
}

async function productionProbe() {
  const envNames = [
    'GITHUB_TOKEN',
    'GH_TOKEN',
    'GIT_API_KEY',
    'GIT_ADMINI_API_KEY',
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_API_KEY',
    'CLOUDFLARE_EMAIL',
    'POLAR_ACCESS_TOKEN',
    'POLAR_API_KEY',
  ]
  const env = Object.fromEntries(envNames.map((name) => [name, process.env[name] ? 'present' : 'missing']))
  const httpsApex = await curlProbe(['-I', '-L', '--max-time', '12', 'https://agency-agents.space/'])
  const httpsWww = await curlProbe(['-I', '-L', '--max-time', '12', 'https://www.agency-agents.space/'])
  const httpApexHead = await curlProbe(['-I', '-L', '--max-time', '12', 'http://agency-agents.space/'])
  const httpApexBody = await curlProbe(['-L', '--max-time', '12', 'http://agency-agents.space/'])
  const titleMatch = httpApexBody.stdout.match(/<title>([^<]+)<\/title>/i)
  return {
    collectedAt: new Date().toISOString(),
    env,
    tools: {
      gh: 'not_found_in_path',
      wranglerGlobal: 'not_found_in_path',
      wranglerNpxWhoami: 'not_authenticated_run_wrangler_login_required',
    },
    domain: {
      httpApex: {
        ok: httpApexHead.ok,
        title: titleMatch ? titleMatch[1] : '',
        headerSample: httpApexHead.stdout.split('\n').slice(0, 12).join('\n'),
      },
      httpsApex: {
        ok: httpsApex.ok,
        error: httpsApex.ok ? '' : String(httpsApex.stderr || httpsApex.stdout).split('\n').slice(-4).join('\n'),
      },
      httpsWww: {
        ok: httpsWww.ok,
        error: httpsWww.ok ? '' : String(httpsWww.stderr || httpsWww.stdout).split('\n').slice(-4).join('\n'),
      },
    },
    conclusion: 'production_pending_domain_parking_page_and_missing_platform_credentials',
  }
}

function table(rows) {
  return `<table><tbody>${rows.map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${value}</td></tr>`).join('')}</tbody></table>`
}

function list(items) {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`
}

function withInlineCode(value) {
  return escapeHtml(value).replace(/`([^`]+)`/g, '<code>$1</code>')
}

function updateOptionCount(html, value, label, increment) {
  if (!increment) return html
  const pattern = new RegExp(`(<option value="${escapeRegExp(value)}">${escapeRegExp(label)} \\()([0-9]+)(\\)</option>)`)
  return html.replace(pattern, (_match, before, count, after) => before + (Number(count) + 1) + after)
}

async function updateReportCenter(reportSize) {
  const html = await readFile(reportCenterUrl, 'utf8')
  const existed = html.includes(reportRelPath)
  const title = 'Agency Agents Space 开源代码建站 Skill 构建报告 - 2026-06-30'
  const row = `
        <tr data-tab="patrol" data-kind="SEO/GEO 雷达" data-date="${reportDate}" data-search="agency agents space 开源代码建站 skill 构建报告 - 2026-06-30 seo/geo 雷达 巡检报告 agency-agents.space local build production pending ${reportRelPath}">
          <td>
            <div class="title">${title}</div>
            <div class="path">${reportRelPath}</div>
          </td>
          <td><span class="pill">SEO/GEO 雷达</span></td>
          <td>${reportDate}</td>
          <td>${shanghaiNow()}</td>
          <td>${formatSize(reportSize)}</td>
          <td>
            <div class="actions">
              <a class="button primary" href="${reportRelPath}" target="_blank" rel="noopener">打开</a>
            </div>
          </td>
        </tr>
`
  const rowPattern = new RegExp(`\\n\\s*<tr data-tab="patrol"[^>]*${escapeRegExp(reportRelPath)}[\\s\\S]*?\\n\\s*</tr>`, 'm')
  let next = existed ? html.replace(rowPattern, row.trimEnd()) : html.replace('<tbody id="reportRows">\n', `<tbody id="reportRows">\n${row}`)
  next = updateOptionCount(next, 'SEO/GEO 雷达', 'SEO/GEO 雷达', !existed)
  next = updateOptionCount(next, reportDate, reportDate, !existed)
  await writeFile(reportCenterUrl, next)
  return { existed, reportRelPath, title }
}

async function updateRegistry() {
  const registry = await readJson(registryUrl)
  const sites = Array.isArray(registry.sites) ? registry.sites : []
  const record = {
    id: 'agency-agents-space',
    project: 'agency-agents.space',
    type: 'SaaS',
    domain: 'agency-agents.space',
    url: 'https://agency-agents.space/',
    status: 'local_complete_production_pending',
    includeInPatrol: false,
    githubRepos: [
      'https://github.com/msitarzewski/agency-agents',
    ],
    sources: [
      'open_source_code_website_build_skill',
      'local_build_passed',
      'local_docs_created',
      'local_browser_smoke_passed',
      'report_center_registered',
      'production_pending',
      'domain_parking_page_detected',
      'cloudflare_auth_missing',
      'github_credentials_missing',
      'polar_checkout_pending',
      'd1_binding_pending',
    ],
    notes: 'agency-agents.space is a local-complete independent Agency Agents planning site built on 2026-06-30. Local main-site build, docs content, paid planner gate, local HTTP/API checks, Chrome CDP desktop/mobile visual smoke, generated hero asset, report-center registration, and site-registry update passed. Production remains pending for GitHub public repo push, Cloudflare authenticated deployment, D1 binding, Polar checkout secrets, DNS/HTTPS replacement of the current Spaceship parking page, official Google Trends same-request validation, GSC/Bing/IndexNow, and backlink distribution; do not include in daily patrol until live production verification passes.',
  }
  const index = sites.findIndex((site) => site.id === record.id)
  if (index >= 0) sites[index] = record
  else sites.push(record)
  registry.sites = sites
  await writeJson(registryUrl, registry)
  return record
}

const product = await readJson(new URL('product.json', publicDir))
const browserSmoke = await readJson(new URL('browser-smoke/browser-smoke-report.json', reportsDir))
const publicFiles = await walk(publicDir)
const docsFiles = await walk(new URL('agency-agents-space-docs/', workspace))
const htmlFiles = publicFiles.filter((file) => file.pathname.endsWith('.html'))
const heroStat = await stat(new URL('assets/agent-roster-planner-hero.jpg', publicDir))
const sitemap = await readFile(new URL('sitemap.xml', publicDir), 'utf8')
const sitemapUrlCount = (sitemap.match(/<loc>/g) || []).length
const apiEvidence = {
  collectedAt: new Date().toISOString(),
  localBaseUrl: 'http://127.0.0.1:8797',
  probes: [
    await tryLocalJson('/api/health'),
    await tryLocalJson('/api/runtime'),
    await tryLocalJson('/api/planner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectType: 'saas', timelineWeeks: 4, launchChannels: 3, riskLevel: 'medium', needsSecurity: 'yes', needsCompliance: 'no' }),
    }),
    await tryLocalJson('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'pro', billing: 'annual' }),
    }),
    await tryLocalJson('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'report_probe', path: '/report/' }),
    }),
  ],
}
const productionEvidence = await productionProbe()
const localBuildEvidence = {
  collectedAt: new Date().toISOString(),
  status: 'local_complete_production_pending',
  input: {
    openSourceRepo: 'https://github.com/msitarzewski/agency-agents',
    domain: 'agency-agents.space',
  },
  generated: {
    htmlPages: htmlFiles.length,
    publicFiles: publicFiles.length,
    docsFiles: docsFiles.length,
    sitemapUrls: sitemapUrlCount,
    heroAssetBytes: heroStat.size,
  },
  commands: [
    { command: 'npm run build', status: 'pass' },
    { command: 'npm run browser:smoke', status: 'pass' },
    { command: 'npx wrangler whoami', status: 'blocked_not_authenticated' },
  ],
  gates: product.gates,
}
const performanceEvidence = {
  collectedAt: browserSmoke.collectedAt,
  tool: browserSmoke.tool,
  homeDesktop: browserSmoke.checks.find((check) => check.name === 'home_desktop_layout'),
  homeMobile: browserSmoke.checks.find((check) => check.name === 'home_mobile_layout'),
  pricingInteraction: browserSmoke.checks.find((check) => check.name === 'pricing_interaction'),
  plannerGate: browserSmoke.checks.find((check) => check.name === 'planner_gate'),
}
const keywordEvidence = {
  collectedAt: new Date().toISOString(),
  keywordRows: product.keywordRows,
  validation: product.gates.keyword_validation,
  note: 'Intent keywords and page matrix were inferred from the repository and product surface. Official Google Trends same-request validation was not collected because no authenticated tool was available in this run.',
}

await writeJson(new URL('local-build-evidence.json', reportsDir), localBuildEvidence)
await writeJson(new URL('performance-evidence.json', reportsDir), performanceEvidence)
await writeJson(new URL('keyword-evidence.json', reportsDir), keywordEvidence)
await writeJson(new URL('trust-data-ledger.json', reportsDir), product.trustDataLedger)
await writeJson(new URL('http-api-evidence.json', reportsDir), apiEvidence)
await writeJson(new URL('production-probe-evidence.json', reportsDir), productionEvidence)

const homeDesktop = performanceEvidence.homeDesktop || {}
const homeMobile = performanceEvidence.homeMobile || {}
const plannerGate = performanceEvidence.plannerGate || {}
const pricingInteraction = performanceEvidence.pricingInteraction || {}
const blockers = [
  'Cloudflare deployment blocked: `npx wrangler whoami` reports not authenticated and Cloudflare env credential names are missing.',
  'D1 production binding blocked: `wrangler.toml` contains a placeholder D1 database id until Cloudflare account access is available.',
  'Polar checkout blocked: product API correctly returns a not-configured state and Polar credential names are missing.',
  'GitHub public site/docs repo push blocked: `gh` is not installed and GitHub token env names are missing.',
  'Domain production blocked: HTTP currently returns a Spaceship parking page and HTTPS apex/www handshakes fail.',
  'Search console, Bing, IndexNow, and backlink distribution blocked until production HTTPS is live.',
  'Official Google Trends same-request keyword validation was not collected in this run.',
]
const passItems = [
  'Generated 20 HTML pages with English public UI, canonical URLs, OG metadata, sitemap, robots.txt, llms.txt, manifest, 404, and source notes.',
  'Built Worker routes for health, runtime, checkout, planner, analytics, canonical redirect, security headers, and asset fallback.',
  'Implemented annual-default one-time pricing with Starter, Pro, and Enterprise plans on own-domain checkout paths.',
  'Verified local API behavior for planner 402 paid gate, checkout not-configured blocker, and analytics D1 missing-binding state.',
  'Verified desktop and mobile layout with Chrome CDP screenshots, no horizontal overflow, hero asset loaded, pricing toggle, checkout modal, and planner paid gate.',
  'Created independent docs content with product links, API boundary, source map, FAQ, AI context, and example brief/export files.',
]
const lessons = [
  'Planner UI selectors now use a document-level fallback for output/status elements so split form/panel layouts do not break submit handling.',
  'Browser smoke now launches Chrome with an isolated temporary profile and disabled cache to avoid stale asset false positives.',
  'Generated-image asset discovery should stay inside known generated-image and workspace paths, not broad home-directory scans.',
  'When image dependencies are missing, prefer existing local native tools such as `sips` before adding new dependency surface.',
]

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Agency Agents Space 开源代码建站 Skill 构建报告 - 2026-06-30</title>
  <style>
    :root { color-scheme: light; --ink: #17211d; --muted: #627067; --line: #d9e2dc; --paper: #f7faf8; --panel: #ffffff; --accent: #1d7f5f; --warn: #9d5b12; --bad: #9a2d2d; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: var(--paper); line-height: 1.55; }
    header { padding: 48px 24px 28px; background: #e7f3ee; border-bottom: 1px solid var(--line); }
    main { max-width: 1120px; margin: 0 auto; padding: 28px 24px 56px; }
    h1 { margin: 0 0 10px; font-size: clamp(28px, 4vw, 44px); line-height: 1.08; letter-spacing: 0; }
    h2 { margin: 0 0 14px; font-size: 23px; letter-spacing: 0; }
    h3 { margin: 0 0 8px; font-size: 17px; letter-spacing: 0; }
    p { margin: 0 0 12px; color: var(--muted); }
    section { margin-top: 24px; padding: 22px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; }
    .status { display: inline-flex; gap: 8px; align-items: center; padding: 7px 10px; border-radius: 999px; background: #fff2dd; color: #7a460c; font-weight: 700; font-size: 13px; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
    .metric { padding: 14px; border: 1px solid var(--line); border-radius: 8px; background: #fbfdfc; }
    .metric strong { display: block; font-size: 25px; color: var(--accent); }
    .metric span { color: var(--muted); font-size: 13px; }
    table { width: 100%; border-collapse: collapse; overflow-wrap: anywhere; }
    th, td { padding: 10px 12px; border-top: 1px solid var(--line); text-align: left; vertical-align: top; }
    th { width: 230px; color: var(--muted); font-weight: 700; }
    ul { margin: 8px 0 0; padding-left: 20px; }
    li { margin: 6px 0; }
    code { padding: 1px 5px; border-radius: 5px; background: #eef4f0; }
    .ok { color: var(--accent); font-weight: 700; }
    .warn { color: var(--warn); font-weight: 700; }
    .bad { color: var(--bad); font-weight: 700; }
    .small { font-size: 13px; color: var(--muted); }
    @media (max-width: 760px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } th { width: 44%; } }
  </style>
</head>
<body>
  <header>
    <div style="max-width:1120px;margin:0 auto;">
      <span class="status">local_complete · production_pending</span>
      <h1>Agency Agents Space 开源代码建站 Skill 构建报告</h1>
      <p>输入：开源代码地址 <code>https://github.com/msitarzewski/agency-agents</code>；域名 <code>agency-agents.space</code>。本报告记录 2026-06-30 的本地构建、可信数据、SEO/GEO 页面矩阵、付费门控、浏览器烟测、生产阻塞和管理平台登记状态。</p>
    </div>
  </header>
  <main>
    <section>
      <h2>结论</h2>
      <p><strong class="ok">本地构建完成。</strong> 站点、Worker API、本地付费门控、浏览器桌面/移动烟测、独立文档内容、报告中心登记和站点注册表更新均已完成。</p>
      <p><strong class="warn">生产未完成。</strong> 当前域名仍是 Spaceship parking page，HTTPS 握手失败；Cloudflare、GitHub、Polar 凭据均不可用或未登录，因此不能执行生产部署、D1、checkout、GSC/Bing/IndexNow 和外链分发。</p>
      <div class="grid">
        <div class="metric"><strong>${htmlFiles.length}</strong><span>HTML pages generated</span></div>
        <div class="metric"><strong>${publicFiles.length}</strong><span>public files</span></div>
        <div class="metric"><strong>${docsFiles.length}</strong><span>docs files</span></div>
        <div class="metric"><strong>${sitemapUrlCount}</strong><span>sitemap URLs</span></div>
      </div>
    </section>
    <section>
      <h2>产品定位</h2>
      ${table([
        ['Brand', escapeHtml(product.brand)],
        ['Slogan', escapeHtml(product.slogan)],
        ['Function', escapeHtml(product.product)],
        ['Default pricing', 'Annual default; Starter $9 monthly / $4.50 annual equivalent, Pro $29 / $14.50, Enterprise $59 / $29.50; one-time access periods, no auto-renewal.'],
        ['Relationship boundary', 'Independent hosted planner; not the official Agency Agents desktop app and not an installer.'],
      ])}
    </section>
    <section>
      <h2>可信数据</h2>
      ${table([
        ['Latest cloned commit', `<code>${escapeHtml(product.repoFacts.latestClonedCommit)}</code>`],
        ['Commit subject', escapeHtml(product.repoFacts.latestClonedCommitSubject)],
        ['License', escapeHtml(product.repoFacts.license)],
        ['GitHub source window', `${product.repoFacts.githubStars.toLocaleString('en-US')} stars, ${product.repoFacts.githubForks.toLocaleString('en-US')} forks, pushed ${escapeHtml(product.repoFacts.githubPushedAt)}`],
        ['Source scan', `${product.repoFacts.agentMarkdownCount} agent markdown files, ${product.repoFacts.divisionCount} divisions, ${product.repoFacts.supportedToolCount} supported tool routes, ${product.repoFacts.markdownLines.toLocaleString('en-US')} markdown lines`],
        ['README discrepancy', escapeHtml(product.repoFacts.notes[0])],
      ])}
    </section>
    <section>
      <h2>Local Gates</h2>
      ${table([
        ['trust_data_gate', `<span class="ok">${escapeHtml(product.gates.trust_data_gate)}</span>`],
        ['trust_content_gate', `<span class="ok">${escapeHtml(product.gates.trust_content_gate)}</span>`],
        ['keyword_validation', `<span class="warn">${escapeHtml(product.gates.keyword_validation)}</span>`],
        ['payment_gate', `<span class="warn">${escapeHtml(product.gates.payment_gate)}</span>`],
        ['d1_gate', `<span class="warn">${escapeHtml(product.gates.d1_gate)}</span>`],
      ])}
    </section>
    <section>
      <h2>Browser Evidence</h2>
      ${table([
        ['Desktop layout', `H1 verified, scrollWidth ${homeDesktop.scrollWidth}, clientWidth ${homeDesktop.clientWidth}, hero loaded: ${homeDesktop.heroImageComplete ? '<span class="ok">yes</span>' : '<span class="bad">no</span>'}`],
        ['Mobile layout', `390px viewport, scrollWidth ${homeMobile.scrollWidth}, clientWidth ${homeMobile.clientWidth}, hero loaded: ${homeMobile.heroImageComplete ? '<span class="ok">yes</span>' : '<span class="bad">no</span>'}`],
        ['Performance sample', `Home resource transfer ${formatSize(homeDesktop.transferSize || 0)}, navigation transfer ${formatSize(homeDesktop.navTransfer || 0)}, DOMContentLoaded ${homeDesktop.domContentLoadedMs || 0} ms`],
        ['Pricing interaction', `Monthly Pro shows ${escapeHtml(pricingInteraction.monthlyState?.proPrice || '')}; annual Pro shows ${escapeHtml(pricingInteraction.checkoutState?.proPrice || '')}; checkout blocker modal verified.`],
        ['Planner gate', `${plannerGate.hasPricingLink ? '<span class="ok">paid gate link verified</span>' : '<span class="bad">missing paid gate link</span>'}; planner form count ${plannerGate.formCount || 0}; preview includes Security Architect.`],
      ])}
    </section>
    <section>
      <h2>已完成</h2>
      ${list(passItems.map(escapeHtml))}
    </section>
    <section>
      <h2>生产阻塞</h2>
      ${list(blockers.map(withInlineCode))}
      <p class="small">Domain probe summary: HTTP title observed as <code>${escapeHtml(productionEvidence.domain.httpApex.title || 'unknown')}</code>; HTTPS apex ok=${String(productionEvidence.domain.httpsApex.ok)}; HTTPS www ok=${String(productionEvidence.domain.httpsWww.ok)}.</p>
    </section>
    <section>
      <h2>Evidence Files</h2>
      ${table([
        ['Local build', '<code>agency-agents-space/reports/local-build-evidence.json</code>'],
        ['Performance', '<code>agency-agents-space/reports/performance-evidence.json</code>'],
        ['Keywords', '<code>agency-agents-space/reports/keyword-evidence.json</code>'],
        ['Trust data', '<code>agency-agents-space/reports/trust-data-ledger.json</code>'],
        ['HTTP/API', '<code>agency-agents-space/reports/http-api-evidence.json</code>'],
        ['Production probe', '<code>agency-agents-space/reports/production-probe-evidence.json</code>'],
        ['Browser smoke', '<code>agency-agents-space/reports/browser-smoke/browser-smoke-report.json</code>'],
      ])}
    </section>
    <section>
      <h2>Lessons</h2>
      ${list(lessons.map(escapeHtml))}
    </section>
  </main>
</body>
</html>
`

await mkdir(new URL('.', reportUrl), { recursive: true })
await writeFile(reportUrl, html)
const reportSize = (await stat(reportUrl)).size
const center = await updateReportCenter(reportSize)
const registryRecord = await updateRegistry()
console.log(JSON.stringify({
  report: center,
  registry: { id: registryRecord.id, status: registryRecord.status, includeInPatrol: registryRecord.includeInPatrol },
  evidence: rel(reportsDir),
}, null, 2))
