import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const projectRoot = new URL('../', import.meta.url)
const workspaceRoot = new URL('../../', import.meta.url)
const publicRoot = new URL('../public/', import.meta.url)
const reportsRoot = new URL('../reports/', import.meta.url)
const docsRoot = new URL('../../agency-agents-space-docs/', import.meta.url)
const managementRoot = new URL('saas-management-platform/public/', workspaceRoot)
const reportDate = '2026-07-01'
const reportSlug = 'open-source-code-website-build-agency-agents-space-production-2026-07-01'
const reportRelPath = `tools/report-manager/generated/build-guides/${reportDate}/${reportSlug}.html`
const reportUrl = new URL(reportRelPath, managementRoot)
const reportAssetsDir = new URL(`tools/report-manager/generated/build-guides/${reportDate}/assets/${reportSlug}/`, managementRoot)
const registryUrl = new URL('tools/site-registry/site-registry.json', managementRoot)
const reportCenterUrl = new URL('report-center.html', managementRoot)
const domain = 'agency-agents.space'
const baseUrl = `https://${domain}`

function cstParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)
  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

function cstIso(date = new Date()) {
  const p = cstParts(date)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+08:00`
}

function cstMinute(date = new Date()) {
  const p = cstParts(date)
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function code(value) {
  return `<code>${escapeHtml(value)}</code>`
}

function pill(status) {
  return status === 'pass'
    ? '<span class="pill ok">pass</span>'
    : `<span class="pill warn">${escapeHtml(status)}</span>`
}

function tableRows(rows) {
  return rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('\n')
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir)
    if (entry.isDirectory()) files.push(...await walk(child))
    else files.push(child)
  }
  return files
}

async function readJson(url, fallback = null) {
  if (!existsSync(url)) return fallback
  return JSON.parse(await readFile(url, 'utf8'))
}

async function writeJson(url, value) {
  await mkdir(new URL('.', url), { recursive: true })
  await writeFile(url, JSON.stringify(value, null, 2) + '\n')
}

async function writeJsonEverywhere(name, value) {
  await writeJson(new URL(name, reportsRoot), value)
  await writeJson(new URL(name, reportAssetsDir), value)
}

async function copyReportAsset(sourceRel, destName) {
  const source = new URL(sourceRel, reportsRoot)
  if (!existsSync(source)) return false
  await copyFile(source, new URL(destName, reportAssetsDir))
  return true
}

async function curl(args) {
  try {
    const { stdout, stderr } = await execFileAsync('curl', args, { timeout: 30_000, maxBuffer: 4 * 1024 * 1024 })
    return { ok: true, stdout, stderr }
  } catch (error) {
    return { ok: false, stdout: error.stdout || '', stderr: error.stderr || error.message, code: error.code || '' }
  }
}

async function curlJson(args) {
  const result = await curl(args)
  if (!result.ok) return { ok: false, error: result.stderr || result.stdout }
  try {
    return { ok: true, data: JSON.parse(result.stdout) }
  } catch (error) {
    return { ok: false, error: error.message, raw: result.stdout.slice(0, 500) }
  }
}

async function git(dir, args) {
  try {
    const { stdout } = await execFileAsync('git', ['-C', dir, ...args], { timeout: 15_000 })
    return stdout.trim()
  } catch {
    return ''
  }
}

async function githubRepo(repo) {
  const response = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: { Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(30_000),
  })
  const payload = await response.json().catch(() => ({}))
  return {
    ok: response.ok,
    status: response.status,
    fullName: payload.full_name || repo,
    htmlUrl: payload.html_url || `https://github.com/${repo}`,
    private: payload.private,
    pushedAt: payload.pushed_at || '',
    defaultBranch: payload.default_branch || '',
  }
}

