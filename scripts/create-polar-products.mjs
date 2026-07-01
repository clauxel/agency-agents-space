import { writeFile } from 'node:fs/promises'

const token = process.env.POLAR_ACCESS_TOKEN || process.env.POLAR_API_KEY || process.env.POLAR_TOKEN || ''
if (!token) throw new Error('POLAR_ACCESS_TOKEN is required.')

const site = 'agency-agents-space'
const domain = 'agency-agents.space'
const origin = 'https://agency-agents.space'
const today = new Date().toISOString().slice(0, 10)

const plans = [
  { plan: 'starter', name: 'Starter', monthlyCents: 900, summary: 'One focused AI specialist team plan with roster rationale and handoff checklist.' },
  { plan: 'pro', name: 'Pro', monthlyCents: 2900, summary: 'Full sprint roster, NEXUS phase plan, division coverage, evidence gates, and exportable brief.' },
  { plan: 'enterprise', name: 'Enterprise', monthlyCents: 5900, summary: 'Multi-workstream planning for product, growth, security, QA, and support teams.' },
]

const billingPeriods = [
  { billing: 'monthly', multiplier: 1, coverage: 'one month' },
  { billing: 'annual', multiplier: 6, coverage: 'one year' },
]

async function polar(path, options = {}) {
  const response = await fetch(`https://api.polar.sh${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(45_000),
  })
  const text = await response.text()
  let data = {}
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw: text }
    }
  }
  if (!response.ok) {
    const detail = Array.isArray(data?.detail)
      ? data.detail.map((item) => item.msg || item.type).join('; ')
      : ''
    const message = detail ||
      (typeof data?.detail === 'string' ? data.detail : typeof data?.message === 'string' ? data.message : response.statusText)
    throw new Error(`${options.method || 'GET'} ${path} failed: ${message}`)
  }
  return data
}

async function listProducts() {
  const data = await polar('/v1/products/?limit=100')
  return Array.isArray(data.items) ? data.items : []
}

async function listCheckoutLinks() {
  const data = await polar('/v1/checkout-links/?limit=100')
  return Array.isArray(data.items) ? data.items : []
}

function findPrice(product) {
  const prices = Array.isArray(product.prices) ? product.prices : []
  return prices.find((price) => price.amount_type === 'fixed') || prices[0] || null
}

function matchesMetadata(resource, plan, period) {
  return resource?.metadata?.site === site &&
    resource?.metadata?.domain === domain &&
    resource?.metadata?.plan === plan.plan &&
    resource?.metadata?.billing === period.billing
}

async function ensureProduct(plan, period, existingProducts) {
  const amountCents = plan.monthlyCents * period.multiplier
  const periodLabel = period.billing[0].toUpperCase() + period.billing.slice(1)
  const productName = `Agency Agents Space ${plan.name} ${periodLabel}`
  const existing = existingProducts.find((product) => matchesMetadata(product, plan, period))
  if (existing) return existing

  return polar('/v1/products/', {
    method: 'POST',
    body: JSON.stringify({
      name: productName,
      description: `${plan.summary} Covers ${period.coverage}. One-time payment; no automatic renewal.`,
      visibility: 'public',
      recurring_interval: null,
      prices: [
        {
          amount_type: 'fixed',
          price_currency: 'usd',
          price_amount: amountCents,
        },
      ],
      metadata: {
        site,
        domain,
        plan: plan.plan,
        billing: period.billing,
      },
    }),
  })
}

async function ensureCheckoutLink(product, price, plan, period, existingLinks) {
  const existing = existingLinks.find((link) => matchesMetadata(link, plan, period))
  if (existing?.url) return existing

  return polar('/v1/checkout-links/', {
    method: 'POST',
    body: JSON.stringify({
      payment_processor: 'stripe',
      product_price_id: price.id,
      label: `Agency Agents Space ${plan.name} ${period.billing}`,
      allow_discount_codes: true,
      require_billing_address: false,
      success_url: `${origin}/success/?planId=${encodeURIComponent(plan.plan)}&billing=${encodeURIComponent(period.billing)}&checkout_id={CHECKOUT_ID}`,
      return_url: `${origin}/checkout/?planId=${encodeURIComponent(plan.plan)}&billing=${encodeURIComponent(period.billing)}`,
      metadata: {
        site,
        domain,
        plan: plan.plan,
        billing: period.billing,
      },
    }),
  })
}

const existingProducts = await listProducts()
const existingLinks = await listCheckoutLinks()
const products = []

for (const plan of plans) {
  for (const period of billingPeriods) {
    const product = await ensureProduct(plan, period, existingProducts)
    const price = findPrice(product)
    if (!price?.id) throw new Error(`Missing price id for ${plan.plan}:${period.billing}`)
    const link = await ensureCheckoutLink(product, price, plan, period, existingLinks)
    products.push({
      plan: plan.plan,
      billing: period.billing,
      productName: product.name,
      productId: product.id,
      priceId: price.id,
      amountUsd: (plan.monthlyCents * period.multiplier / 100).toFixed(2),
      checkoutLinkId: link.id,
      checkoutUrl: link.url,
    })
  }
}

await writeFile(
  new URL('../polar-products.json', import.meta.url),
  `${JSON.stringify({ provider: 'polar', site, domain, origin, createdAt: today, products }, null, 2)}\n`,
)

console.log(`Created or reused ${products.length} Agency Agents Space Polar checkout links.`)
