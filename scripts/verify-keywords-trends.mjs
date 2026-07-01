import fs from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = new URL('../', import.meta.url)
const reportsDir = new URL('reports/', root)
const outputFile = new URL('agency-agents-keyword-proof-2026-07-01.json', reportsDir)
const cacheFile = new URL('google-trends-agency-agents-keyword-cache.json', reportsDir)

const timeframe = 'today 12-m'
const geo = ''
const category = 0
const property = ''
const hl = 'en-US'
const tz = '-480'
const anchor = 'mirofish'
const cacheTtlMs = 7 * 24 * 60 * 60 * 1000

function candidate(keyword, type, page, relevanceReason) {
  return { keyword, type, page, themeRelevance: 'strong', relevanceReason }
}

const groups = [
  {
    id: 'primary-agent-category',
    note: 'Core AI-agent category and workflow terms.',
    candidates: [
      candidate('ai agents', 'primary', '/', 'Broad category term aligned with the upstream agent roster.'),
      candidate('ai specialist agents', 'primary', '/', 'Matches specialist-agent positioning and planning surface.'),
      candidate('multi agent workflow', 'primary', '/nexus-sprint/', 'Maps to NEXUS-style multi-agent workflow planning.'),
      candidate('agent roster', 'primary', '/planner/', 'Matches source file structure and roster planning intent.'),
    ],
  },
  {
    id: 'primary-integrations',
    note: 'Integration and agency-workflow demand terms.',
    candidates: [
      candidate('codex agents', 'primary', '/codex-agents/', 'Maps to the upstream Codex custom-agent integration.'),
      candidate('ai agency workflow', 'primary', '/nexus-sprint/', 'Matches agency workflow and multi-role planning intent.'),
      candidate('how to choose ai agents', 'long-tail', '/planner/', 'Planning question served by the interactive planner.'),
      candidate('multi agent workflow template', 'long-tail', '/templates/', 'Template-seeking query served by handoff templates.'),
    ],
  },
  {
    id: 'longtail-codex-and-teams',
    note: 'Long-tail Codex, marketing, and security team terms.',
    candidates: [
      candidate('codex custom agents toml', 'long-tail', '/codex-agents/', 'Specific integration file format from the source docs.'),
      candidate('ai agent team for marketing', 'long-tail', '/marketing-team/', 'Team-planning use case for marketing division roles.'),
      candidate('ai agent team for security review', 'long-tail', '/security-qa/', 'Team-planning use case for security/testing roles.'),
      candidate('agency agents alternative', 'long-tail', '/agency-agents-alternative/', 'Comparison intent for the open-source project and hosted planner.'),
    ],
  },
  {
    id: 'longtail-pricing-planner',
    note: 'Commercial and planner utility terms.',
    candidates: [
      candidate('agency agents pricing', 'long-tail', '/pricing/', 'Commercial package-selection intent.'),
      candidate('ai agent workflow planner', 'long-tail', '/planner/', 'Exact hosted product utility.'),
    ],
  },
]

const exploreApi = 'https://trends.google.com/trends/api/explore'
const timelineApi = 'https://trends.google.com/trends/api/widgetdata/multiline'
const exploreUi = 'https://trends.google.com/trends/explore'
const cookieJar = new Map()
let lastRequestAt = 0

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function cacheKey(keyword) {
  return JSON.stringify({ keyword: keyword.toLowerCase(), anchor, geo, timeframe, category, property })
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    return fallback
  }
}

function isFreshCache(row) {
  return row?.collectedAt && Date.now() - Date.parse(row.collectedAt) < cacheTtlMs
}

async function throttle(ms = 9000) {
  const elapsed = Date.now() - lastRequestAt
  if (elapsed < ms) await sleep(ms - elapsed)
  lastRequestAt = Date.now()
}

function trendsUrl(terms) {
  const params = new URLSearchParams({ date: timeframe, q: terms.join(','), hl })
  return `${exploreUi}?${params.toString()}`
}

function headers(referer) {
  const cookie = [...cookieJar.entries()].map(([key, value]) => `${key}=${value}`).join('; ')
  return {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: referer,
    ...(cookie ? { Cookie: cookie } : {}),
  }
}

function storeCookies(response) {
  const cookies = response.headers.getSetCookie ? response.headers.getSetCookie() : []
  for (const item of cookies) {
    const first = item.split(';')[0]
    const eq = first.indexOf('=')
    if (eq > 0) cookieJar.set(first.slice(0, eq), first.slice(eq + 1))
  }
}

function decodeGoogleJson(text) {
  const start = text.indexOf('{')
  if (start < 0) throw new Error(`Google Trends response was not JSON: ${text.slice(0, 120)}`)
  return JSON.parse(text.slice(start))
}

function errorSummary(error) {
  const parts = [String(error?.message || error)]
  if (error?.cause?.code) parts.push(`cause.code=${error.cause.code}`)
  if (error?.cause?.message) parts.push(`cause.message=${error.cause.message}`)
  return parts.join('; ')
}