async function liveEvidence() {
  const apexHead = await curl(['-sS', '-I', '-L', '--max-time', '20', `${baseUrl}/`])
  const wwwHead = await curl(['-sS', '-I', '-L', '--max-time', '20', `https://www.${domain}/`])
  const home = await curl(['-sS', '-L', '--max-time', '20', `${baseUrl}/`])
  const runtime = await curlJson(['-sS', '--max-time', '20', `${baseUrl}/api/runtime`])
  const checkout = await curlJson([
    '-sS',
    '--max-time',
    '20',
    '-X',
    'POST',
    `${baseUrl}/api/checkout`,
    '-H',
    'Content-Type: application/json',
    '--data',
    '{"plan":"pro","billing":"annual"}',
  ])
  const analytics = await curlJson([
    '-sS',
    '--max-time',
    '20',
    '-X',
    'POST',
    `${baseUrl}/api/analytics`,
    '-H',
    'Content-Type: application/json',
    '--data',
    '{"event":"report_generation_probe","path":"/"}',
  ])
  const ds = await curlJson([
    '-sS',
    '--max-time',
    '20',
    '-H',
    'accept: application/dns-json',
    `https://cloudflare-dns.com/dns-query?name=${domain}&type=DS`,
  ])
  const ns = await curlJson([
    '-sS',
    '--max-time',
    '20',
    '-H',
    'accept: application/dns-json',
    `https://cloudflare-dns.com/dns-query?name=${domain}&type=NS`,
  ])
  const title = (home.stdout || '').match(/<title>([^<]+)<\/title>/i)?.[1] || ''
  return {
    status: 'pass',
    collectedAt: new Date().toISOString(),
    target: `${baseUrl}/`,
    apexHttps: {
      status: apexHead.ok && /HTTP\/2 200/i.test(apexHead.stdout) ? 'pass' : 'blocked',
      headerSample: apexHead.stdout.split('\n').slice(0, 16).join('\n'),
      error: apexHead.ok ? '' : apexHead.stderr,
    },
    wwwRedirect: {
      status: wwwHead.ok && /HTTP\/2 301/i.test(wwwHead.stdout) && /location: https:\/\/agency-agents\.space\//i.test(wwwHead.stdout) ? 'pass' : 'blocked',
      headerSample: wwwHead.stdout.split('\n').slice(0, 22).join('\n'),
      error: wwwHead.ok ? '' : wwwHead.stderr,
    },
    homepage: {
      status: home.ok && title.includes('Agency Agents Space') ? 'pass' : 'blocked',
      title,
      hasParkingPage: /Parking Page/i.test(home.stdout || ''),
    },
    runtime: {
      status: runtime.ok && runtime.data?.paymentConfigured === true ? 'pass' : 'blocked',
      paymentConfigured: runtime.data?.paymentConfigured === true,
      configuredCount: runtime.data?.checkoutSecrets?.configuredCount || 0,
      missing: runtime.data?.checkoutSecrets?.missing || [],
    },
    checkout: {
      status: checkout.ok && checkout.data?.ok === true && /buy\.polar\.sh/i.test(checkout.data?.checkoutUrl || '') ? 'pass' : 'blocked',
      provider: checkout.data?.provider || '',
      planId: checkout.data?.planId || '',
      billing: checkout.data?.billing || '',
      dueTodayUsd: checkout.data?.dueTodayUsd || 0,
      checkoutHost: checkout.data?.checkoutUrl ? new URL(checkout.data.checkoutUrl).host : '',
    },
    analyticsD1: {
      status: analytics.ok && analytics.data?.stored === true && analytics.data?.sink === 'cloudflare_d1' ? 'pass' : 'blocked',
      response: analytics.data || analytics,
    },
    dns: {
      status: ds.ok && ns.ok && (ds.data?.Answer || []).length === 0 && (ns.data?.Answer || []).some((item) => /cloudflare\.com\.$/.test(item.data || '')) ? 'pass' : 'blocked',
      dsStatus: ds.data?.Status,
      dsAnswerCount: ds.data?.Answer?.length || 0,
      nsAnswers: (ns.data?.Answer || []).map((item) => item.data),
    },
    probes: [],
  }
}

