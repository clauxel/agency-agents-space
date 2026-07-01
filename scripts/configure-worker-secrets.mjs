import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

const checkoutPrefix = 'AGENCY_AGENTS_SPACE_CHECKOUT'
const data = JSON.parse(await readFile(new URL('../polar-products.json', import.meta.url), 'utf8'))

function secretName(plan, billing) {
  return `${checkoutPrefix}_${plan}_${billing}`.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
}

function putSecret(name, value) {
  if (!value || !/^https:\/\/([^/]+\.)?polar\.(sh|io)\//i.test(value)) {
    throw new Error(`Refusing to configure invalid Polar checkout URL for ${name}`)
  }
  const result = spawnSync('npx', ['wrangler', 'secret', 'put', name], {
    input: `${value}\n`,
    encoding: 'utf8',
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  if (result.status !== 0) {
    throw new Error(`wrangler secret put failed for ${name}: ${(result.stderr || result.stdout).trim()}`)
  }
  return name
}

const configured = []
for (const product of data.products || []) {
  configured.push(putSecret(secretName(product.plan, product.billing), product.checkoutUrl))
}

console.log(JSON.stringify({
  worker: 'agency-agents-space',
  provider: 'polar',
  configuredSecrets: configured,
  configuredCount: configured.length,
}, null, 2))
