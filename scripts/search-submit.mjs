import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const domain = 'agency-agents.space'
const siteUrl = `https://${domain}/`
const sitemapUrl = `https://${domain}/sitemap.xml`
const gscDomainProperty = `sc-domain:${domain}`
const indexNowKey = '590a3ab02487cffe4cfd55b0df769f65'
const indexNowKeyLocation = `https://${domain}/${indexNowKey}.txt`
const resultPath = resolve('search-submission-result.json')
const onlyGsc = process.argv.includes('--only-gsc')

function keychain(service, account = '') {
  const args = ['find-generic-password', '-s', service, '-w']
  if (account) args.splice(1, 0, '-a', account)
  try {
    return execFileSync('/usr/bin/security', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

function envOrKey(name, alternatives = []) {
  const envValue = String(process.env[name] || '').trim()
  if (envValue) return envValue
  for (const item of [name, ...alternatives]) {
    const value = Array.isArray(item) ? keychain(item[0], item[1]) : keychain(item)
    if (value) return value
  }
  return ''
}

function findClientSecretFile() {
  for (const dir of ['../web-tools', 'web-tools', '.', '..']) {
    try {
      const file = readdirSync(dir).find((name) => name.startsWith('client_secret_') && name.endsWith('.json'))
      if (file) return resolve(dir, file)
    } catch {
      // Keep searching.
    }
  }
  return ''
}

async function readJsonResponse(response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { raw: text }
  }
}

function curlQuote(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, '\\n')
}

function curlJson(url, { method = 'GET', headers = {}, body = null } = {}) {
  const config = [
    `url = "${curlQuote(url)}"`,
    `request = "${curlQuote(method)}"`,
    'silent',
    'show-error',
    'location',
    'connect-timeout = 15',
    'max-time = 90',
    'retry = 2',
    'write-out = "\\n__HTTP_STATUS__:%{http_code}"',
    ...Object.entries(headers).map(([key, value]) => `header = "${curlQuote(`${key}: ${value}`)}"`),
  ]
  if (body != null) config.push(`data-binary = "${curlQuote(body)}"`)
  const text = execFileSync('curl', ['--config', '-'], {
    input: `${config.join('\n')}\n`,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 16 * 1024 * 1024,
  })
  const marker = '\n__HTTP_STATUS__:'
  const splitAt = text.lastIndexOf(marker)
  const rawBody = splitAt >= 0 ? text.slice(0, splitAt) : text
  const status = splitAt >= 0 ? Number(text.slice(splitAt + marker.length).trim()) : 0
  let data = null
  try {
    data = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    data = { raw: rawBody }
  }
  return { ok: status >= 200 && status < 300, status, data }
}

async function google(url, token, init = {}) {
  const response = curlJson(url, {
    method: init.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    body: init.body ?? null,
  })
  if (!response.ok) {
    const data = response.data
    const message = data?.error?.message || data?.error || data?.raw || response.statusText
    throw new Error(`Google ${init.method || 'GET'} ${response.status}: ${message}`)
  }
  return { status: response.status, data: response.data }
}

async function getGoogleAccessToken() {
  const clientPath = findClientSecretFile()
  if (!clientPath) throw new Error('client_secret_*.json not found')
  const clientJson = JSON.parse(readFileSync(clientPath, 'utf8'))
  const client = clientJson.installed || clientJson.web
  const refreshToken = envOrKey('GSC_REFRESH_TOKEN', [['codex-gsc-refresh-token', 'gsc']])
  if (!refreshToken) throw new Error('GSC refresh token not found')
  const response = curlJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: client.client_id,
      client_secret: client.client_secret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  })
  if (!response.ok) throw new Error(`Google token refresh failed: ${response.status}`)
  return response.data.access_token
}

function cloudflareHeaders() {
  const apiToken = envOrKey('CLOUDFLARE_API_TOKEN')
  if (apiToken) return { Authorization: `Bearer ${apiToken}` }
  const key = envOrKey('CLOUDFLARE_API_KEY', [['CLOUDFLARE_API_KEY', 'codex-env']])
  const email = envOrKey('CLOUDFLARE_EMAIL', ['CLOUDFLARE_API_EMAIL', ['CLOUDFLARE_EMAIL', 'codex-env']])
  if (!key || !email) throw new Error('Cloudflare API key/email not found')
  return { 'X-Auth-Key': key, 'X-Auth-Email': email }
}

async function cloudflare(endpoint, init = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
    ...init,
    headers: {
      ...cloudflareHeaders(),
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(45_000),
  })
  const payload = await readJsonResponse(response)
  if (!response.ok || payload.success === false) {
    const message = payload.errors?.map((error) => error.message || error.code).join('; ') || response.statusText
    throw new Error(`Cloudflare ${init.method || 'GET'} ${response.status}: ${message}`)
  }
  return payload.result
}

