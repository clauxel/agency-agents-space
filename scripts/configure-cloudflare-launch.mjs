import { execFileSync } from 'node:child_process'

const domain = 'agency-agents.space'
const canonicalHost = domain
const wwwHost = `www.${domain}`
const workerName = 'agency-agents-space'
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '615b05ce6668dd8e0e2431077fc29c82'
const statusOnly = process.argv.includes('--status-only')

function keychain(service, account) {
  try {
    return execFileSync('/usr/bin/security', ['find-generic-password', '-s', service, '-a', account, '-w'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

const cfGlobalKey = process.env.CLOUDFLARE_API_KEY || keychain('CLOUDFLARE_API_KEY', 'codex-env')
const cfEmail = process.env.CLOUDFLARE_EMAIL || process.env.CLOUDFLARE_API_EMAIL || keychain('CLOUDFLARE_EMAIL', 'codex-env')
const spaceshipKey = process.env.SPACESHIP_API_KEY || keychain('SPACESHIP_API_KEY', 'codex-env')
const spaceshipSecret = process.env.SPACESHIP_API_SECRET || keychain('SPACESHIP_API_SECRET', 'codex-env')

function requireValue(value, label) {
  if (!value) throw new Error(`${label} is not configured`)
  return value
}

async function requestJson(url, options, provider) {
  const res = await fetch(url, options)
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }
  if (!res.ok || data.success === false) {
    const errors = Array.isArray(data.errors) ? data.errors.map((error) => error.message || error.code).join('; ') : text
    throw new Error(`${provider} request failed (${res.status}): ${errors}`)
  }
  return data
}

async function cf(endpoint, options = {}) {
  return requestJson(`https://api.cloudflare.com/client/v4${endpoint}`, {
    ...options,
    headers: {
      'X-Auth-Key': requireValue(cfGlobalKey, 'CLOUDFLARE_API_KEY'),
      'X-Auth-Email': requireValue(cfEmail, 'CLOUDFLARE_EMAIL'),
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  }, 'Cloudflare')
}

async function spaceship(endpoint, options = {}) {
  return requestJson(`https://spaceship.dev/api/v1${endpoint}`, {
    ...options,
    headers: {
      'X-API-Key': requireValue(spaceshipKey, 'SPACESHIP_API_KEY'),
      'X-API-Secret': requireValue(spaceshipSecret, 'SPACESHIP_API_SECRET'),
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  }, 'Spaceship')
}

async function ensureZone() {
  const existing = await cf(`/zones?name=${encodeURIComponent(domain)}&account.id=${accountId}`)
  if (existing.result?.[0]) return { zone: existing.result[0], created: false }
  const created = await cf('/zones', {
    method: 'POST',
    body: JSON.stringify({
      account: { id: accountId },
      name: domain,
      type: 'full',
      jump_start: false,
    }),
  })
  return { zone: created.result, created: true }
}

async function putZoneSetting(zoneId, id, value) {
  await cf(`/zones/${zoneId}/settings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ value }),
  })
}

async function ensureDnsRecord(zoneId, host) {
  const name = host === canonicalHost ? domain : host
  const records = await cf(`/zones/${zoneId}/dns_records?name=${encodeURIComponent(name)}&per_page=100`)
  const compatible = records.result?.filter((record) => record.type === 'A' && record.content === '192.0.2.1') || []
  const conflicts = records.result?.filter((record) => !(record.type === 'A' && record.content === '192.0.2.1')) || []
  if (conflicts.length) {
    throw new Error(`DNS conflict for ${name}: ${conflicts.map((record) => record.type).join(', ')} record already exists. No records were deleted.`)
  }
  if (compatible[0]) {
    if (!compatible[0].proxied) {
      await cf(`/zones/${zoneId}/dns_records/${compatible[0].id}`, {
        method: 'PATCH',
        body: JSON.stringify({ proxied: true }),
      })
      return { host: name, action: 'proxied-existing' }
    }
    return { host: name, action: 'existing' }
  }
  await cf(`/zones/${zoneId}/dns_records`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'A',
      name,
      content: '192.0.2.1',
      ttl: 1,
      proxied: true,
    }),
  })
  return { host: name, action: 'created' }
}

async function ensureWorkerRoute(zoneId, pattern) {
  const routes = await cf(`/zones/${zoneId}/workers/routes?per_page=100`)
  const existing = routes.result?.find((route) => route.pattern === pattern)
  const body = JSON.stringify({ pattern, script: workerName })
  if (existing) {
    if (existing.script === workerName) return { pattern, action: 'existing' }
    await cf(`/zones/${zoneId}/workers/routes/${existing.id}`, { method: 'PUT', body })
    return { pattern, action: 'updated' }
  }
  await cf(`/zones/${zoneId}/workers/routes`, { method: 'POST', body })
  return { pattern, action: 'created' }
}

async function updateRegistrarNameservers(zone) {
  const hosts = zone.name_servers || []
  if (hosts.length < 2) return { action: 'skipped', reason: 'Cloudflare nameservers are not available yet' }
  let current
  try {
    current = await spaceship(`/domains/${domain}`)
  } catch (error) {
    return { action: 'skipped', reason: `Domain lookup failed: ${error.message}` }
  }
  const nameserverPayload = current.nameservers || current.result?.nameservers || []
  const nameservers = Array.isArray(nameserverPayload) ? nameserverPayload : nameserverPayload.hosts || []
  const normalizedCurrent = nameservers.map((item) => String(item).toLowerCase()).sort()
  const normalizedTarget = hosts.map((item) => String(item).toLowerCase()).sort()
  if (JSON.stringify(normalizedCurrent) === JSON.stringify(normalizedTarget)) return { action: 'existing', hosts }
  await spaceship(`/domains/${domain}/nameservers`, {
    method: 'PUT',
    body: JSON.stringify({ provider: 'custom', hosts }),
  })
  return { action: 'updated', hosts }
}

async function status(zone, created) {
  const zoneId = zone.id
  const [dnsRows, routes, ssl, alwaysHttps] = await Promise.all([
    cf(`/zones/${zoneId}/dns_records?per_page=100`),
    cf(`/zones/${zoneId}/workers/routes?per_page=100`),
    cf(`/zones/${zoneId}/settings/ssl`),
    cf(`/zones/${zoneId}/settings/always_use_https`),
  ])
  return {
    domain,
    workerName,
    zoneCreated: created,
    zoneStatus: zone.status,
    nameservers: zone.name_servers || [],
    ssl: ssl.result?.value || '',
    alwaysUseHttps: alwaysHttps.result?.value || '',
    dns: (dnsRows.result || []).filter((record) => [canonicalHost, wwwHost].includes(record.name)).map((record) => ({
      name: record.name,
      type: record.type,
      content: record.content,
      proxied: record.proxied,
    })),
    routes: (routes.result || []).filter((route) => route.pattern.includes(domain)).map((route) => ({
      pattern: route.pattern,
      script: route.script,
    })),
  }
}

async function main() {
  const { zone, created } = await ensureZone()
  if (statusOnly) {
    console.log(JSON.stringify(await status(zone, created), null, 2))
    return
  }
  const zoneId = zone.id
  await Promise.all([
    putZoneSetting(zoneId, 'ssl', 'full'),
    putZoneSetting(zoneId, 'always_use_https', 'on'),
    putZoneSetting(zoneId, 'automatic_https_rewrites', 'on'),
  ])
  const dns = [
    await ensureDnsRecord(zoneId, canonicalHost),
    await ensureDnsRecord(zoneId, wwwHost),
  ]
  const routes = [
    await ensureWorkerRoute(zoneId, `${canonicalHost}/*`),
    await ensureWorkerRoute(zoneId, `${wwwHost}/*`),
  ]
  const registrar = await updateRegistrarNameservers(zone)
  console.log(JSON.stringify({
    ...(await status(zone, created)),
    dnsActions: dns,
    routeActions: routes,
    registrar,
  }, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
