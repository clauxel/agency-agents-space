const CONFIG = {
  slug: 'agency-agents-space',
  brand: 'Agency Agents Space',
  productName: 'AI specialist team planner',
  domain: 'agency-agents.space',
  canonicalOrigin: 'https://agency-agents.space',
  supportEmail: 'support@aigeamy.com',
  defaultPlanId: 'pro',
  defaultBilling: 'annual',
  provider: 'polar',
  checkoutPrefix: 'AGENCY_AGENTS_SPACE_CHECKOUT',
  accessTokenSecret: 'AGENCY_AGENTS_SPACE_ACCESS_TOKEN',
  plans: [
    { id: 'starter', name: 'Starter', monthlyUsd: 9, summary: 'One focused specialist-team plan with roster rationale, handoff checklist, and launch risks.' },
    { id: 'pro', name: 'Pro', monthlyUsd: 29, summary: 'Full sprint roster, division coverage, NEXUS phase plan, evidence gates, and exportable brief.' },
    { id: 'enterprise', name: 'Enterprise', monthlyUsd: 59, summary: 'Multi-workstream planning for product, growth, security, QA, and support teams with review loops.' },
  ],
}

const ALT_HOSTS = new Set(['www.' + CONFIG.domain])

function securityHeaders(request) {
  const headers = new Headers({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  })
  const origin = request?.headers?.get?.('Origin')
  if (originAllowed(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    headers.set('Vary', 'Origin')
  }
  return headers
}

function originAllowed(origin) {
  if (!origin) return false
  try {
    const url = new URL(origin)
    return url.hostname === CONFIG.domain ||
      ALT_HOSTS.has(url.hostname) ||
      url.hostname.endsWith('.workers.dev') ||
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

function jsonResponse(data, status = 200, request = null) {
  const headers = securityHeaders(request)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('Cache-Control', 'no-store')
  return new Response(JSON.stringify(data), { status, headers })
}

async function secretValue(value) {
  if (typeof value === 'string') return value.trim()
  if (value?.get) {
    const resolved = await value.get()
    return typeof resolved === 'string' ? resolved.trim() : ''
  }
  return ''
}

function isLocalRequest(request) {
  const host = request?.headers?.get?.('Host') || ''
  const cf = request?.headers?.get?.('CF-Ray') || request?.headers?.get?.('CF-Connecting-IP')
  return host.startsWith('localhost:') || host.startsWith('127.0.0.1:') || !cf
}

function maybeRedirectToCanonical(url, request) {
  if (isLocalRequest(request)) return null
  if (url.hostname === CONFIG.domain || ALT_HOSTS.has(url.hostname)) {
    if (url.protocol !== 'https:' || url.hostname !== CONFIG.domain) {
      const next = new URL(url)
      next.protocol = 'https:'
      next.hostname = CONFIG.domain
      return Response.redirect(next.toString(), 301)
    }
  }
  return null
}

function amountFor(plan, billing) {
  const monthlyUsd = billing === 'annual' ? plan.monthlyUsd * 0.5 : plan.monthlyUsd
  return {
    displayMonthlyUsd: Number(monthlyUsd.toFixed(2)),
    dueTodayUsd: billing === 'annual' ? Number((monthlyUsd * 12).toFixed(2)) : plan.monthlyUsd,
  }
}

function publicPlans() {
  return Object.fromEntries(CONFIG.plans.map((plan) => {
    const monthly = amountFor(plan, 'monthly')
    const annual = amountFor(plan, 'annual')
    return [plan.id, {
      id: plan.id,
      name: plan.name,
      summary: plan.summary,
      monthly: { ...monthly, coverage: 'one month', renewsAutomatically: false },
      annual: { ...annual, coverage: 'one year', discount: '50%', renewsAutomatically: false },
    }]
  }))
}

function normalizePlan(body = {}) {
  const planId = typeof body.plan === 'string' ? body.plan : typeof body.planId === 'string' ? body.planId.split(':')[0] : CONFIG.defaultPlanId
  const plan = CONFIG.plans.find((item) => item.id === planId) ||
    CONFIG.plans.find((item) => item.id === CONFIG.defaultPlanId) ||
    CONFIG.plans[0]
  const billing = body.billing === 'monthly' || body.period === 'monthly' ? 'monthly' : 'annual'
  return { plan, planId: plan.id, billing }
}

function envCheckoutName(planId, billing) {
  return CONFIG.checkoutPrefix + '_' + (planId + '_' + billing).toUpperCase().replace(/[^A-Z0-9_]/g, '_')
}

function validPolarCheckoutUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return ''
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:') return ''
    if (url.hostname === 'buy.polar.sh' || url.hostname.endsWith('.polar.sh') || url.hostname.endsWith('.polar.io')) {
      return url.toString()
    }
    return ''
  } catch {
    return ''
  }
}

async function checkoutUrlFor(env, planId, billing) {
  const specific = await secretValue(env?.[envCheckoutName(planId, billing)])
  if (validPolarCheckoutUrl(specific)) return validPolarCheckoutUrl(specific)
  const generic = await secretValue(env?.[CONFIG.checkoutPrefix])
  return validPolarCheckoutUrl(generic)
}

async function paymentConfigured(env) {
  const required = CONFIG.plans.flatMap((plan) => ['monthly', 'annual'].map((billing) => envCheckoutName(plan.id, billing)))
  const configured = []
  for (const key of required) {
    if (validPolarCheckoutUrl(await secretValue(env?.[key]))) configured.push(key)
  }
  return { ok: configured.length === required.length, configured, required, missing: required.filter((key) => !configured.includes(key)) }
}

async function handleCheckout(request, env) {
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405, request)
  let body = {}
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body.' }, 400, request)
  }
  const { plan, planId, billing } = normalizePlan(body)
  const amount = amountFor(plan, billing)
  const checkoutUrl = await checkoutUrlFor(env, planId, billing)
  if (!checkoutUrl) {
    return jsonResponse({
      ok: false,
      paymentConfigured: false,
      provider: CONFIG.provider,
      error: 'Polar checkout is not configured for this plan yet.',
      planId,
      billing,
      dueTodayUsd: amount.dueTodayUsd,
      contactEmail: CONFIG.supportEmail,
      requiredSecret: envCheckoutName(planId, billing),
    }, 503, request)
  }
  return jsonResponse({
    ok: true,
    paymentConfigured: true,
    provider: CONFIG.provider,
    checkoutUrl,
    planId,
    billing,
    dueTodayUsd: amount.dueTodayUsd,
    terms: 'One-time payment for the selected coverage period. It does not renew automatically.',
  }, 200, request)
}