async function getZone() {
  const zones = await cloudflare(`/zones?name=${encodeURIComponent(domain)}&per_page=1`)
  const zone = zones?.[0]
  if (!zone) throw new Error(`Cloudflare zone not found for ${domain}`)
  return zone
}

async function ensureGoogleTxtRecord(zoneId, token) {
  const comment = 'Agency Agents Space Google site verification'
  const records = await cloudflare(`/zones/${zoneId}/dns_records?type=TXT&name=${encodeURIComponent(domain)}&per_page=100`)
  const managed = records.find((record) => record.comment === comment)
  const body = {
    type: 'TXT',
    name: domain,
    content: token,
    ttl: 60,
    proxied: false,
    comment,
  }
  if (managed) {
    await cloudflare(`/zones/${zoneId}/dns_records/${managed.id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    return 'updated'
  }
  if (records.some((record) => record.content === token)) return 'already-present'
  await cloudflare(`/zones/${zoneId}/dns_records`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return 'created'
}

async function verifyGoogleDomain(token, zoneId) {
  const site = { type: 'INET_DOMAIN', identifier: domain }
  const tokenResult = await google('https://www.googleapis.com/siteVerification/v1/token', token, {
    method: 'POST',
    body: JSON.stringify({ site, verificationMethod: 'DNS_TXT' }),
  })
  const txtAction = await ensureGoogleTxtRecord(zoneId, tokenResult.data.token)
  let lastError = ''
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const verification = await google('https://www.googleapis.com/siteVerification/v1/webResource?verificationMethod=DNS_TXT', token, {
        method: 'POST',
        body: JSON.stringify({ site }),
      })
      return { status: 'verified', method: 'DNS_TXT', txtAction, id: verification.data.id || '' }
    } catch (error) {
      lastError = error.message
      await new Promise((resolveSleep) => setTimeout(resolveSleep, 10_000))
    }
  }
  return { status: 'pending', method: 'DNS_TXT', txtAction, error: lastError }
}

async function submitGsc(token, zoneId) {
  const result = {
    property: gscDomainProperty,
    urlPrefixProperty: siteUrl,
    sitemapUrl,
    verification: null,
    domainSitemapStatus: '',
    urlPrefixSitemapStatus: '',
    matchingPropertiesAfter: [],
  }
  const sitesBefore = await google('https://www.googleapis.com/webmasters/v3/sites', token)
  const entriesBefore = sitesBefore.data.siteEntry || []
  const hasOwner = entriesBefore.some((entry) => (
    (entry.siteUrl === gscDomainProperty || entry.siteUrl === siteUrl) &&
    entry.permissionLevel !== 'siteUnverifiedUser'
  ))
  if (!hasOwner) result.verification = await verifyGoogleDomain(token, zoneId)

  await google(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscDomainProperty)}`, token, { method: 'PUT' })
  await google(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}`, token, { method: 'PUT' })
  const domainSitemap = await google(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscDomainProperty)}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
    token,
    { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' } },
  )
  const urlPrefixSitemap = await google(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
    token,
    { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' } },
  )
  result.domainSitemapStatus = `ok:${domainSitemap.status}`
  result.urlPrefixSitemapStatus = `ok:${urlPrefixSitemap.status}`

  const sitesAfter = await google('https://www.googleapis.com/webmasters/v3/sites', token)
  result.matchingPropertiesAfter = (sitesAfter.data.siteEntry || [])
    .filter((entry) => entry.siteUrl.includes(domain))
    .map((entry) => ({ siteUrl: entry.siteUrl, permissionLevel: entry.permissionLevel }))
  result.status = 'submitted'
  return result
}

function bingKey() {
  const key = envOrKey('BING_WEBMASTER_API_KEY', ['BING_WEEMASTER_API_EY', ['BING_WEEMASTER_API_EY', 'codex-env'], ['codex-bing-webmaster-api-key', 'bing']])
  if (!key) throw new Error('Bing Webmaster API key not found')
  return key
}

async function bing(method, body) {
  const response = await fetch(`https://ssl.bing.com/webmaster/api.svc/json/${method}?${new URLSearchParams({ apikey: bingKey() })}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  })
  const payload = await readJsonResponse(response)
  const data = payload?.d ?? payload
  const errorCode = data?.ErrorCode ?? payload?.ErrorCode
  const ok = response.ok && (!errorCode || errorCode === 'None' || errorCode === 0)
  return {
    status: ok ? 'submitted' : 'failed',
    httpStatus: response.status,
    error: ok ? '' : data?.Message || payload?.Message || data?.raw || response.statusText,
  }
}

async function getBingSite() {
  const response = await fetch(`https://ssl.bing.com/webmaster/api.svc/json/GetUserSites?${new URLSearchParams({ apikey: bingKey() })}`, {
    signal: AbortSignal.timeout(45_000),
  })
  const payload = await readJsonResponse(response)
  const data = payload?.d ?? payload
  const sites = Array.isArray(data) ? data : Array.isArray(data?.UserSites) ? data.UserSites : []
  const match = sites.find((entry) => {
    const url = typeof entry === 'string' ? entry : entry?.Url || entry?.url || ''
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '') === domain
  })
  if (!match) return null
  return {
    url: typeof match === 'string' ? match : match.Url || match.url || '',
    isVerified: typeof match === 'string' ? null : match.IsVerified ?? match.isVerified ?? match.Verified ?? match.verified ?? null,
  }
}