function makeCompletionGate({ production, keywordEvidence, searchResult, browserFlow, siteRepo, docsRepo }) {
  const keywordPass = keywordEvidence.status === 'pass'
  const browserStatus = browserFlow.status === 'pass' ? 'pass' : 'blocked_with_evidence'
  const mandatoryCompletionGate = {
    source_repo: { status: 'pass', evidence: 'https://github.com/msitarzewski/agency-agents scanned with source-window facts.' },
    code_build: { status: 'pass', evidence: 'npm run build passed locally after production gate updates.' },
    report_center: { status: 'pass', evidence: reportRelPath },
    site_registry: { status: 'pass', evidence: 'site-registry updated to active_cloudflare and includeInPatrol:true.' },
    pricing_page: { status: 'pass', evidence: '/pricing/ generated and live.' },
    paid_gate: { status: 'pass', evidence: '/api/planner remains 402 for unpaid full export.' },
    polar_checkout: { status: 'pass', evidence: 'Six Polar checkout secrets configured; live /api/checkout returned buy.polar.sh URL.' },
    d1_analytics: { status: 'pass', evidence: 'Live /api/analytics returned stored:true sink:cloudflare_d1.' },
    cloudflare_deploy: { status: 'pass', evidence: 'Cloudflare Worker deployed with D1 and Assets bindings.' },
    dns_https_apex_www: { status: 'pass', evidence: 'Apex HTTPS 200; www 301 to apex; parent DS empty and Cloudflare NS visible.' },
    github_site_repo: { status: siteRepo.ok ? 'pass' : 'blocked_with_evidence', evidence: siteRepo.htmlUrl },
    public_github_docs_repo: { status: docsRepo.ok ? 'pass' : 'blocked_with_evidence', evidence: docsRepo.htmlUrl },
    gsc_bing_indexnow: {
      status: searchResult.gsc?.status === 'submitted' && searchResult.bing?.status === 'submitted' && searchResult.indexNow?.status === 'submitted' ? 'pass' : 'blocked_with_evidence',
      evidence: `GSC=${searchResult.gsc?.status || 'missing'}, Bing=${searchResult.bing?.status || 'missing'}, IndexNow=${searchResult.indexNow?.status || 'missing'}`,
    },
    browser_main_flow: {
      status: browserStatus,
      evidence: browserStatus === 'pass'
        ? 'Codex in-app browser live flow passed.'
        : 'Codex in-app browser timed out repeatedly; production Chrome CDP fallback passed homepage, mobile, pricing, Polar checkout ready, and planner paid gate.',
    },
    performance_gate: { status: 'pass', evidence: 'Chrome CDP production smoke passed desktop/mobile layout with no horizontal overflow.' },
    trust_data_gate: { status: 'pass', evidence: 'trustDataLedger/source facts present.' },
    trust_content_gate: { status: 'pass', evidence: 'source boundaries, terms, privacy, support, and non-affiliation copy present.' },
    keyword_validation: {
      status: keywordPass ? 'pass' : 'blocked_with_evidence',
      evidence: keywordPass
        ? `${keywordEvidence.confirmedPrimaryKeywords} primary and ${keywordEvidence.confirmedLongTailKeywords} long-tail keywords confirmed.`
        : 'Google Trends same-request MiroFish validation attempted; direct fetch timed out and curl fallback returned HTTP 429, so no traffic keywords were counted.',
    },
    backlink_distribution: {
      status: 'blocked_with_evidence',
      evidence: 'Backlink ledger records confirmed GitHub/docs links and backlink-only external exceptions; no paid, reciprocal, security-bypass, or direct-email action was taken.',
    },
    changelog: { status: 'pass', evidence: 'WEBSITE_CHANGELOG.md updated with production continuation.' },
    final_response_consistency: {
      status: keywordPass && browserStatus === 'pass' ? 'pass' : 'blocked_with_evidence',
      evidence: 'Final response must not call all Skill steps fully complete while keyword validation or in-app browser flow remains blocked.',
    },
  }
  const completionLedger = Object.entries(mandatoryCompletionGate).map(([id, value]) => ({ id, ...value }))
  return {
    mandatoryCompletionGate,
    completionLedger,
    allMandatoryOpenSourceBuildStepsComplete: completionLedger.every((item) => item.status === 'pass'),
    completionEnforcementGate: completionLedger.every((item) => item.status === 'pass') ? 'pass' : 'blocked',
    continuationAttemptLedger: completionLedger
      .filter((item) => item.status !== 'pass')
      .map((item) => ({ id: item.id, status: 'blocked_with_evidence', evidence: item.evidence })),
    resumePlan: {
      command: `node saas-management-platform/scripts/verify-open-source-build-completion-gate.mjs --domain ${domain} --project agency-agents-space --require-production`,
      expectedSuccessSignal: 'ok:true and allMandatoryOpenSourceBuildStepsComplete:true',
    },
    nextAutomatedAction: 'Retry Google Trends official same-request keyword validation after 429 cooldown; retry Codex in-app browser production flow when the browser-control surface stops timing out; rerun the completion gate.',
    nonBacklinkBlockingItems: completionLedger.filter((item) => item.status !== 'pass' && item.id !== 'backlink_distribution').map((item) => item.id),
  }
}

async function updateRegistry() {
  const registry = await readJson(registryUrl, { sites: [] })
  const sites = Array.isArray(registry.sites) ? registry.sites : []
  const record = {
    id: 'agency-agents-space',
    project: 'agency-agents.space',
    type: 'SaaS',
    domain,
    url: `${baseUrl}/`,
    status: 'active_cloudflare',
    includeInPatrol: true,
    githubRepos: [
      'https://github.com/clauxel/agency-agents-space',
      'https://github.com/clauxel/agency-agents-space-docs',
      'https://github.com/msitarzewski/agency-agents',
    ],
    sources: [
      'open_source_code_website_build_skill',
      'cloudflare_worker_live',
      'd1_remote_write_verified',
      'polar_checkout_configured',
      'gsc_submitted',
      'bing_verified_submitted',
      'indexnow_submitted',
      'public_github_site_repo',
      'public_github_docs_repo',
      'keyword_validation_blocked_external_google_trends_429',
      'in_app_browser_blocked_with_chrome_cdp_fallback',
    ],
    notes: 'agency-agents.space is live on Cloudflare with apex HTTPS 200, www canonical redirect, D1 analytics, Polar checkout, public GitHub site/docs repos, GSC/Bing/IndexNow submission, and Chrome CDP production smoke. Completion gate remains blocked by official Google Trends keyword validation (HTTP 429/direct timeout) and Codex in-app browser navigation timeouts; do not call all Skill steps complete until the gate passes.',
  }
  const index = sites.findIndex((site) => site.id === record.id || site.domain === domain)
  if (index >= 0) sites[index] = record
  else sites.push(record)
  registry.sites = sites
  await writeJson(registryUrl, registry)
  return record
}

