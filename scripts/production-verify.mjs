import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'

const domain = 'agency-agents.space'
const origin = `https://${domain}`
const reportsDir = new URL('../reports/', import.meta.url)
const indexNowKey = '590a3ab02487cffe4cfd55b0df769f65'
const parkingPatterns = [/Registered at\s+spaceship/i, /Tools to start a website/i, /Find similar domains/i]

function curlQuote(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, '\\n')
}

function curlEnv() {
  const env = { ...process.env }
  for (const key of ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'all_proxy']) {
    delete env[key]
  }
  return env
}

function runCurl(config, { stripProxy = true } = {}) {
  return execFileSync('curl', ['--config', '-'], {
    input: `${config.join('\n')}\n`,
    encoding: 'utf8',
    env: stripProxy ? curlEnv() : process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 16 * 1024 * 1024,
  })
}

function curlJson(url, headers = {}, { stripProxy = false } = {}) {
  const config = [
    `url = "${curlQuote(url)}"`,
    'silent',
    'show-error',
    'connect-timeout = 15',
    'max-time = 30',
    ...Object.entries(headers).map(([key, value]) => `header = "${curlQuote(`${key}: ${value}`)}"`),
  ]
  return JSON.parse(runCurl(config, { stripProxy }))
}

function curlTextResponse(url, init, ip = '', options = {}) {
  const startedAt = Date.now()
  const parsed = new URL(url)
  const config = [
    `url = "${curlQuote(url)}"`,
    `request = "${curlQuote(init.method || 'GET')}"`,
    'silent',
    'show-error',
    'connect-timeout = 15',
    `max-time = "${Math.ceil((init.timeoutMs || 45_000) / 1000)}"`,
    'retry = 1',
    'write-out = "\\n__HTTP_STATUS__:%{http_code}\\n__EFFECTIVE_URL__:%{url_effective}\\n__CONTENT_TYPE__:%{content_type}\\n__REDIRECT_URL__:%{redirect_url}\\n__TIME_TOTAL__:%{time_total}"',
  ]
  if (ip) config.push(`resolve = "${curlQuote(`${parsed.hostname}:443:${ip}`)}"`)
  if (init.redirect !== 'manual') config.push('location')
  for (const [key, value] of Object.entries(init.headers || {})) {
    config.push(`header = "${curlQuote(`${key}: ${value}`)}"`)
  }
  if (init.body != null) config.push(`data-binary = "${curlQuote(init.body)}"`)
  const output = runCurl(config, { stripProxy: options.stripProxy !== false })
  const marker = '\n__HTTP_STATUS__:'
  const splitAt = output.lastIndexOf(marker)
  const text = splitAt >= 0 ? output.slice(0, splitAt) : output
  const metaText = splitAt >= 0 ? output.slice(splitAt + 1) : ''
  const meta = Object.fromEntries(metaText.split('\n').map((line) => {
    const at = line.indexOf(':')
    return at > 0 ? [line.slice(0, at), line.slice(at + 1)] : ['', '']
  }).filter(([key]) => key))
  return {
    url,
    status: Number(meta.__HTTP_STATUS__ || 0),
    ok: Number(meta.__HTTP_STATUS__ || 0) >= 200 && Number(meta.__HTTP_STATUS__ || 0) < 300,
    redirected: (meta.__EFFECTIVE_URL__ || url) !== url,
    finalUrl: meta.__EFFECTIVE_URL__ || url,
    location: meta.__REDIRECT_URL__ || '',
    contentType: meta.__CONTENT_TYPE__ || '',
    cfRay: '',
    bodyBytes: Buffer.byteLength(text),
    elapsedMs: Date.now() - startedAt,
    text,
  }
}