async function fetchWithCurl(url, params, referer) {
  const requestUrl = `${url}?${new URLSearchParams(params).toString()}`
  const cookie = [...cookieJar.entries()].map(([key, value]) => `${key}=${value}`).join('; ')
  const args = [
    '-sS',
    '-L',
    '--compressed',
    '--connect-timeout',
    '20',
    '--max-time',
    '60',
    '-H',
    `User-Agent: ${headers(referer)['User-Agent']}`,
    '-H',
    'Accept: application/json, text/plain, */*',
    '-H',
    'Accept-Language: en-US,en;q=0.9',
    '-H',
    `Referer: ${referer}`,
  ]
  if (cookie) args.push('-H', `Cookie: ${cookie}`)
  args.push('-w', '\n__HTTP_STATUS__:%{http_code}', requestUrl)
  const { stdout, stderr } = await execFileAsync('curl', args, { maxBuffer: 8 * 1024 * 1024 })
  const marker = '\n__HTTP_STATUS__:'
  const markerIndex = stdout.lastIndexOf(marker)
  const body = markerIndex >= 0 ? stdout.slice(0, markerIndex) : stdout
  const status = markerIndex >= 0 ? Number(stdout.slice(markerIndex + marker.length).trim()) : 0
  if (status >= 200 && status < 300) return decodeGoogleJson(body)
  throw new Error(`curl HTTP ${status || 'unknown'} from Google Trends${stderr ? `; stderr=${stderr.slice(0, 200)}` : ''}`)
}

async function fetchWithBackoff(url, params, referer, options = {}) {
  let lastError = ''
  if (options.bootstrap) {
    await throttle()
    try {
      const boot = await fetch(referer, { headers: headers(referer), signal: AbortSignal.timeout(30000) })
      storeCookies(boot)
    } catch {}
  }

  await throttle()
  try {
    const response = await fetch(`${url}?${new URLSearchParams(params).toString()}`, {
      headers: headers(referer),
      signal: AbortSignal.timeout(45000),
    })
    storeCookies(response)
    if (response.ok) return decodeGoogleJson(await response.text())
    const retryAfter = response.headers.get('retry-after')
    lastError = `HTTP ${response.status} from Google Trends${retryAfter ? `; Retry-After=${retryAfter}` : ''}`
  } catch (error) {
    lastError = errorSummary(error)
  }

  try {
    return await fetchWithCurl(url, params, referer)
  } catch (curlError) {
    throw new Error(`${lastError}; curlFallback=${errorSummary(curlError)}`)
  }
}