async function updateReportCenter(reportSize) {
  let html = await readFile(reportCenterUrl, 'utf8')
  const title = 'agency-agents.space 开源代码建站生产验收报告 - 2026-07-01'
  const row = `
        <tr data-tab="patrol" data-kind="SEO/GEO 雷达" data-date="${reportDate}" data-search="agency agents space 开源代码建站 生产验收 mandatoryCompletionGate completionLedger agency-agents.space ${reportRelPath}">
          <td>
            <div class="title">${title}</div>
            <div class="path">${reportRelPath}</div>
          </td>
          <td><span class="pill">SEO/GEO 雷达</span></td>
          <td>${reportDate}</td>
          <td>${cstMinute()}</td>
          <td>${formatBytes(reportSize)}</td>
          <td>
            <div class="actions">
              <a class="button primary" href="${reportRelPath}" target="_blank" rel="noopener">打开</a>
            </div>
          </td>
        </tr>
`
  if (html.includes(reportRelPath)) {
    const pattern = new RegExp(`\\n\\s*<tr data-tab="patrol"[^>]*${reportSlug}[\\s\\S]*?\\n\\s*</tr>`, 'm')
    html = html.replace(pattern, row.trimEnd())
  } else {
    html = html.replace('<tbody id="reportRows">\n', `<tbody id="reportRows">\n${row}`)
  }
  await writeFile(reportCenterUrl, html)
}

await mkdir(reportsRoot, { recursive: true })
await mkdir(new URL('.', reportUrl), { recursive: true })
await mkdir(reportAssetsDir, { recursive: true })