async function authorized(request, env) {
  const expected = await secretValue(env?.[CONFIG.accessTokenSecret])
  if (!expected) return false
  const header = request.headers.get('Authorization') || ''
  return header === 'Bearer ' + expected
}

function previewPlan(input = {}) {
  const projectType = String(input.projectType || 'saas').toLowerCase()
  const timelineWeeks = Math.max(1, Math.min(24, Number(input.timelineWeeks || 4)))
  const riskLevel = String(input.riskLevel || 'medium')
  const launchChannels = Math.max(1, Math.min(8, Number(input.launchChannels || 3)))
  const needsCompliance = input.needsCompliance === true || input.needsCompliance === 'yes'
  const needsSecurity = input.needsSecurity === true || input.needsSecurity === 'yes'
  const agents = ['Agents Orchestrator', 'Sprint Prioritizer', 'UX Architect', 'Frontend Developer', 'Backend Architect', 'Reality Checker']
  if (projectType.includes('campaign')) agents.push('Growth Hacker', 'Content Creator', 'Social Media Strategist')
  if (needsSecurity || riskLevel === 'high') agents.push('Security Architect', 'Evidence Collector')
  if (needsCompliance) agents.push('Legal Compliance Checker')
  if (launchChannels > 3) agents.push('Analytics Reporter', 'Reddit Community Builder')
  const phases = timelineWeeks <= 2 ? ['Discovery cut', 'Sprint build', 'Reality check'] : ['Discovery', 'Strategy', 'Build loop', 'Hardening', 'Launch']
  return {
    product: CONFIG.productName,
    status: 'preview_only',
    recommendedPlan: agents.length > 9 || needsCompliance ? 'pro' : 'starter',
    roster: Array.from(new Set(agents)).slice(0, 12),
    phases,
    evidenceGates: ['handoff template', 'visual proof', 'API or workflow evidence', 'Reality Checker approval'],
    risks: [
      timelineWeeks < 3 ? 'compress scope before adding more specialists' : 'keep handoffs explicit',
      riskLevel === 'high' ? 'add security and compliance gates before launch' : 'avoid generic prompt-library usage',
      launchChannels > 3 ? 'assign channel owners and daily metrics' : 'keep launch copy tied to one product thesis',
    ],
    gate: 'Full roster rationale, export, and implementation checklist require a paid plan.',
  }
}