async function sitemapUrls() {
  const response = await fetch(sitemapUrl, { signal: AbortSignal.timeout(45_000) })
  const text = await response.text()
  if (!response.ok) throw new Error(`sitemap fetch failed: ${response.status}`)
  return [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
}

async function submitBing(urls) {
  return {
    siteUrl,
    sitemapUrl,
    matchingSiteBefore: await getBingSite(),
    addSite: await bing('AddSite', { siteUrl }),
    verifySite: await bing('VerifySite', { siteUrl }),
    submitFeed: await bing('SubmitFeed', { siteUrl, feedUrl: sitemapUrl }),
    submitUrlBatch: await bing('SubmitUrlbatch', { siteUrl, urlList: urls }),
    matchingSiteAfter: await getBingSite(),
  }
}

async function submitIndexNow(urls) {
  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: domain,
      key: indexNowKey,
      keyLocation: indexNowKeyLocation,
      urlList: urls,
    }),
    signal: AbortSignal.timeout(45_000),
  })
  const text = await response.text()
  return {
    status: response.ok ? 'submitted' : 'failed',
    httpStatus: response.status,
    keyLocation: indexNowKeyLocation,
    urlCount: urls.length,
    error: response.ok ? '' : text.slice(0, 220),
  }
}

async function main() {
  const result = {
    generatedAt: new Date().toISOString(),
    domain,
    siteUrl,
    sitemapUrl,
    sitemap: { status: 'pending', urlCount: 0, submittedUrls: [] },
    gsc: { status: 'pending' },
    bing: { status: 'pending' },
    indexNow: { status: 'pending' },
  }
  if (onlyGsc && existsSync(resultPath)) {
    try {
      const previous = JSON.parse(readFileSync(resultPath, 'utf8'))
      result.bing = previous.bing || result.bing
      result.indexNow = previous.indexNow || result.indexNow
    } catch {
      // Keep fresh placeholders when the prior result is unreadable.
    }
  }
  const zone = await getZone()
  const urls = await sitemapUrls()
  result.sitemap = { status: 'live', urlCount: urls.length, submittedUrls: urls }

  try {
    result.gsc = await submitGsc(await getGoogleAccessToken(), zone.id)
  } catch (error) {
    result.gsc = { status: 'failed', error: error.message }
  }
  if (onlyGsc) {
    result.bing = result.bing?.status === 'pending' ? { status: 'skipped', reason: 'only-gsc' } : result.bing
    result.indexNow = result.indexNow?.status === 'pending' ? { status: 'skipped', reason: 'only-gsc' } : result.indexNow
  } else {
    try {
      result.bing = { status: 'submitted', ...(await submitBing(urls)) }
    } catch (error) {
      result.bing = { status: 'failed', error: error.message }
    }
    try {
      result.indexNow = await submitIndexNow(urls)
    } catch (error) {
      result.indexNow = { status: 'failed', error: error.message }
    }
  }

  writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify({
    domain,
    sitemapUrls: urls.length,
    gsc: {
      status: result.gsc.status,
      domainSitemapStatus: result.gsc.domainSitemapStatus || '',
      urlPrefixSitemapStatus: result.gsc.urlPrefixSitemapStatus || '',
      verificationStatus: result.gsc.verification?.status || 'already-owner-or-not-run',
      matchingPropertiesAfter: result.gsc.matchingPropertiesAfter || [],
      error: result.gsc.error || '',
    },
    bing: {
      status: result.bing.status,
      addSite: result.bing.addSite?.status || '',
      verifySite: result.bing.verifySite?.status || '',
      submitFeed: result.bing.submitFeed?.status || '',
      submitUrlBatch: result.bing.submitUrlBatch?.status || '',
      matchingSiteAfter: result.bing.matchingSiteAfter || null,
      error: result.bing.error || '',
    },
    indexNow: {
      status: result.indexNow.status,
      httpStatus: result.indexNow.httpStatus || 0,
      urlCount: result.indexNow.urlCount || 0,
      error: result.indexNow.error || '',
    },
    resultPath,
  }, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