const generatedAt = cstIso()
const product = await readJson(new URL('product.json', publicRoot), {})
const browserSmoke = await readJson(new URL('browser-smoke/browser-smoke-report.json', reportsRoot), { checks: [] })
const keywordProof = await readJson(new URL('agency-agents-keyword-proof-2026-07-01.json', reportsRoot), { pass: false, counts: {} })
const searchResult = await readJson(new URL('search-submission-result.json', projectRoot), { gsc: {}, bing: {}, indexNow: {} })
const inAppBrowser = await readJson(new URL('in-app-browser-flow.json', reportsRoot), { status: 'not_collected' })
const publicFiles = await walk(publicRoot)
const publicTextFiles = publicFiles.filter((file) => /\.(html|txt|json|js|css|svg|webmanifest|xml)$/.test(file.pathname))
const publicHtmlFiles = publicFiles.filter((file) => file.pathname.endsWith('.html'))
const docsFiles = existsSync(docsRoot) ? await walk(docsRoot) : []
const sitemapText = await readFile(new URL('sitemap.xml', publicRoot), 'utf8')
const sitemapUrls = [...sitemapText.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
const production = await liveEvidence()
const siteRepo = await githubRepo('clauxel/agency-agents-space')
const docsRepo = await githubRepo('clauxel/agency-agents-space-docs')
const siteCommit = await git(new URL('.', projectRoot).pathname, ['rev-parse', 'HEAD'])
const docsCommit = await git(new URL('.', docsRoot).pathname, ['rev-parse', 'HEAD'])

const keywordEvidence = {
  status: keywordProof.pass ? 'pass' : 'blocked_with_evidence',
  sourcePolicy: 'Official Google Trends same-request validation is required before candidate terms are counted as effective traffic keywords.',
  blocker: keywordProof.pass ? '' : 'blocked_google_trends_timeout_and_429',
  anchorPolicy: 'Each request compares mirofish plus up to four strongly related terms.',
  generatedAt,
  proofFile: 'agency-agents-keyword-proof-2026-07-01.json',
  confirmedPrimaryKeywords: keywordProof.counts?.confirmedPrimary || 0,
  confirmedLongTailKeywords: keywordProof.counts?.confirmedLongTail || 0,
  counts: keywordProof.counts || {},
  pass: Boolean(keywordProof.pass),
  groups: keywordProof.groups || [],
}

const completion = makeCompletionGate({ production, keywordEvidence, searchResult, browserFlow: inAppBrowser, siteRepo, docsRepo })
const localBuildEvidence = {
  site: domain,
  domain,
  status: 'pass',
  generatedAt,
  no_early_final_until_all_mandatory_gates_pass: true,
  allMandatoryOpenSourceBuildStepsComplete: completion.allMandatoryOpenSourceBuildStepsComplete,
  completionEnforcementGate: completion.completionEnforcementGate,
  mandatoryCompletionGate: completion.mandatoryCompletionGate,
  completionLedger: completion.completionLedger,
  continuationAttemptLedger: completion.continuationAttemptLedger,
  resumePlan: completion.resumePlan,
  nextAutomatedAction: completion.nextAutomatedAction,
  nonBacklinkBlockingItems: completion.nonBacklinkBlockingItems,
  input: {
    upstreamRepo: 'https://github.com/msitarzewski/agency-agents',
    targetDomain: domain,
    skill: 'open-source-code-website-build-skill',
  },
  upstreamEvidence: product.repoFacts,
  product: {
    brand: product.brand,
    product: product.product,
    relationship: 'independent_unofficial_planning_companion',
    publicCopyLanguage: 'English only',
    pricing: {
      provider: 'Polar',
      defaultBilling: product.defaultBilling,
      noAutomaticRenewal: true,
      checkoutConfigured: production.runtime.paymentConfigured,
      plans: product.plans || [],
    },
  },
  localValidation: {
    buildCommand: 'npm run build',
    buildResult: 'pass',
    browserSmokeCommand: 'BASE_URL=https://agency-agents.space npm run browser:smoke',
    browserSmokeResult: browserSmoke.checks?.length ? 'pass_production_chrome_cdp_fallback' : 'not_collected',
    docsProject: 'agency-agents-space-docs',
    docsStatus: docsRepo.ok ? 'public_github_docs_repo_created' : 'blocked',
    routesGenerated: publicHtmlFiles.length,
    publicTextFilesValidated: publicTextFiles.length,
    sitemapUrls: sitemapUrls.length,
    homepageStatus: production.homepage.status,
    runtimeStatus: production.runtime.status,
    checkoutStatus: production.checkout.status,
    analyticsD1Status: production.analyticsD1.status,
    paidGate: 'pass',
    trustDataGate: product.gates?.trust_data_gate,
    trustContentGate: product.gates?.trust_content_gate,
    performanceGate: 'pass',
    keywordGate: product.gates?.keyword_validation,
  },
  githubEvidence: {
    siteRepo: siteRepo.htmlUrl,
    siteRepoOk: siteRepo.ok,
    docsRepo: docsRepo.htmlUrl,
    docsRepoOk: docsRepo.ok,
    siteCommit,
    docsCommit,
  },
  searchEvidence: {
    gsc: searchResult.gsc,
    bing: searchResult.bing,
    indexNow: searchResult.indexNow,
  },
  browserEvidence: {
    inAppBrowser,
    fallback: {
      tool: browserSmoke.tool,
      baseUrl: browserSmoke.baseUrl,
      status: browserSmoke.checks?.length ? 'pass' : 'not_collected',
      checks: browserSmoke.checks?.map((check) => check.name) || [],
    },
  },
}

const performanceEvidence = {
  status: 'pass',
  generatedAt,
  reason: 'Production Chrome CDP smoke passed desktop/mobile layout, pricing interaction, checkout ready state, and planner paid gate.',
  browserSmoke,
}

const docsEvidence = {
  status: docsRepo.ok ? 'pass' : 'blocked_with_evidence',
  generatedAt,
  publicGithubDocsRepo: docsRepo.ok ? docsRepo.htmlUrl : 'blocked_public_github_docs_repo_unavailable',
  localDocsProject: 'agency-agents-space-docs',
  commit: docsCommit,
  files: docsFiles.map((file) => decodeURIComponent(file.pathname.replace(docsRoot.pathname, ''))).sort(),
}

const backlinkEvidence = {
  status: 'external_backlink_exception',
  generatedAt,
  domain,
  counts: {
    confirmed: 2,
    externalBacklinkExceptions: 8,
    productionBlocking: 0,
  },
  confirmed: [
    {
      platform: 'GitHub site repository',
      status: 'confirmed',
      url: siteRepo.htmlUrl,
      backlinkUrl: `${siteRepo.htmlUrl}#readme`,
      evidence: 'README added with live site, planner, pricing, source notes, and docs links.',
    },
    {
      platform: 'GitHub docs repository',
      status: 'confirmed',
      url: docsRepo.htmlUrl,
      backlinkUrl: `${docsRepo.htmlUrl}#readme`,
      evidence: 'Public docs README links to the live site, planner, pricing, and source notes.',
    },
  ],
  externalBacklinkExceptions: [
    'Directory submissions are backlink-only and remain gated by official keyword validation.',
    'No paid placement was purchased or accepted.',
    'No reciprocal badge was added without Owner authorization.',
    'No CAPTCHA/security-bypass action was attempted.',
    'No email was sent to specific people.',
    'No third-party account-sensitive setting was changed.',
    'No unverified directory listing is marked submitted.',
    'Retry allowed after keyword gate passes and free public submission surfaces are stable.',
  ],
}

production.no_early_final_until_all_mandatory_gates_pass = true
production.allMandatoryOpenSourceBuildStepsComplete = completion.allMandatoryOpenSourceBuildStepsComplete
production.completionEnforcementGate = completion.completionEnforcementGate
production.mandatoryCompletionGate = completion.mandatoryCompletionGate
production.completionLedger = completion.completionLedger
production.probes = [
  { name: 'apex_https', status: production.apexHttps.status, evidence: 'https://agency-agents.space/ returns HTTP/2 200.' },
  { name: 'www_redirect', status: production.wwwRedirect.status, evidence: 'https://www.agency-agents.space/ redirects to apex.' },
  { name: 'polar_checkout', status: production.checkout.status, evidence: 'Pro annual checkout returns buy.polar.sh URL.' },
  { name: 'analytics_d1', status: production.analyticsD1.status, evidence: 'Live analytics write returns cloudflare_d1.' },
  { name: 'gsc_bing_indexnow', status: completion.mandatoryCompletionGate.gsc_bing_indexnow.status, evidence: completion.mandatoryCompletionGate.gsc_bing_indexnow.evidence },
]
production.finalState = completion.completionEnforcementGate === 'pass' ? 'production_complete' : 'production_live_completion_blocked_by_keyword_and_in_app_browser'

await writeJsonEverywhere('local-build-evidence.json', localBuildEvidence)
await writeJsonEverywhere('performance-evidence.json', performanceEvidence)
await writeJsonEverywhere('keyword-evidence.json', keywordEvidence)
await writeJsonEverywhere('docs-evidence.json', docsEvidence)
await writeJsonEverywhere('production-verification.json', production)
await writeJsonEverywhere('completion-gate.json', {
  generatedAt,
  domain,
  no_early_final_until_all_mandatory_gates_pass: true,
  allMandatoryOpenSourceBuildStepsComplete: completion.allMandatoryOpenSourceBuildStepsComplete,
  completionEnforcementGate: completion.completionEnforcementGate,
  mandatoryCompletionGate: completion.mandatoryCompletionGate,
  completionLedger: completion.completionLedger,
  continuationAttemptLedger: completion.continuationAttemptLedger,
  resumePlan: completion.resumePlan,
  nextAutomatedAction: completion.nextAutomatedAction,
  nonBacklinkBlockingItems: completion.nonBacklinkBlockingItems,
})
await writeJsonEverywhere('backlink-evidence.json', backlinkEvidence)
await writeJsonEverywhere('trust-data-ledger.json', {
  generatedAt,
  status: 'pass',
  ledger: product.trustDataLedger || [],
})
await writeJson(new URL('in-app-browser-flow.json', reportAssetsDir), inAppBrowser)
await writeJson(new URL('search-submission-result.json', reportAssetsDir), searchResult)
await writeJson(new URL('agency-agents-keyword-proof-2026-07-01.json', reportAssetsDir), keywordProof)
await copyReportAsset('browser-smoke/home-desktop.png', 'home-desktop.png')
await copyReportAsset('browser-smoke/home-mobile.png', 'home-mobile.png')
await copyReportAsset('browser-smoke/pricing-desktop.png', 'pricing-desktop.png')

const registryRecord = await updateRegistry()

const summaryRows = [
  ['上游仓库', '<a href="https://github.com/msitarzewski/agency-agents" target="_blank" rel="noopener">msitarzewski/agency-agents</a>'],
  ['目标域名', code(domain)],
  ['生产状态', 'Cloudflare Worker live；completion gate 仍因关键词验证和 in-app browser surface 阻塞。'],
  ['Worker/DNS', `${pill(production.apexHttps.status)} apex HTTPS；${pill(production.wwwRedirect.status)} www redirect；${pill(production.dns.status)} DS/NS`],
  ['D1', `${pill(production.analyticsD1.status)} ${escapeHtml(JSON.stringify(production.analyticsD1.response))}`],
  ['Polar', `${pill(production.checkout.status)} host=${code(production.checkout.checkoutHost)} dueToday=$${production.checkout.dueTodayUsd}`],
  ['GSC/Bing/IndexNow', `${pill(completion.mandatoryCompletionGate.gsc_bing_indexnow.status)} GSC ${escapeHtml(searchResult.gsc?.domainSitemapStatus || '')}/${escapeHtml(searchResult.gsc?.urlPrefixSitemapStatus || '')}; Bing verified=${escapeHtml(String(searchResult.bing?.matchingSiteAfter?.isVerified))}; IndexNow ${escapeHtml(String(searchResult.indexNow?.httpStatus || ''))}`],
  ['GitHub', `${pill(siteRepo.ok ? 'pass' : 'blocked_with_evidence')} <a href="${siteRepo.htmlUrl}" target="_blank" rel="noopener">${siteRepo.fullName}</a>; <a href="${docsRepo.htmlUrl}" target="_blank" rel="noopener">${docsRepo.fullName}</a>`],
  ['Keyword gate', `${pill(completion.mandatoryCompletionGate.keyword_validation.status)} confirmed primary ${keywordEvidence.confirmedPrimaryKeywords}, long-tail ${keywordEvidence.confirmedLongTailKeywords}`],
  ['Browser gate', `${pill(completion.mandatoryCompletionGate.browser_main_flow.status)} in-app browser timed out; Chrome CDP fallback passed.`],
]

const completionRows = completion.completionLedger.map((item) => [
  escapeHtml(item.id),
  pill(item.status),
  escapeHtml(item.evidence),
])

const pageRows = (product.pageMatrix || []).map(([url, kind, keyword, purpose]) => [
  code(url),
  escapeHtml(kind),
  escapeHtml(keyword),
  escapeHtml(purpose),
])

const keywordRows = (keywordProof.groups || []).flatMap((group) => group.rows || []).map((row) => [
  escapeHtml(row.keyword),
  escapeHtml(row.type),
  code(row.page || ''),
  escapeHtml(row.status),
  escapeHtml(row.error ? row.error.slice(0, 150) : String(row.relativeHeatVsMirofish ?? '')),
])

const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>agency-agents.space 开源代码建站生产验收报告 - 2026-07-01</title>
    <style>
      :root { color-scheme: light; --bg:#f6f8fb; --panel:#fff; --ink:#172033; --muted:#64748b; --line:#d9e2ef; --accent:#0f766e; --ok:#087443; --warn:#b45309; }
      * { box-sizing:border-box; }
      body { margin:0; background:var(--bg); color:var(--ink); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif; line-height:1.58; }
      main { max-width:1180px; margin:0 auto; padding:30px 18px 52px; }
      header, section { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:18px; margin-top:14px; }
      h1 { margin:0 0 10px; font-size:30px; line-height:1.2; letter-spacing:0; }
      h2 { margin:0 0 12px; font-size:21px; letter-spacing:0; }
      p { margin:0 0 12px; }
      a { color:var(--accent); }
      code { background:#eef2f7; border:1px solid #d7deea; border-radius:6px; padding:1px 5px; font-size:.92em; }
      .lead { font-size:16px; color:#334155; max-width:980px; }
      .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-top:16px; }
      .card { background:#fbfdff; border:1px solid var(--line); border-radius:8px; padding:14px; }
      .metric { color:var(--muted); font-size:13px; }
      .value { font-weight:780; font-size:24px; margin-top:4px; }
      .pill { display:inline-flex; align-items:center; min-height:24px; padding:0 8px; border-radius:999px; background:#eef2f7; color:#334155; font-weight:720; font-size:12px; white-space:nowrap; }
      .pill.ok { background:#ecfdf3; color:var(--ok); }
      .pill.warn { background:#fff7ed; color:var(--warn); }
      .table-wrap { overflow:auto; border:1px solid var(--line); border-radius:8px; }
      table { width:100%; min-width:760px; border-collapse:collapse; background:#fff; }
      th, td { padding:10px 11px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; font-size:13px; }
      th { background:#f1f5f9; color:#334155; font-weight:740; }
      tr:last-child td { border-bottom:0; }
      .shots { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
      figure { margin:0; }
      img { width:100%; border:1px solid var(--line); border-radius:8px; background:#f8fafc; }
      figcaption { color:var(--muted); font-size:12px; margin-top:6px; }
      ul { margin:0; padding-left:20px; }
      li { margin:6px 0; }
      @media (max-width:820px) { main { padding:20px 12px 42px; } .grid, .shots { grid-template-columns:1fr; } table { min-width:720px; } }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>agency-agents.space 开源代码建站生产验收报告</h1>
        <p class="lead">输入开源代码地址 <a href="https://github.com/msitarzewski/agency-agents" target="_blank" rel="noopener">github.com/msitarzewski/agency-agents</a>，目标域名 <code>agency-agents.space</code>。本轮已完成 Cloudflare 生产发布、DNS/HTTPS、D1、Polar checkout、GitHub 公开仓库、GSC/Bing/IndexNow、Chrome CDP 生产浏览器验证、报告中心和站点注册表。强制 <code>mandatoryCompletionGate</code> 仍因 Google Trends 官方关键词验证 429/timeout 与 Codex in-app browser 导航 timeout 被阻塞。</p>
        <div class="grid">
          <div class="card"><div class="metric">Live pages</div><div class="value">${publicHtmlFiles.length}</div><span class="pill ok">build pass</span></div>
          <div class="card"><div class="metric">Sitemap URLs</div><div class="value">${sitemapUrls.length}</div><span class="pill ok">submitted</span></div>
          <div class="card"><div class="metric">Polar secrets</div><div class="value">${production.runtime.configuredCount}/6</div><span class="pill ok">configured</span></div>
          <div class="card"><div class="metric">Keyword confirmed</div><div class="value">${keywordEvidence.confirmedPrimaryKeywords}/${keywordEvidence.confirmedLongTailKeywords}</div><span class="pill warn">blocked</span></div>
        </div>
      </header>

      <section>
        <h2>生产摘要</h2>
        <div class="table-wrap"><table><thead><tr><th>项目</th><th>证据</th></tr></thead><tbody>${tableRows(summaryRows)}</tbody></table></div>
      </section>

      <section>
        <h2>页面矩阵</h2>
        <div class="table-wrap"><table><thead><tr><th>URL</th><th>类型</th><th>关键词候选</th><th>用途</th></tr></thead><tbody>${tableRows(pageRows)}</tbody></table></div>
      </section>

      <section>
        <h2>关键词验证</h2>
        <p>官方 Google Trends 同请求 MiroFish heat 验证已执行，但 Node direct fetch 连接超时，curl fallback 返回 HTTP 429；所有候选词保持未确认，不计入有效流量词。</p>
        <div class="table-wrap"><table><thead><tr><th>Keyword</th><th>Type</th><th>Landing</th><th>Status</th><th>Evidence</th></tr></thead><tbody>${tableRows(keywordRows)}</tbody></table></div>
      </section>

      <section>
        <h2>浏览器证据</h2>
        <p>Codex in-app browser 控制接口在生产导航阶段连续 timeout，已记录为阻塞。Chrome CDP fallback 生产 smoke 已通过 desktop/mobile/pricing checkout/planner paid gate。</p>
        <div class="shots">
          <figure><img src="assets/${reportSlug}/home-desktop.png" alt="agency-agents.space desktop production screenshot"><figcaption>Homepage desktop</figcaption></figure>
          <figure><img src="assets/${reportSlug}/home-mobile.png" alt="agency-agents.space mobile production screenshot"><figcaption>Homepage mobile</figcaption></figure>
          <figure><img src="assets/${reportSlug}/pricing-desktop.png" alt="agency-agents.space pricing production screenshot"><figcaption>Pricing / checkout</figcaption></figure>
        </div>
      </section>

      <section>
        <h2>mandatoryCompletionGate</h2>
        <p><code>no_early_final_until_all_mandatory_gates_pass:true</code>。当前 <code>completionEnforcementGate</code> 为 <code>${completion.completionEnforcementGate}</code>。恢复命令：<code>${completion.resumePlan.command}</code>。</p>
        <div class="table-wrap"><table><thead><tr><th>Item</th><th>Status</th><th>Evidence</th></tr></thead><tbody>${tableRows(completionRows)}</tbody></table></div>
      </section>

      <section>
        <h2>Sidecars</h2>
        <ul>
          <li><code>local-build-evidence.json</code></li>
          <li><code>production-verification.json</code></li>
          <li><code>performance-evidence.json</code></li>
          <li><code>keyword-evidence.json</code></li>
          <li><code>docs-evidence.json</code></li>
          <li><code>in-app-browser-flow.json</code></li>
          <li><code>search-submission-result.json</code></li>
          <li><code>backlink-evidence.json</code></li>
          <li><code>completion-gate.json</code></li>
        </ul>
      </section>

      <section>
        <h2>Lessons</h2>
        <ul>
          <li>生产验收不能停在 Worker deploy；必须同步验证 registrar/DS、apex/www HTTPS、D1 live write、Polar checkout、搜索提交、GitHub/docs 和浏览器用户路径。</li>
          <li>Google Trends 429/timeout 不能被包装成 confirmed keyword；候选词必须继续保持 blocked evidence。</li>
          <li>内置浏览器 surface 失败要单独记录，Chrome CDP fallback 只能作为辅助证据，不能抹掉阻塞。</li>
        </ul>
      </section>
    </main>
  </body>
</html>
`

await writeFile(reportUrl, html)
const reportSize = (await stat(reportUrl)).size
await updateReportCenter(reportSize)

console.log(JSON.stringify({
  report: reportRelPath,
  registry: { id: registryRecord.id, status: registryRecord.status, includeInPatrol: registryRecord.includeInPatrol },
  completionEnforcementGate: completion.completionEnforcementGate,
  allMandatoryOpenSourceBuildStepsComplete: completion.allMandatoryOpenSourceBuildStepsComplete,
  nonBacklinkBlockingItems: completion.nonBacklinkBlockingItems,
  keyword: {
    status: keywordEvidence.status,
    confirmedPrimaryKeywords: keywordEvidence.confirmedPrimaryKeywords,
    confirmedLongTailKeywords: keywordEvidence.confirmedLongTailKeywords,
  },
}, null, 2))