async function dns(type, name = domain) {
  let lastPayload = null
  const query = new URLSearchParams({ name, type })
  const urls = [
    `https://cloudflare-dns.com/dns-query?${query}`,
    `https://1.1.1.1/dns-query?${query}`,
    `https://1.0.0.1/dns-query?${query}`,
  ]
  for (let attempt = 0; attempt < 6; attempt += 1) {
    for (const url of urls) {
      for (const stripProxy of [false, true]) {
        try {
          const payload = curlJson(url, { accept: 'application/dns-json' }, { stripProxy })
          lastPayload = payload
          const answers = (payload.Answer || []).map((answer) => answer.data)
          if (answers.length || type !== 'A') return answers
        } catch {
          // Try the next resolver/proxy mode.
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 5000))
  }
  return (lastPayload?.Answer || []).map((answer) => answer.data)
}

async function fetchTextResponse(url, init = {}) {
  const startedAt = Date.now()
  const response = await fetch(url, {
    method: init.method || 'GET',
    headers: init.headers || {},
    body: init.body ?? undefined,
    redirect: init.redirect === 'manual' ? 'manual' : 'follow',
    signal: AbortSignal.timeout(init.timeoutMs || 45_000),
  })
  const text = await response.text()
  return {
    url,
    status: response.status,
    ok: response.ok,
    redirected: response.redirected,
    finalUrl: response.url || url,
    location: response.headers.get('location') || '',
    contentType: response.headers.get('content-type') || '',
    cfRay: response.headers.get('cf-ray') || '',
    bodyBytes: Buffer.byteLength(text),
    elapsedMs: Date.now() - startedAt,
    text,
  }
}

async function readTextResponse(url, init = {}) {
  const host = new URL(url).hostname
  const ips = (await dns('A', host)).filter((item) => /^\d+\.\d+\.\d+\.\d+$/.test(item))
  if (!ips.length) throw new Error(`No A records returned for ${host}`)
  let lastError
  for (const ip of ips) {
    try {
      return curlTextResponse(url, init, ip)
    } catch (error) {
      lastError = error
    }
  }
  try {
    return curlTextResponse(url, init, '', { stripProxy: false })
  } catch (error) {
    lastError = error
  }
  try {
    return await fetchTextResponse(url, init)
  } catch (error) {
    lastError = error
  }
  throw lastError || new Error(`curl probe failed for ${host}`)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function main() {
  const result = {
    generatedAt: new Date().toISOString(),
    domain,
    checks: [],
    dns: {
      ns: await dns('NS'),
      apexA: await dns('A', domain),
      wwwA: await dns('A', `www.${domain}`),
    },
    status: 'pending',
  }

  const homepage = await readTextResponse(`${origin}/`)
  result.checks.push({
    name: 'homepage',
    status: homepage.status,
    finalUrl: homepage.finalUrl,
    contentType: homepage.contentType,
    cfRay: Boolean(homepage.cfRay),
    bodyBytes: homepage.bodyBytes,
    elapsedMs: homepage.elapsedMs,
  })
  assert(homepage.status === 200, `homepage status ${homepage.status}`)
  assert(homepage.text.includes('Assemble the right AI specialist team'), 'homepage expected copy missing')
  assert(!parkingPatterns.some((pattern) => pattern.test(homepage.text)), 'homepage still looks like registrar parking')

  const www = await readTextResponse(`https://www.${domain}/`, { redirect: 'manual' })
  result.checks.push({
    name: 'www_redirect',
    status: www.status,
    location: www.location,
    redirected: www.redirected,
  })
  assert([301, 302, 307, 308].includes(www.status), `www should redirect before body fetch, saw ${www.status}`)

  for (const path of ['/pricing/', '/planner/', '/source-notes/', '/robots.txt', '/sitemap.xml', '/llms.txt', `/${indexNowKey}.txt`, '/BingSiteAuth.xml']) {
    const probe = await readTextResponse(`${origin}${path}`)
    result.checks.push({
      name: path,
      status: probe.status,
      contentType: probe.contentType,
      bodyBytes: probe.bodyBytes,
      elapsedMs: probe.elapsedMs,
    })
    assert(probe.status === 200, `${path} status ${probe.status}`)
  }

  const runtime = await readTextResponse(`${origin}/api/runtime`)
  const runtimeJson = JSON.parse(runtime.text)
  result.checks.push({
    name: '/api/runtime',
    status: runtime.status,
    paymentConfigured: runtimeJson.paymentConfigured,
    configuredCheckoutSecrets: runtimeJson.checkoutSecrets?.configuredCount || 0,
  })
  assert(runtime.status === 200 && runtimeJson.paymentConfigured === true, 'runtime payment configuration should be complete')

  const checkout = await readTextResponse(`${origin}/api/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan: 'pro', billing: 'annual' }),
  })
  const checkoutJson = JSON.parse(checkout.text)
  result.checks.push({
    name: '/api/checkout',
    status: checkout.status,
    paymentConfigured: checkoutJson.paymentConfigured,
    provider: checkoutJson.provider,
    hasPolarCheckoutUrl: /^https:\/\/([^/]+\.)?polar\.(sh|io)\//i.test(checkoutJson.checkoutUrl || ''),
  })
  assert(checkout.status === 200 && checkoutJson.paymentConfigured === true, 'checkout should return a live Polar checkout URL')

  const analytics = await readTextResponse(`${origin}/api/analytics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'production_verify', path: '/', source: 'production-verify', planId: 'pro', billing: 'annual' }),
  })
  const analyticsJson = JSON.parse(analytics.text)
  result.checks.push({
    name: '/api/analytics',
    status: analytics.status,
    stored: analyticsJson.stored,
    sink: analyticsJson.sink,
  })
  assert(analytics.status === 202 && analyticsJson.stored === true && analyticsJson.sink === 'cloudflare_d1', 'analytics should write to Cloudflare D1')

  const planner = await readTextResponse(`${origin}/api/planner`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectType: 'saas',
      timelineWeeks: 4,
      launchChannels: 4,
      riskLevel: 'high',
      needsSecurity: 'yes',
      needsCompliance: 'no',
    }),
  })
  const plannerJson = JSON.parse(planner.text)
  result.checks.push({
    name: '/api/planner',
    status: planner.status,
    paymentRequired: plannerJson.paymentRequired,
    hasPreview: Boolean(plannerJson.preview),
  })
  assert(planner.status === 402 && plannerJson.paymentRequired === true && plannerJson.preview, 'planner unpaid gate should remain explicit')

  const missing = await readTextResponse(`${origin}/missing-page`)
  result.checks.push({ name: '404', status: missing.status, bodyBytes: missing.bodyBytes })
  assert(missing.status === 404, `missing page should return 404, saw ${missing.status}`)

  result.status = 'pass'
  await mkdir(reportsDir, { recursive: true })
  await writeFile(new URL('production-verification.json', reportsDir), `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify({
    status: result.status,
    domain,
    nameservers: result.dns.ns,
    checks: result.checks.map((check) => ({ name: check.name, status: check.status })),
    report: 'reports/production-verification.json',
  }, null, 2))
}

main().catch(async (error) => {
  await mkdir(reportsDir, { recursive: true })
  await writeFile(new URL('production-verification.json', reportsDir), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    domain,
    status: 'failed',
    error: error.message,
  }, null, 2)}\n`)
  console.error(error.message)
  process.exit(1)
})