async function handlePlanner(request, env) {
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405, request)
  let body = {}
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body.' }, 400, request)
  }
  const preview = previewPlan(body)
  if (!await authorized(request, env)) {
    return jsonResponse({
      ok: false,
      paymentRequired: true,
      status: 402,
      preview,
      pricingUrl: CONFIG.canonicalOrigin + '/pricing/',
      checkoutUrl: CONFIG.canonicalOrigin + '/checkout/?plan=' + preview.recommendedPlan + '&billing=annual',
      message: 'The full AI specialist team plan is gated. Choose a plan before generating the export.',
    }, 402, request)
  }
  return jsonResponse({
    ok: true,
    paymentRequired: false,
    preview,
    export: {
      sections: ['project thesis', 'specialist roster', 'division coverage', 'phase plan', 'handoffs', 'evidence gates', 'launch metrics'],
      nextReviewDays: [3, 6],
    },
  }, 200, request)
}

async function handleRuntime(request, env) {
  const payment = await paymentConfigured(env)
  return jsonResponse({
    ok: true,
    brand: CONFIG.brand,
    productName: CONFIG.productName,
    supportEmail: CONFIG.supportEmail,
    provider: CONFIG.provider,
    paymentConfigured: payment.ok,
    defaultPlanId: CONFIG.defaultPlanId,
    defaultBilling: CONFIG.defaultBilling,
    pricing: publicPlans(),
    checkoutSecrets: { required: payment.required, configuredCount: payment.configured.length, missing: payment.missing },
    terms: 'One-time payments for the selected coverage period. Plans do not renew automatically.',
  }, 200, request)
}

async function handleAnalytics(request, env, url) {
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405, request)
  let body = {}
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body.' }, 400, request)
  }
  const payload = {
    event: String(body.event || 'unknown').slice(0, 80),
    path: String(body.path || url.pathname).slice(0, 240),
    planId: String(body.planId || '').slice(0, 40),
    billing: String(body.billing || '').slice(0, 20),
    source: String(body.source || '').slice(0, 80),
    createdAt: new Date().toISOString(),
  }
  if (env?.DB?.prepare) {
    await env.DB.prepare(
      'insert into analytics_events (event, path, plan_id, billing, source, created_at) values (?, ?, ?, ?, ?, ?)'
    ).bind(payload.event, payload.path, payload.planId, payload.billing, payload.source, payload.createdAt).run()
    return jsonResponse({ ok: true, stored: true, sink: 'cloudflare_d1' }, 202, request)
  }
  return jsonResponse({ ok: true, stored: false, sink: 'missing_d1_binding', blocker: 'D1 binding DB is not configured.' }, 202, request)
}

async function serveAsset(request, env, url) {
  const path = url.pathname === '/' ? '/index.html' : url.pathname
  const assetRequest = new Request(new URL(path, url.origin).toString(), request)
  let response = await env.SITE_ASSETS.fetch(assetRequest)
  if (response.status === 404 && !path.includes('.') && !path.endsWith('/')) {
    response = await env.SITE_ASSETS.fetch(new Request(new URL(path + '/index.html', url.origin).toString(), request))
  }
  if (response.status === 404) {
    const notFound = await env.SITE_ASSETS.fetch(new Request(new URL('/404.html', url.origin).toString(), request))
    if (notFound.status === 200) {
      const headers = new Headers(notFound.headers)
      securityHeaders(request).forEach((value, key) => headers.set(key, value))
      return new Response(notFound.body, { status: 404, headers })
    }
  }
  const headers = new Headers(response.headers)
  securityHeaders(request).forEach((value, key) => headers.set(key, value))
  if (response.status === 200 && /\.(html|xml|txt|json|js|css|svg)$/i.test(path)) {
    headers.set('Cache-Control', path.endsWith('.html') ? 'public, max-age=300' : 'public, max-age=3600')
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

async function handleRequest(request, env = {}) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: securityHeaders(request) })
  const url = new URL(request.url)
  const redirect = maybeRedirectToCanonical(url, request)
  if (redirect) return redirect
  if (url.pathname === '/api/health') return jsonResponse({ ok: true, service: CONFIG.slug }, 200, request)
  if (url.pathname === '/api/runtime') return handleRuntime(request, env)
  if (url.pathname === '/api/checkout') return handleCheckout(request, env)
  if (url.pathname === '/api/planner') return handlePlanner(request, env)
  if (url.pathname === '/api/analytics') return handleAnalytics(request, env, url)
  if (!env.SITE_ASSETS?.fetch) return jsonResponse({ ok: false, error: 'SITE_ASSETS binding is missing.' }, 500, request)
  return serveAsset(request, env, url)
}

export default { fetch: handleRequest }
export { handleRequest, CONFIG, publicPlans, previewPlan, envCheckoutName }