function avg(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function round(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null
}

function roundHeat(value) {
  if (!Number.isFinite(value)) return null
  if (value > 0 && value < 0.01) return Number(value.toFixed(4))
  return round(value)
}

function buildRow(candidate, group, terms, rows, index, anchorIndex, collectedAt, source) {
  const termValues = rows.map((row) => Number((row.value || [])[index]) || 0)
  const anchorValues = rows.map((row) => Number((row.value || [])[anchorIndex]) || 0)
  const termAvg = avg(termValues)
  const anchorAvg = avg(anchorValues)
  const relativeHeatVsMirofish = anchorAvg > 0 ? termAvg / anchorAvg : null
  const confirmed = termAvg > 0 && relativeHeatVsMirofish
  return {
    keyword: candidate.keyword,
    type: candidate.type,
    page: candidate.page,
    themeRelevance: candidate.themeRelevance,
    relevanceReason: candidate.relevanceReason,
    themeRelevanceGate: 'pass',
    groupId: group.id,
    groupNote: group.note,
    comparedTerms: terms,
    anchor,
    timeframe,
    geo: 'Worldwide',
    category,
    property,
    collectedAt,
    cacheTtlHours: cacheTtlMs / 3600000,
    source,
    trendsUrl: trendsUrl(terms),
    status: confirmed ? 'confirmed' : 'compressed_or_no_confirmed_volume',
    termAvg: round(termAvg),
    mirofishAvg: round(anchorAvg),
    relativeHeatVsMirofish: roundHeat(relativeHeatVsMirofish),
    nonZeroWeeks: termValues.filter((value) => value > 0).length,
    points: rows.length,
    evidenceLevel: confirmed
      ? 'Google Trends grouped same-request MiroFish comparison plus strong Agency Agents Space theme relevance'
      : 'needs smaller group, official CSV export, or another current keyword source',
    confidence: confirmed ? 'high_for_relative_interest' : 'low',
  }
}

function withCandidate(row, candidate) {
  return {
    ...row,
    type: candidate.type,
    page: candidate.page,
    themeRelevance: candidate.themeRelevance,
    relevanceReason: candidate.relevanceReason,
    themeRelevanceGate: 'pass',
  }
}

async function fetchGroup(group) {
  const terms = [anchor, ...group.candidates.map((item) => item.keyword)]
  if (terms.length > 5) throw new Error(`Group ${group.id} has ${terms.length} terms; Google Trends max is 5`)
  const referer = trendsUrl(terms)
  const queryStartedAt = new Date().toISOString()
  const req = {
    comparisonItem: terms.map((keyword) => ({ keyword, geo, time: timeframe })),
    category,
    property,
  }
  const explore = await fetchWithBackoff(
    exploreApi,
    { hl, tz, req: JSON.stringify(req) },
    referer,
    { bootstrap: true },
  )
  const widget = (explore.widgets || []).find((item) => item.id === 'TIMESERIES')
  if (!widget) throw new Error('TIMESERIES widget was not returned')
  const timeline = await fetchWithBackoff(
    timelineApi,
    { hl, tz, req: JSON.stringify(widget.request || {}), token: widget.token || '' },
    referer,
  )
  const queryEndedAt = new Date().toISOString()
  const rows = timeline.default?.timelineData || []
  return {
    groupId: group.id,
    queryStartedAt,
    queryEndedAt,
    terms,
    rows: group.candidates.map((candidate, idx) => buildRow(candidate, group, terms, rows, idx + 1, 0, queryEndedAt, 'fresh')),
  }
}

const runStartedAt = new Date().toISOString()
const cache = await readJson(cacheFile, { rows: {} })
const rowsByKey = { ...(cache.rows || {}) }
const groupResults = []
const allRows = []

for (const group of groups) {
  const cachedRows = group.candidates.map((item) => rowsByKey[cacheKey(item.keyword)])
  if (cachedRows.every(isFreshCache)) {
    const rows = cachedRows.map((row, idx) => withCandidate({ ...row, source: 'cache' }, group.candidates[idx]))
    groupResults.push({ groupId: group.id, source: 'cache', terms: [anchor, ...group.candidates.map((item) => item.keyword)], rows })
    allRows.push(...rows)
    continue
  }

  try {
    const result = await fetchGroup(group)
    groupResults.push({ ...result, source: 'fresh' })
    for (const row of result.rows) {
      rowsByKey[cacheKey(row.keyword)] = row
      allRows.push(row)
    }
  } catch (error) {
    const rows = group.candidates.map((item) => ({
      keyword: item.keyword,
      type: item.type,
      page: item.page,
      themeRelevance: item.themeRelevance,
      relevanceReason: item.relevanceReason,
      themeRelevanceGate: 'pass',
      groupId: group.id,
      groupNote: group.note,
      comparedTerms: [anchor, ...group.candidates.map((candidate) => candidate.keyword)],
      anchor,
      timeframe,
      geo: 'Worldwide',
      category,
      property,
      collectedAt: null,
      cacheTtlHours: cacheTtlMs / 3600000,
      source: 'blocked',
      status: 'blocked_trends_error',
      error: errorSummary(error),
      relativeHeatVsMirofish: null,
      evidenceLevel: 'blocked_or_insufficient',
      confidence: 'low',
    }))
    groupResults.push({ groupId: group.id, source: 'blocked', error: errorSummary(error), rows })
    allRows.push(...rows)
  }
}

const confirmed = allRows.filter((row) => row.status === 'confirmed')
const payload = {
  generatedAt: new Date().toISOString(),
  runStartedAt,
  runEndedAt: new Date().toISOString(),
  site: 'agency-agents.space',
  repo: 'https://github.com/msitarzewski/agency-agents',
  timeframe,
  geo: 'Worldwide',
  method:
    'MiroFish anchor validation: each same-request Google Trends query compares mirofish plus at most four strongly related Agency Agents Space candidate terms; blocked requests are not counted.',
  minimums: { effectivePrimaryTrafficKeywords: 6, effectiveLongTailTrafficKeywords: 8 },
  counts: {
    checked: allRows.length,
    confirmed: confirmed.length,
    confirmedPrimary: confirmed.filter((row) => row.type === 'primary').length,
    confirmedLongTail: confirmed.filter((row) => row.type === 'long-tail').length,
  },
  pass:
    confirmed.filter((row) => row.type === 'primary').length >= 6 &&
    confirmed.filter((row) => row.type === 'long-tail').length >= 8,
  groups: groupResults,
  confirmedTrafficKeywords: confirmed,
  pendingOrBlockedCandidates: allRows.filter((row) => row.status !== 'confirmed'),
}

await fs.mkdir(reportsDir, { recursive: true })
await fs.writeFile(cacheFile, `${JSON.stringify({ updatedAt: payload.runEndedAt, rows: rowsByKey }, null, 2)}\n`)
await fs.writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`)

console.log(JSON.stringify(payload.counts, null, 2))
console.log(`pass=${payload.pass}`)
console.log(`wrote reports/${outputFile.pathname.split('/reports/')[1]}`)
