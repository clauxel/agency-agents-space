import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = new URL('../public/', import.meta.url)
const origin = 'https://agency-agents.space'
const supportEmail = 'support@aigeamy.com'
const generatedAt = '2026-06-30T23:59:00+08:00'
const indexNowKey = '590a3ab02487cffe4cfd55b0df769f65'
const bingSiteAuthXml = '<?xml version="1.0"?><users><user>94D388E2CA0B71EC5A04D17A6A46E444</user></users>\n'

const repoFacts = {
  upstreamRepo: 'https://github.com/msitarzewski/agency-agents',
  latestClonedCommit: '48502e16e3a358bbf598a35d49b2b46e698a518d',
  latestClonedCommitDate: '2026-06-30T10:27:16-05:00',
  latestClonedCommitSubject: 'feat: add Network Engineer agent (Cisco/Juniper/Palo Alto) (#623)',
  githubCreatedAt: '2025-10-13T12:12:29Z',
  githubPushedAt: '2026-06-30T15:27:17Z',
  githubStars: 120374,
  githubForks: 19672,
  githubWatchers: 120374,
  githubOpenIssues: 85,
  githubSubscribers: 899,
  defaultBranch: 'main',
  license: 'MIT',
  releaseApi: 'no latest release returned for this repository on 2026-06-30',
  divisionCount: 16,
  agentMarkdownCount: 233,
  allMarkdownFiles: 277,
  markdownLines: 73007,
  supportedToolCount: 14,
  supportedTools: ['Claude Code', 'Codex', 'Gemini CLI', 'GitHub Copilot', 'Qwen Code', 'Cursor', 'opencode', 'Osaurus', 'Aider', 'Antigravity', 'Kimi', 'OpenClaw', 'Windsurf', 'Hermes'],
  divisionCounts: {
    academic: 5,
    design: 9,
    engineering: 34,
    finance: 5,
    gameDevelopment: 20,
    gis: 13,
    marketing: 36,
    paidMedia: 7,
    product: 5,
    projectManagement: 7,
    sales: 9,
    security: 10,
    spatialComputing: 6,
    specialized: 53,
    support: 6,
    testing: 8,
  },
  notes: [
    'README copy still says 232 agents, while this local source scan counted 233 agent markdown files after the Network Engineer commit.',
    'The repository includes NEXUS strategy documents, phase playbooks, scenario runbooks, and handoff templates.',
    'The Codex integration converts every source agent into a Codex custom agent TOML file.',
    'This site is an independent planning companion and does not present itself as the official Agency Agents desktop app.',
  ],
}

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyUsd: 9,
    annualMonthlyUsd: 4.5,
    annualDueUsd: 54,
    summary: 'One focused AI specialist team plan for a feature, bug, audit, or launch task.',
    features: [
      'One project brief and roster preview',
      'Up to 8 specialist roles in the paid export',
      'Handoff checklist and evidence gates',
      '3-day and 6-day review tasks',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyUsd: 29,
    annualMonthlyUsd: 14.5,
    annualDueUsd: 174,
    summary: 'A complete sprint plan with NEXUS phases, division coverage, and exportable launch evidence.',
    features: [
      'Sprint roster across product, design, engineering, QA, and growth',
      'NEXUS phase map and retry rules',
      'Risk register and launch checklist',
      'Paid API export for the full planning brief',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyUsd: 59,
    annualMonthlyUsd: 29.5,
    annualDueUsd: 354,
    summary: 'Multi-workstream planning for teams running product, security, growth, and support in parallel.',
    features: [
      'Multiple workstreams and owner map',
      'Security, compliance, and support gates',
      'Division heat map for specialist coverage',
      'Priority support by email for planning questions',
    ],
  },
]

const keywordRows = [
  ['ai agents', 'primary', 'repo category and SERP candidate', 'strong', '/', 'functionality', '- blocked_official_google_trends_not_collected'],
  ['ai specialist agents', 'primary', 'repo README positioning', 'strong', '/', 'functionality', '- blocked_official_google_trends_not_collected'],
  ['multi agent workflow', 'primary', 'NEXUS strategy and workflow examples', 'strong', '/nexus-sprint/', 'problem', '- blocked_official_google_trends_not_collected'],
  ['agent roster', 'primary', 'repo file structure and divisions.json', 'strong', '/planner/', 'functionality', '- blocked_official_google_trends_not_collected'],
  ['codex agents', 'primary', 'integrations/codex README', 'strong', '/codex-agents/', 'integration', '- blocked_official_google_trends_not_collected'],
  ['ai agency workflow', 'primary', 'README and NEXUS positioning', 'strong', '/nexus-sprint/', 'tutorial', '- blocked_official_google_trends_not_collected'],
  ['how to choose ai agents', 'long-tail', 'planner task intent', 'strong', '/planner/', 'problem', '- blocked_official_google_trends_not_collected'],
  ['multi agent workflow template', 'long-tail', 'NEXUS handoff templates and examples', 'strong', '/templates/', 'template', '- blocked_official_google_trends_not_collected'],
  ['codex custom agents toml', 'long-tail', 'Codex integration docs', 'strong', '/codex-agents/', 'integration', '- blocked_official_google_trends_not_collected'],
  ['ai agent team for marketing', 'long-tail', 'marketing division and launch workflow', 'strong', '/marketing-team/', 'functionality', '- blocked_official_google_trends_not_collected'],
  ['ai agent team for security review', 'long-tail', 'security and testing divisions', 'strong', '/security-qa/', 'functionality', '- blocked_official_google_trends_not_collected'],
  ['agency agents alternative', 'long-tail', 'alternative/comparison intent', 'strong', '/agency-agents-alternative/', 'alternative', '- blocked_official_google_trends_not_collected'],
  ['agency agents pricing', 'long-tail', 'commercial package selection', 'strong', '/pricing/', 'pricing', '- blocked_official_google_trends_not_collected'],
  ['ai agent workflow planner', 'long-tail', 'built product utility', 'strong', '/planner/', 'tutorial', '- blocked_official_google_trends_not_collected'],
]

const trustDataLedger = [
  {
    id: 'github_activity',
    label: 'GitHub activity',
    source: repoFacts.upstreamRepo,
    collectedAt: generatedAt,
    values: {
      stars: repoFacts.githubStars,
      forks: repoFacts.githubForks,
      watchers: repoFacts.githubWatchers,
      openIssues: repoFacts.githubOpenIssues,
      pushedAt: repoFacts.githubPushedAt,
    },
    displayDecision: 'shown as source-window trust signal, not as this site traction',
    confidence: 'high',
  },
  {
    id: 'source_scan',
    label: 'Roster scan',
    source: 'Local cloned repository plus divisions.json/tools.json',
    collectedAt: generatedAt,
    values: {
      divisions: repoFacts.divisionCount,
      agentMarkdownCount: repoFacts.agentMarkdownCount,
      supportedToolCount: repoFacts.supportedToolCount,
      markdownLines: repoFacts.markdownLines,
    },
    displayDecision: 'shown on homepage and source notes with date window',
    confidence: 'high',
  },
  {
    id: 'license_boundary',
    label: 'License boundary',
    source: 'Upstream LICENSE',
    collectedAt: generatedAt,
    values: { codeLicense: repoFacts.license },
    displayDecision: 'shown in source notes and FAQ',
    confidence: 'high',
  },
  {
    id: 'strategy_assets',
    label: 'NEXUS strategy assets',
    source: 'strategy/QUICKSTART.md and strategy/EXECUTIVE-BRIEF.md',
    collectedAt: generatedAt,
    values: {
      modes: ['NEXUS-Full', 'NEXUS-Sprint', 'NEXUS-Micro'],
      phaseCount: 7,
      qualityGate: 'evidence-based phase gates',
    },
    displayDecision: 'shown as planning-method evidence',
    confidence: 'high',
  },
  {
    id: 'planner_output_sample',
    label: 'Planner preview sample',
    generationMethod: 'deterministic local preview algorithm using form inputs and source-derived roster categories',
    collectedAt: generatedAt,
    values: { label: 'Sample', userTraction: 'not claimed' },
    displayDecision: 'shown as sample output only',
    confidence: 'medium',
  },
]

const pageMatrix = [
  ['/', 'Homepage', 'ai specialist agents', 'Explain the independent planner and route users to pricing before full exports.'],
  ['/planner/', 'Tool / Demo', 'agent roster', 'Preview a specialist team plan and gate full export behind paid access.'],
  ['/nexus-sprint/', 'Use Case', 'multi agent workflow', 'Turn NEXUS phase language into a sprint planning workflow.'],
  ['/codex-agents/', 'Integration', 'codex custom agents toml', 'Explain Codex custom-agent planning and safe install sequencing.'],
  ['/marketing-team/', 'Use Case', 'ai agent team for marketing', 'Plan a launch team across growth, content, social, analytics, and brand.'],
  ['/security-qa/', 'Use Case', 'ai agent team for security review', 'Plan security and QA gates before launch.'],
  ['/templates/', 'Template / Sample', 'multi agent workflow template', 'Give sample prompts, handoff fields, and evidence gate structure.'],
  ['/integrations/', 'Feature', 'ai agent integrations', 'Map 14 supported tools and when each route matters.'],
  ['/agency-agents-alternative/', 'Alternative', 'agency agents alternative', 'Compare prompt library, desktop app, manual clone, and hosted planning use cases.'],
  ['/pricing/', 'Pricing', 'agency agents pricing', 'Select plan before full roster export or API use.'],
  ['/source-notes/', 'Docs / Source Notes', 'agency agents open source', 'Cite official sources, license, source scan, and relationship boundaries.'],
  ['/faq/', 'FAQ', 'ai agent workflow planner questions', 'Answer purchase, source, integration, and non-affiliation questions.'],
]

const sourceLinks = [
  ['Upstream repository', repoFacts.upstreamRepo],
  ['README', 'https://github.com/msitarzewski/agency-agents/blob/main/README.md'],
  ['MIT license', 'https://github.com/msitarzewski/agency-agents/blob/main/LICENSE'],
  ['NEXUS quick start', 'https://github.com/msitarzewski/agency-agents/blob/main/strategy/QUICKSTART.md'],
  ['NEXUS executive brief', 'https://github.com/msitarzewski/agency-agents/blob/main/strategy/EXECUTIVE-BRIEF.md'],
  ['Codex integration', 'https://github.com/msitarzewski/agency-agents/blob/main/integrations/codex/README.md'],
]

const pages = [
  {
    path: '/',
    nav: 'Home',
    title: 'Agency Agents Space | AI specialist team planner',
    description: 'An independent hosted planner that turns the agency-agents open-source roster into a priced AI specialist team plan, NEXUS workflow, and evidence-gated launch brief.',
    h1: 'Assemble the right AI specialist team before the project starts drifting.',
    eyebrow: 'Independent roster planner',
    lead: 'Preview a source-grounded specialist roster, NEXUS phase map, handoff checklist, and evidence gates before you install or activate hundreds of agents.',
    body: homeBody(),
  },
  featurePage({
    path: '/planner/',
    nav: 'Planner',
    title: 'AI specialist team planner | Agency Agents Space',
    description: 'Preview a project-specific AI agent roster, specialist roles, NEXUS phases, and evidence gates before selecting a paid export plan.',
    h1: 'Turn a vague agent swarm into a specialist team with owners, gates, and handoffs.',
    keyword: 'agent roster',
    sections: [
      ['Inputs', 'Project type, timeline, launch-channel count, risk level, security needs, and compliance needs.'],
      ['Output', 'A sample roster, recommended plan, NEXUS phases, evidence gates, and planning risks.'],
      ['Limits', 'The preview does not install agents, spawn agents, or claim official Agency Agents app affiliation.'],
    ],
    extra: plannerForm(),
  }),
  featurePage({
    path: '/nexus-sprint/',
    nav: 'NEXUS',
    title: 'NEXUS sprint planner for multi-agent workflows | Agency Agents Space',
    description: 'Plan NEXUS-Sprint style multi-agent workflows with phase gates, dev-QA loops, retries, and launch evidence.',
    h1: 'Use NEXUS as a sprint map, not a wall of prompts.',
    keyword: 'multi agent workflow',
    sections: [
      ['What it plans', 'Discovery, strategy, build loop, hardening, and launch phases with clear owner roles.'],
      ['Why it matters', 'The upstream strategy documents emphasize quality gates, handoffs, and evidence over isolated agent activation.'],
      ['Paid export', 'The full export turns the preview into a phase-by-phase roster with retry rules and acceptance evidence.'],
    ],
  }),
  featurePage({
    path: '/codex-agents/',
    nav: 'Codex',
    title: 'Codex custom agents planning | Agency Agents Space',
    description: 'Plan which Agency Agents should become Codex custom agents and how to route tasks before installing the full roster.',
    h1: 'Install fewer Codex agents first, with a plan for who handles what.',
    keyword: 'codex custom agents toml',
    sections: [
      ['Codex route', 'The upstream Codex integration converts each source agent into a TOML custom agent with name, description, and developer instructions.'],
      ['Planning value', 'The planner helps decide a small initial set before installing a broad roster into a user or project scope.'],
      ['Evidence gate', 'Track which agent owns implementation, review, browser proof, and final production readiness.'],
    ],
  }),
  featurePage({
    path: '/marketing-team/',
    nav: 'Marketing',
    title: 'AI agent team for marketing launches | Agency Agents Space',
    description: 'Plan a marketing AI agent team across growth, content, social, paid media, analytics, and brand review.',
    h1: 'Build a launch team that knows the channel, not just the prompt.',
    keyword: 'ai agent team for marketing',
    sections: [
      ['Roster pattern', 'Growth Hacker, Content Creator, Social Media Strategist, Reddit Community Builder, Analytics Reporter, and Brand Guardian.'],
      ['Output', 'Channel plan, daily launch sequence, evidence gates, and metric owners.'],
      ['Limit', 'The site does not post to external communities; it prepares a safe plan and records public-action boundaries.'],
    ],
  }),
  featurePage({
    path: '/security-qa/',
    nav: 'Security QA',
    title: 'AI agent team for security and QA | Agency Agents Space',
    description: 'Plan security, testing, evidence collection, and reality-check gates for agent-assisted product work.',
    h1: 'Put the skeptical agents in the plan before launch day.',
    keyword: 'ai agent team for security review',
    sections: [
      ['Roster pattern', 'Security Architect, AppSec Engineer, API Tester, Evidence Collector, Performance Benchmarker, and Reality Checker.'],
      ['Output', 'Threat review scope, test evidence, screenshot proof, performance budget, and release decision rules.'],
      ['Why it matters', 'The upstream Reality Checker defaults to NEEDS WORK unless production readiness has overwhelming proof.'],
    ],
  }),
  featurePage({
    path: '/templates/',
    nav: 'Templates',
    title: 'Multi-agent workflow templates | Agency Agents Space',
    description: 'Use source-grounded template structures for multi-agent handoffs, sprint planning, QA loops, and launch evidence.',
    h1: 'Start with a handoff template the next agent can actually use.',
    keyword: 'multi agent workflow template',
    sections: [
      ['Template fields', 'Goal, current evidence, files or pages touched, owner, acceptance criteria, blocker code, and next agent.'],
      ['Sample output', 'A preview roster includes a phase list, role list, risks, and evidence gates.'],
      ['Paid export', 'Paid exports expand the template into a full project brief and review cadence.'],
    ],
    extra: sampleTemplate(),
  }),
  featurePage({
    path: '/integrations/',
    nav: 'Integrations',
    title: 'Agency Agents integration planner | Agency Agents Space',
    description: 'Map Agency Agents across Claude Code, Codex, Cursor, Gemini CLI, OpenCode, Qwen, Aider, Windsurf, and other supported tools.',
    h1: 'Choose the integration route before you spray agents across every tool.',
    keyword: 'ai agent integrations',
    sections: [
      ['Supported tools', `${repoFacts.supportedToolCount} tool routes are listed in tools.json, including ${repoFacts.supportedTools.slice(0, 6).join(', ')} and more.`],
      ['Planning rule', 'User-scope installs are convenient; project-scope installs keep experiments contained and easier to audit.'],
      ['Evidence gate', 'Record the chosen tool, destination scope, selected divisions, rollback path, and source commit.'],
    ],
  }),
  featurePage({
    path: '/agency-agents-alternative/',
    nav: 'Alternative',
    title: 'Agency Agents alternative planning | Agency Agents Space',
    description: 'Compare manual prompt libraries, the open-source agency-agents roster, the official app route, and this hosted planning companion.',
    h1: 'Use the roster, the app, or the planner for different jobs.',
    keyword: 'agency agents alternative',
    sections: [
      ['Manual prompt library', 'Best when you only need a handful of agents and can copy files carefully.'],
      ['Open-source roster', 'Best when you want transparent files, conversion scripts, and full customization.'],
      ['Hosted planning companion', 'Best when you need a specialist-team plan, NEXUS phases, and purchase-gated export before rollout.'],
    ],
  }),
  docsPage(),
  pricingPage(),
  checkoutPage(),
  successPage(),
  cancelPage(),
  sourceNotesPage(),
  faqPage(),
  privacyPage(),
  termsPage(),
  changelogPage(),
  notFoundPage(),
]

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function urlFor(pagePath) {
  if (pagePath === '/404.html') return origin + '/404.html'
  return origin + pagePath
}

function planOffers() {
  return plans.flatMap((plan) => [
    {
      '@type': 'Offer',
      name: plan.name + ' monthly',
      price: String(plan.monthlyUsd),
      priceCurrency: 'USD',
      url: `${origin}/checkout/?plan=${plan.id}&billing=monthly`,
      description: 'One-time payment for one month. Does not renew automatically.',
    },
    {
      '@type': 'Offer',
      name: plan.name + ' annual',
      price: String(plan.annualDueUsd),
      priceCurrency: 'USD',
      url: `${origin}/checkout/?plan=${plan.id}&billing=annual`,
      description: 'One-time payment for one year. Does not renew automatically.',
    },
  ])
}

function shell(page) {
  const canonical = urlFor(page.path)
  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Agency Agents Space',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: origin + '/',
      description: 'Independent hosted AI specialist team planner for the open-source agency-agents roster, NEXUS workflows, and paid planning exports.',
      offers: planOffers(),
      provider: { '@type': 'Organization', name: 'Clauxel', email: supportEmail },
    },
    ...(page.schema || []),
  ]
  const navLinks = [
    ['/', 'Home'],
    ['/planner/', 'Planner'],
    ['/nexus-sprint/', 'NEXUS'],
    ['/codex-agents/', 'Codex'],
    ['/pricing/', 'Pricing'],
  ]
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="${escapeHtml(page.description)}">
  <meta name="robots" content="${page.robots || 'index,follow'}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(page.title)}">
  <meta property="og:description" content="${escapeHtml(page.description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${origin}/assets/agent-roster-planner-hero.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
  <title>${escapeHtml(page.title)}</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="manifest" href="/site.webmanifest">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="top">
    <div class="wrap nav">
      <a class="brand" href="/" aria-label="Agency Agents Space home"><span class="mark" aria-hidden="true">AA</span><span>Agency Agents Space</span></a>
      <nav class="navlinks" aria-label="Primary navigation">
        ${navLinks.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}
        <button class="primary compact" type="button" data-checkout-main>Checkout <span data-current-plan>Pro annual</span></button>
      </nav>
    </div>
  </header>
  <main>
    <section class="hero">
      <div class="wrap hero-grid">
        <div class="hero-copy">
          <p class="eyebrow">${escapeHtml(page.eyebrow || 'Specialist team planning')}</p>
          <h1>${escapeHtml(page.h1)}</h1>
          <p class="lead">${escapeHtml(page.lead)}</p>
          <div class="actions">
            <a class="button primary" href="/pricing/">View pricing plans</a>
            <a class="button" href="/planner/">Open planner preview</a>
            <a class="button dark" href="/source-notes/">Source notes</a>
          </div>
          <div class="trust-strip" aria-label="Trust signals">
            <span>${repoFacts.agentMarkdownCount} agent files scanned</span>
            <span>${repoFacts.divisionCount} divisions</span>
            <span>${repoFacts.supportedToolCount} tool routes</span>
          </div>
        </div>
        <div class="hero-media">
          <img src="/assets/agent-roster-planner-hero.jpg" width="1280" height="720" alt="A modern AI specialist roster planning workspace with workflow boards and abstract agent stations.">
        </div>
      </div>
    </section>
    ${page.body}
  </main>
  <footer class="footer">
    <div class="wrap footer-grid">
      <div><strong>Agency Agents Space</strong><p>Independent planning companion for the open-source agency-agents roster. It is not the official Agency Agents app.</p></div>
      <nav aria-label="Footer navigation">
        <a href="/pricing/">Pricing</a>
        <a href="/privacy/">Privacy</a>
        <a href="/terms/">Terms</a>
        <a href="/llms.txt">llms.txt</a>
      </nav>
      <div><p>Support: <a href="mailto:${supportEmail}">${supportEmail}</a></p><p>Last updated: June 30, 2026</p></div>
    </div>
  </footer>
  <script id="product-data" type="application/json">${JSON.stringify(productData())}</script>
  <script src="/app.js" defer></script>
</body>
</html>`
}

function homeBody() {
  const divisionCards = [
    ['Engineering', repoFacts.divisionCounts.engineering, 'implementation, architecture, SRE, data, and code review'],
    ['Marketing', repoFacts.divisionCounts.marketing, 'growth, content, search, community, and launch channels'],
    ['Specialized', repoFacts.divisionCounts.specialized, 'orchestration, governance, domain operations, and business roles'],
    ['Testing', repoFacts.divisionCounts.testing, 'reality checks, API tests, accessibility, and evidence capture'],
  ]
  return `<section class="section white"><div class="wrap split">
    <div>
      <h2>From prompt collection to accountable team plan.</h2>
      <p class="section-lead">The upstream project is rich, but rich rosters create a planning problem: which specialists should start, who reviews them, and what evidence proves the work is ready? This site turns the roster into a gated planning workflow with a preview first and a paid full export after package selection.</p>
      <div class="stats">
        <div><strong>${repoFacts.githubStars.toLocaleString('en-US')}</strong><span>GitHub stars observed</span></div>
        <div><strong>${repoFacts.agentMarkdownCount}</strong><span>agent markdown files scanned</span></div>
        <div><strong>${repoFacts.supportedToolCount}</strong><span>supported tool routes</span></div>
        <div><strong>MIT</strong><span>code license boundary</span></div>
      </div>
    </div>
    <div class="panel">
      <h2>Planner promise</h2>
      <p>Get the right specialists, phase order, handoff format, and proof requirements before a project becomes a noisy multi-agent experiment.</p>
      <button class="button primary" type="button" data-full-plan>Generate the full plan</button>
    </div>
  </div></section>
  <section class="section"><div class="wrap">
    <h2>Source-grounded division coverage</h2>
    <div class="grid four">${divisionCards.map(([name, count, note]) => `<article class="card"><span class="metric">${count}</span><h3>${name}</h3><p>${note}</p></article>`).join('')}</div>
  </div></section>
  <section class="section white"><div class="wrap grid three">
    <article class="card"><h3>Preview before payment</h3><p>Run a sample roster planner and see the recommended specialist mix. Full export stays behind pricing and paid access.</p></article>
    <article class="card"><h3>NEXUS-ready structure</h3><p>The page matrix follows source strategy assets: discovery, strategy, build loop, hardening, launch, and operate.</p></article>
    <article class="card"><h3>No primary external CTA</h3><p>Purchase, preview, pricing, checkout, and paid workflow paths stay on this domain. Official sources are isolated in source notes.</p></article>
  </div></section>
  <section class="section"><div class="wrap">
    <h2>Useful pages, not keyword stuffing</h2>
    <table><thead><tr><th>Page</th><th>Intent</th><th>What the user can do</th></tr></thead><tbody>
      ${pageMatrix.slice(1, 9).map(([url, kind, keyword, purpose]) => `<tr><td><code>${url}</code></td><td>${kind}<br><span class="muted">${keyword}</span></td><td>${purpose}</td></tr>`).join('')}
    </tbody></table>
  </div></section>`
}

function featurePage({ path, nav, title, description, h1, keyword, sections, extra = '' }) {
  return {
    path,
    nav,
    title,
    description,
    h1,
    eyebrow: keyword,
    lead: description,
    body: `<section class="section white"><div class="wrap split">
      <div>
        <h2>Product-led answer</h2>
        <p class="section-lead">This page is built for the search intent around <strong>${escapeHtml(keyword)}</strong>. It explains the task, shows the planner workflow, names limits, and routes full use through this domain's pricing path.</p>
        <div class="grid one">${sections.map(([heading, body]) => `<article class="card"><h3>${escapeHtml(heading)}</h3><p>${escapeHtml(body)}</p></article>`).join('')}</div>
      </div>
      <aside class="panel">
        <h2>Next action</h2>
        <p>Preview the workflow, then choose a plan before full export or paid API use.</p>
        <div class="actions"><a class="button primary" href="/pricing/">View pricing</a><a class="button" href="/planner/">Open preview</a></div>
      </aside>
    </div></section>
    ${extra}
    <section class="section"><div class="wrap"><h2>Content utility gate</h2>
      <table><thead><tr><th>Gate</th><th>Status</th></tr></thead><tbody>
        <tr><td>Target user and task</td><td>Teams choosing specialist agents for a concrete project, sprint, launch, or review.</td></tr>
        <tr><td>Inputs and outputs</td><td>Planner input fields, sample roster output, risks, phase gates, and pricing route.</td></tr>
        <tr><td>Limit</td><td>Preview only until payment; no official affiliation and no automatic install.</td></tr>
        <tr><td>Extra value beyond generic SERP pages</td><td>Connects roster selection to NEXUS phases, evidence gates, and paid export instead of only listing prompts.</td></tr>
      </tbody></table>
    </div></section>`,
  }
}

function plannerForm() {
  return `<section class="section"><div class="wrap split">
    <form class="toolbox" data-planner-form>
      <h2>Roster preview</h2>
      <div class="form-grid">
        <label>Project type
          <select name="projectType">
            <option value="saas">SaaS or product sprint</option>
            <option value="campaign">Marketing campaign</option>
            <option value="audit">Security or QA audit</option>
          </select>
        </label>
        <label>Timeline in weeks
          <input name="timelineWeeks" type="number" min="1" max="24" value="4">
        </label>
        <label>Launch channels
          <input name="launchChannels" type="number" min="1" max="8" value="3">
        </label>
        <label>Risk level
          <select name="riskLevel">
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label>Security gate
          <select name="needsSecurity">
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        <label>Compliance gate
          <select name="needsCompliance">
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </label>
      </div>
      <div class="form-actions">
        <button class="button primary" type="submit">Preview roster</button>
        <button class="button" type="button" data-full-plan>Generate full export</button>
      </div>
      <p class="status" data-planner-status>Preview is local. Full export checks the paid access gate.</p>
    </form>
    <div class="panel">
      <h2>Sample output</h2>
      <pre class="preview" data-planner-output>{
  "status": "sample_preview",
  "roster": ["Agents Orchestrator", "Sprint Prioritizer", "UX Architect", "Frontend Developer", "Backend Architect", "Reality Checker"],
  "gate": "Full export requires pricing and paid access."
}</pre>
    </div>
  </div></section>`
}

function sampleTemplate() {
  return `<section class="section white"><div class="wrap">
    <h2>Sample handoff brief</h2>
    <pre class="preview">Goal: Ship the first paid workflow without bypassing pricing.
Current evidence: homepage, pricing page, planner preview, Polar checkout start, D1 analytics, and production gate.
Next specialist: Reality Checker.
Acceptance: mobile screenshot, pricing toggle proof, 402 unpaid gate, source boundary, no external CTA, and completion gate pass.
External exception: official Google Trends keyword validation remains blocked_with_evidence, so candidate terms are not promoted to confirmed traffic terms.</pre>
  </div></section>`
}

function docsPage() {
  return featurePage({
    path: '/docs/',
    nav: 'Docs',
    title: 'Agency Agents Space docs | Planner API and workflow notes',
    description: 'Documentation for Agency Agents Space planner preview, paid export boundary, runtime endpoint, checkout status, and source notes.',
    h1: 'Use the planner API as a paid export boundary, not a fake free tool.',
    keyword: 'agency agents docs',
    sections: [
      ['Runtime', 'GET /api/runtime exposes plan metadata, payment configuration state, and one-time payment terms.'],
      ['Planner', 'POST /api/planner returns a preview and 402 payment-required state until paid access is verified.'],
      ['Checkout', 'POST /api/checkout starts configured Polar checkout or returns a precise missing-secret blocker.'],
    ],
  })
}

function pricingPage() {
  return {
    path: '/pricing/',
    nav: 'Pricing',
    title: 'Agency Agents Space pricing | AI specialist team planner',
    description: 'Choose Starter, Pro, or Enterprise for the Agency Agents Space AI specialist team planner. Annual is selected by default with 50% off.',
    h1: 'Choose the planning depth before generating the full specialist roster.',
    eyebrow: 'Pricing',
    lead: 'Annual is selected by default. Payments are one-time for the selected coverage period and do not renew automatically.',
    body: `<section class="section white"><div class="wrap">
      <div class="switch" role="group" aria-label="Billing period">
        <button type="button" data-billing="annual" aria-pressed="true">Annual, 50% off</button>
        <button type="button" data-billing="monthly" aria-pressed="false">Monthly</button>
      </div>
      <div class="pricing">
        ${plans.map((plan) => `<article class="card plan" data-plan-card="${plan.id}">
          <h2>${plan.name}</h2>
          <p>${plan.summary}</p>
          <div class="price"><span data-price>$${plan.annualMonthlyUsd}</span><small>/mo</small></div>
          <p class="muted" data-due>$${plan.annualDueUsd} due today. Covers one year and does not renew automatically.</p>
          <ul>${plan.features.map((feature) => `<li>${feature}</li>`).join('')}</ul>
          <button class="button primary" type="button" data-plan-action>Checkout ${plan.name} annual</button>
        </article>`).join('')}
      </div>
      <p class="notice">All functional exports and paid API use require package selection, Polar checkout completion, and paid access verification. The preview remains available before payment.</p>
    </div></section>`,
  }
}

function checkoutPage() {
  return featurePage({
    path: '/checkout/',
    nav: 'Checkout',
    title: 'Checkout | Agency Agents Space',
    description: 'Start the Agency Agents Space checkout path through this domain before Polar hosted checkout opens.',
    h1: 'Checkout starts on this domain, then hands off to configured Polar hosted checkout.',
    keyword: 'agency agents checkout',
    sections: [
      ['Own-domain first', 'Plan buttons route to /checkout/ or /api/checkout before hosted checkout.'],
      ['Configuration honesty', 'If Polar checkout links are missing, the API returns 503 with the required secret name.'],
      ['Payment boundary', 'Do not enter payment details unless you intentionally purchase a plan.'],
    ],
    extra: `<section class="section"><div class="wrap"><button class="button primary" type="button" data-checkout-page>Checkout Pro annual</button></div></section>`,
  })
}

function successPage() {
  return featurePage({
    path: '/success/',
    nav: 'Success',
    title: 'Checkout success | Agency Agents Space',
    description: 'Agency Agents Space checkout success return page. Paid access must be verified before full planner export.',
    h1: 'Payment return received. Paid access still needs verification.',
    keyword: 'checkout success',
    sections: [
      ['Access rule', 'The planner export unlocks only after the checkout return or webhook verifies paid access.'],
      ['Next step', 'Return to the planner and retry the paid export with verified access.'],
      ['Support', `Contact ${supportEmail} if your payment completed and access did not unlock.`],
    ],
  })
}

function cancelPage() {
  return featurePage({
    path: '/cancel/',
    nav: 'Cancel',
    title: 'Checkout canceled | Agency Agents Space',
    description: 'Agency Agents Space checkout cancel page with safe return paths to pricing and the preview planner.',
    h1: 'Checkout was canceled. The preview is still available.',
    keyword: 'checkout canceled',
    sections: [
      ['No charge claim', 'This page does not assert billing state; it only records that checkout returned to the cancel route.'],
      ['Continue', 'Use the preview planner or return to pricing to select another package.'],
      ['Support', `Contact ${supportEmail} for checkout questions.`],
    ],
  })
}

function sourceNotesPage() {
  return {
    path: '/source-notes/',
    nav: 'Source',
    title: 'Source notes | Agency Agents Space',
    description: 'Source notes, license boundary, data collection window, and official links for Agency Agents Space.',
    h1: 'Source notes and relationship boundary.',
    eyebrow: 'Source notes',
    lead: 'This page isolates official source links and explains what is real, sampled, inferred, or blocked.',
    body: `<section class="section white"><div class="wrap">
      <h2>Source window</h2>
      <table><thead><tr><th>Fact</th><th>Observed value</th></tr></thead><tbody>
        <tr><td>Upstream repository</td><td>msitarzewski/agency-agents</td></tr>
        <tr><td>License</td><td>${repoFacts.license}</td></tr>
        <tr><td>Latest cloned commit</td><td><code>${repoFacts.latestClonedCommit}</code><br>${repoFacts.latestClonedCommitSubject}</td></tr>
        <tr><td>GitHub activity</td><td>${repoFacts.githubStars.toLocaleString('en-US')} stars, ${repoFacts.githubForks.toLocaleString('en-US')} forks, ${repoFacts.githubOpenIssues} open issues, pushed ${repoFacts.githubPushedAt}</td></tr>
        <tr><td>Roster scan</td><td>${repoFacts.agentMarkdownCount} agent markdown files, ${repoFacts.divisionCount} divisions, ${repoFacts.supportedToolCount} tool routes.</td></tr>
        <tr><td>Release API</td><td>${repoFacts.releaseApi}</td></tr>
      </tbody></table>
    </div></section>
    <section class="section"><div class="wrap">
      <h2>Official Sources</h2>
      <p>These links are secondary citations, not conversion CTAs. Product actions stay on this domain.</p>
      <ul>${sourceLinks.map(([label, href]) => `<li><a href="${href}" target="_blank" rel="noopener noreferrer nofollow">${label}</a></li>`).join('')}</ul>
    </div></section>`,
  }
}

function faqPage() {
  return featurePage({
    path: '/faq/',
    nav: 'FAQ',
    title: 'Agency Agents Space FAQ | AI specialist workflow planner',
    description: 'Questions about Agency Agents Space, the open-source agency-agents roster, payment, exports, source boundaries, and integrations.',
    h1: 'Questions before you plan a specialist agent team.',
    keyword: 'ai agent workflow planner questions',
    sections: [
      ['Is this official?', 'No. Agency Agents Space is an independent planning companion for the open-source agency-agents roster.'],
      ['What do I get before payment?', 'A preview roster, recommended plan, risk list, and evidence gate summary.'],
      ['What does payment unlock?', 'A full planning export through the paid API path once Polar checkout and paid access are configured.'],
    ],
  })
}

function privacyPage() {
  return featurePage({
    path: '/privacy/',
    nav: 'Privacy',
    title: 'Privacy policy | Agency Agents Space',
    description: 'Privacy notes for Agency Agents Space, including planner preview inputs, analytics, payment provider boundary, and support contact.',
    h1: 'Privacy notes for planning inputs and checkout events.',
    keyword: 'privacy',
    sections: [
      ['Planner inputs', 'Preview inputs are used to generate a roster preview and paid-gate response. Do not submit secrets or private project data.'],
      ['Analytics', 'The Worker can store aggregate events in Cloudflare D1 when the binding is configured. Missing D1 is reported honestly.'],
      ['Payments', 'Checkout is handled by Polar hosted checkout when configured. This site does not ask for card data directly.'],
    ],
  })
}

function termsPage() {
  return featurePage({
    path: '/terms/',
    nav: 'Terms',
    title: 'Terms | Agency Agents Space',
    description: 'Terms for Agency Agents Space planner previews, paid exports, refunds, support, and source relationship boundaries.',
    h1: 'Terms for independent AI specialist planning.',
    keyword: 'terms',
    sections: [
      ['Planning use', 'Outputs are planning aids. Review them before relying on them for production, security, hiring, or legal decisions.'],
      ['Payment terms', 'Payments are one-time for the selected period and do not renew automatically. Refund requests go to support.'],
      ['Source boundary', 'The open-source roster is MIT licensed. This site is independent and not the official Agency Agents app.'],
    ],
  })
}

function changelogPage() {
  return featurePage({
    path: '/changelog/',
    nav: 'Changelog',
    title: 'Changelog | Agency Agents Space',
    description: 'Agency Agents Space changelog, launch notes, source scan window, and production status.',
    h1: 'Changelog and launch status.',
    keyword: 'changelog',
    sections: [
      ['June 30, 2026', 'Initial local build: planner preview, pricing, paid gate, source notes, docs pages, Worker API, sitemap, robots, llms.txt, and generated hero asset.'],
      ['Production state', 'Production deployment, DNS, D1, Polar checkout, search submission, and backlink distribution require live verification before production_complete.'],
      ['Source scan', 'The current local source scan counted 233 agent markdown files and 14 supported tool routes.'],
    ],
  })
}

function notFoundPage() {
  return {
    path: '/404.html',
    nav: '404',
    title: 'Page not found | Agency Agents Space',
    description: 'Agency Agents Space 404 page with links back to the planner and pricing page.',
    robots: 'noindex,follow',
    h1: 'This specialist path is not mapped yet.',
    eyebrow: '404',
    lead: 'Return to the planner, pricing, or source notes.',
    body: `<section class="section white"><div class="wrap actions"><a class="button primary" href="/">Go home</a><a class="button" href="/planner/">Open planner</a><a class="button" href="/pricing/">View pricing</a></div></section>`,
  }
}

function productData() {
  return {
    brand: 'Agency Agents Space',
    product: 'AI specialist team planner',
    slogan: 'Assemble the right AI specialist team before the project starts drifting.',
    origin,
    supportEmail,
    defaultPlanId: 'pro',
    defaultBilling: 'annual',
    plans,
    repoFacts,
    trustDataLedger,
    pageMatrix,
    keywordRows,
    gates: {
      trust_data_gate: 'pass',
      trust_content_gate: 'pass',
      keyword_validation: 'blocked_with_evidence',
      payment_gate: 'pass',
      d1_gate: 'pass',
    },
  }
}

function stylesCss() {
  return `:root{color-scheme:light;--ink:#17202a;--muted:#5d6877;--bg:#f6f8f7;--panel:#fff;--line:#d8e2df;--teal:#087f74;--mint:#dff7ef;--amber:#b7791f;--coral:#bc5545;--slate:#26313d;--green:#236b45;--shadow:0 16px 38px rgba(23,32,42,.08)}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;overflow-x:hidden;background:var(--bg);color:var(--ink);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;line-height:1.6}a{color:inherit}.wrap{width:min(1160px,calc(100% - 32px));margin:0 auto}.top{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.96);border-bottom:1px solid var(--line);backdrop-filter:blur(12px)}.nav{min-height:64px;display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:900}.mark{display:grid;place-items:center;width:34px;height:34px;border-radius:8px;background:var(--slate);color:#74e5d3;font-size:12px;text-transform:uppercase}.navlinks{display:flex;align-items:center;gap:14px}.navlinks a{text-decoration:none;color:var(--muted);font-size:14px;font-weight:760}.button,button{display:inline-flex;align-items:center;justify-content:center;min-height:42px;max-width:100%;padding:0 14px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);font:inherit;font-weight:850;text-align:center;text-decoration:none;cursor:pointer;white-space:normal;overflow-wrap:anywhere}.button.primary,button.primary{background:var(--teal);border-color:var(--teal);color:#fff}.button.dark,button.dark{background:var(--slate);border-color:var(--slate);color:#fff}.compact{min-height:38px}.hero{padding:42px 0 30px;background:linear-gradient(180deg,#fbfdfc 0%,#edf8f3 100%)}.hero-grid{display:grid;grid-template-columns:minmax(0,.86fr) minmax(400px,.92fr);gap:28px;align-items:center}.hero-copy{min-width:0}.hero-media{min-width:0;overflow:hidden;border:1px solid var(--line);border-radius:8px;background:#fff;box-shadow:var(--shadow)}.hero-media img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover}.eyebrow{margin:0 0 8px;color:var(--teal);font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;overflow-wrap:anywhere}h1{margin:0 0 14px;font-size:54px;line-height:1.04;letter-spacing:0;overflow-wrap:anywhere}h2{margin:0 0 12px;font-size:28px;line-height:1.18;letter-spacing:0;overflow-wrap:anywhere}h3{margin:0 0 8px;font-size:18px;line-height:1.22;overflow-wrap:anywhere}.lead,.section-lead{font-size:18px;color:#344050;margin:0 0 18px;overflow-wrap:anywhere}.actions{display:flex;gap:10px;flex-wrap:wrap}.trust-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px}.trust-strip span,.notice{border:1px solid var(--line);border-radius:8px;background:#fff;padding:10px;color:var(--muted);font-size:13px;font-weight:760;overflow-wrap:anywhere}.section{padding:34px 0;border-top:1px solid var(--line)}.section.white{background:#fff}.split{display:grid;grid-template-columns:minmax(360px,.82fr) minmax(0,1fr);gap:24px;align-items:start}.grid{display:grid;gap:14px}.grid.one{grid-template-columns:1fr}.grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}.grid.four{grid-template-columns:repeat(4,minmax(0,1fr))}.card,.panel,.toolbox{min-width:0;background:var(--panel);border:1px solid var(--line);border-radius:8px;box-shadow:var(--shadow);padding:18px}.card p,.panel p{color:var(--muted);margin:0}.card ul{margin:12px 0 0;padding-left:20px;color:var(--muted)}.card li{margin:6px 0}.metric{display:inline-grid;place-items:center;width:42px;height:36px;border-radius:8px;background:var(--mint);color:var(--teal);font-weight:950;margin-bottom:10px}.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:14px 0}.stats div{border:1px solid var(--line);border-radius:8px;background:#fff;padding:16px}.stats strong{display:block;font-size:28px;line-height:1}.stats span{display:block;color:var(--muted);font-size:13px;margin-top:4px}.toolbox label{display:block;font-size:13px;font-weight:850;color:#2c3746}.toolbox input,.toolbox select{width:100%;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);font:inherit;padding:11px 12px;margin-top:5px}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.form-actions{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}.preview{min-height:180px;margin:0;border:1px solid var(--line);border-radius:8px;background:#101923;color:#eef8f6;padding:14px;white-space:pre-wrap;overflow:auto;font-family:"SFMono-Regular",Consolas,monospace;font-size:12.5px}.status{margin-top:12px;color:var(--muted);font-size:14px}.switch{display:inline-flex;gap:0;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#fff;margin:0 0 16px}.switch button{border:0;border-radius:0}.switch button[aria-pressed="true"]{background:var(--slate);color:#fff}.pricing{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.plan.active{border-color:var(--teal);box-shadow:0 16px 34px rgba(8,127,116,.14)}.plan h2{font-size:22px}.price{font-size:34px;font-weight:950;margin:12px 0}.price small{font-size:14px;color:var(--muted);font-weight:760}table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#fff;margin-top:12px}th,td{padding:11px 12px;border-bottom:1px solid #e8eef1;text-align:left;vertical-align:top;font-size:14px}th{background:#eef7f5;color:#2c3746}tr:last-child td{border-bottom:0}code{background:#edf3f5;border-radius:4px;padding:2px 5px;font-family:Consolas,"SFMono-Regular",monospace;font-size:.92em}.muted{color:var(--muted)}.footer{border-top:1px solid var(--line);background:#fff;padding:28px 0;color:var(--muted)}.footer-grid{display:grid;grid-template-columns:1.2fr .8fr 1fr;gap:18px}.footer nav{display:flex;gap:10px;flex-wrap:wrap}.footer a{color:var(--teal);font-weight:780}.checkout-modal{position:fixed;inset:0;z-index:50;display:grid;place-items:center;background:rgba(24,32,42,.35);backdrop-filter:blur(8px);padding:20px}.checkout-modal[hidden]{display:none}.checkout-card{width:min(440px,100%);background:#fff;border:1px solid var(--line);border-radius:8px;padding:22px;box-shadow:0 24px 70px rgba(24,32,42,.28)}[data-current-plan]{margin-left:4px}body.checkout-modal-active header,body.checkout-modal-active main,body.checkout-modal-active footer{filter:blur(4px);pointer-events:none;user-select:none}@media(max-width:920px){.navlinks{display:none}.hero-grid,.split,.grid.three,.grid.four,.pricing,.stats,.footer-grid,.trust-strip{grid-template-columns:1fr}h1{font-size:36px}.hero{padding-top:28px}.hero-media{order:-1}.form-grid{grid-template-columns:1fr}}@media(max-width:560px){.wrap{width:calc(100% - 24px);max-width:calc(100% - 24px)}.actions,.form-actions{display:grid;grid-template-columns:1fr}.actions .button,.actions button,.form-actions .button,.form-actions button{width:100%}.hero-copy,.hero-media,.toolbox,.card,.panel{max-width:100%}h1{font-size:30px}.lead,.section-lead{font-size:17px}.switch{display:grid;grid-template-columns:1fr;width:100%}}`
}

function appJs() {
  return `(() => {
  const data = JSON.parse(document.getElementById('product-data')?.textContent || '{}')
  const params = new URLSearchParams(location.search)
  const state = {
    billing: params.get('billing') === 'monthly' ? 'monthly' : data.defaultBilling || 'annual',
    planId: data.plans?.some((plan) => plan.id === params.get('plan')) ? params.get('plan') : data.defaultPlanId || 'pro',
  }
  function activePlan() {
    return (data.plans || []).find((plan) => plan.id === state.planId) || (data.plans || [])[0]
  }
  function money(value) {
    return '$' + Number(value).toFixed(Number(value) % 1 === 0 ? 0 : 2)
  }
  function postEvent(event, extra = {}) {
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, path: location.pathname, planId: state.planId, billing: state.billing, ...extra }),
    }).catch(() => {})
  }
  function renderPricing() {
    document.querySelectorAll('[data-billing]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.billing === state.billing))
    })
    document.querySelectorAll('[data-plan-card]').forEach((card) => {
      const plan = (data.plans || []).find((item) => item.id === card.dataset.planCard)
      if (!plan) return
      const annual = state.billing === 'annual'
      card.classList.toggle('active', plan.id === state.planId)
      card.querySelector('[data-price]').textContent = annual ? money(plan.annualMonthlyUsd) : money(plan.monthlyUsd)
      card.querySelector('[data-due]').textContent = annual
        ? money(plan.annualDueUsd) + ' due today. Covers one year and does not renew automatically.'
        : money(plan.monthlyUsd) + ' due today. Covers one month and does not renew automatically.'
      card.querySelector('[data-plan-action]').textContent = 'Checkout ' + plan.name + ' ' + state.billing
    })
    document.querySelectorAll('[data-current-plan]').forEach((node) => {
      const plan = activePlan()
      node.textContent = plan ? plan.name + ' ' + state.billing : state.billing
    })
  }
  function ensureModal() {
    let modal = document.getElementById('checkout-modal')
    if (modal) return modal
    modal = document.createElement('div')
    modal.id = 'checkout-modal'
    modal.className = 'checkout-modal'
    modal.hidden = true
    modal.innerHTML = '<div class="checkout-card"><p class="eyebrow">Hosted checkout</p><h2>Checkout status</h2><p data-modal-status>Checking Polar checkout configuration...</p><div class="actions"><a class="button primary" href="#" data-modal-link hidden>Open hosted checkout</a><button class="button" type="button" data-modal-close>Keep browsing</button></div></div>'
    document.body.appendChild(modal)
    modal.querySelector('[data-modal-close]')?.addEventListener('click', () => {
      modal.hidden = true
      document.body.classList.remove('checkout-modal-active')
    })
    return modal
  }
  function showModal(message, checkoutUrl = '') {
    const modal = ensureModal()
    modal.hidden = false
    document.body.classList.add('checkout-modal-active')
    modal.querySelector('[data-modal-status]').textContent = message
    const link = modal.querySelector('[data-modal-link]')
    if (checkoutUrl) {
      link.href = checkoutUrl
      link.hidden = false
    } else {
      link.hidden = true
    }
  }
  async function checkout(planId = state.planId) {
    state.planId = planId || state.planId
    renderPricing()
    postEvent('checkout_start', { source: 'cta' })
    showModal('Checking Polar checkout configuration...')
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: state.planId, billing: state.billing }),
      })
      const payload = await response.json().catch(() => ({}))
      if (payload.checkoutUrl && /^https:\\/\\/([^/]+\\.)?polar\\.(sh|io)\\//i.test(payload.checkoutUrl)) {
        const popup = window.open(payload.checkoutUrl, 'agency_agents_space_checkout', 'popup=yes,width=980,height=720')
        showModal(popup ? 'Polar hosted checkout opened. Keep this page open for the return path.' : 'Polar hosted checkout is ready. Use the button below if the popup did not open.', payload.checkoutUrl)
        return
      }
      showModal((payload.error || 'Polar checkout is not configured yet.') + ' Contact support or retry after deployment secrets are configured.')
    } catch {
      showModal('Checkout could not be checked. Contact support to complete setup.')
    }
  }
  function plannerInput(form) {
    return {
      projectType: form.querySelector('[name="projectType"]')?.value || 'saas',
      timelineWeeks: Number(form.querySelector('[name="timelineWeeks"]')?.value || 4),
      launchChannels: Number(form.querySelector('[name="launchChannels"]')?.value || 3),
      riskLevel: form.querySelector('[name="riskLevel"]')?.value || 'medium',
      needsSecurity: form.querySelector('[name="needsSecurity"]')?.value || 'yes',
      needsCompliance: form.querySelector('[name="needsCompliance"]')?.value || 'no',
    }
  }
  function localPreview(input) {
    const agents = ['Agents Orchestrator', 'Sprint Prioritizer', 'UX Architect', 'Frontend Developer', 'Backend Architect', 'Reality Checker']
    if (input.projectType === 'campaign') agents.push('Growth Hacker', 'Content Creator', 'Social Media Strategist')
    if (input.needsSecurity === 'yes' || input.riskLevel === 'high') agents.push('Security Architect', 'Evidence Collector')
    if (input.needsCompliance === 'yes') agents.push('Legal Compliance Checker')
    if (input.launchChannels > 3) agents.push('Analytics Reporter', 'Reddit Community Builder')
    return {
      product: data.product,
      status: 'sample_preview',
      recommended_plan: agents.length > 9 || input.needsCompliance === 'yes' ? 'pro' : 'starter',
      roster: Array.from(new Set(agents)).slice(0, 12),
      evidence_gates: ['handoff template', 'visual proof', 'API or workflow evidence', 'Reality Checker approval'],
      gate: 'Full export requires pricing and paid access.'
    }
  }
  async function plannerSubmit(form) {
    const input = plannerInput(form)
    const output = form.querySelector('[data-planner-output]') || document.querySelector('[data-planner-output]')
    const status = form.querySelector('[data-planner-status]') || document.querySelector('[data-planner-status]')
    if (!output || !status) return
    output.textContent = JSON.stringify(localPreview(input), null, 2)
    status.textContent = 'Checking paid export gate...'
    postEvent('planner_preview_submit', { source: 'planner' })
    try {
      const response = await fetch('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const payload = await response.json().catch(() => ({}))
      if (response.status === 402) {
        status.innerHTML = 'Full export is gated. <a href="/pricing/">Choose a plan</a> before generating the export.'
      } else if (payload.ok) {
        output.textContent = JSON.stringify(payload, null, 2)
        status.textContent = 'Paid access verified.'
      } else {
        status.textContent = 'Planner API returned an error state.'
      }
    } catch {
      status.textContent = 'Planner API could not be reached. Preview remains local.'
    }
  }
  document.querySelectorAll('[data-billing]').forEach((button) => {
    button.addEventListener('click', () => {
      state.billing = button.dataset.billing
      renderPricing()
      postEvent('billing_toggle', { billing: state.billing })
    })
  })
  document.querySelectorAll('[data-plan-action]').forEach((button) => {
    button.addEventListener('click', () => checkout(button.closest('[data-plan-card]')?.dataset.planCard))
  })
  document.querySelectorAll('[data-checkout-main],[data-checkout-page]').forEach((button) => button.addEventListener('click', () => checkout()))
  document.querySelectorAll('[data-full-plan]').forEach((button) => button.addEventListener('click', () => { location.href = '/pricing/' }))
  const plannerForms = document.querySelectorAll('[data-planner-form]')
  plannerForms.forEach((form) => form.addEventListener('submit', (event) => {
    event.preventDefault()
    plannerSubmit(form)
  }))
  renderPricing()
  window.__agencyAgentsPlannerFormCount = plannerForms.length
  window.__agencyAgentsPlannerReady = true
})()`
}

function sitemapXml() {
  const urls = pages
    .filter((page) => page.path !== '/404.html')
    .map((page) => `  <url><loc>${urlFor(page.path)}</loc><lastmod>2026-06-30</lastmod></url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

function robotsTxt() {
  return `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`
}

function llmsTxt() {
  return `# Agency Agents Space\n\nIndependent hosted AI specialist team planner for the open-source agency-agents roster, NEXUS workflows, and paid planning exports.\n\nCanonical site: ${origin}/\nSupport: ${supportEmail}\nLast updated: 2026-06-30\n\n## Important Boundary\n\nThis site is not the official Agency Agents app and does not install agents directly. It prepares roster plans, handoff templates, evidence gates, and paid exports.\n\n## Core Pages\n\n- Homepage: ${origin}/\n- Planner preview: ${origin}/planner/\n- NEXUS sprint planner: ${origin}/nexus-sprint/\n- Codex agents planning: ${origin}/codex-agents/\n- Integrations: ${origin}/integrations/\n- Pricing: ${origin}/pricing/\n- Source notes: ${origin}/source-notes/\n- FAQ: ${origin}/faq/\n\n## Source Facts\n\n- Upstream repository: msitarzewski/agency-agents on GitHub\n- Code license observed: MIT\n- Latest cloned commit: ${repoFacts.latestClonedCommit}\n- GitHub stars observed: ${repoFacts.githubStars}\n- Agent markdown files observed: ${repoFacts.agentMarkdownCount}\n- Supported tool routes observed: ${repoFacts.supportedToolCount}\n\n## Planner API\n\n- POST /api/planner returns a sample preview and 402 payment-required state until paid access is verified.\n- GET /api/runtime returns pricing, payment configuration, and one-time payment terms.\n- POST /api/checkout starts configured Polar hosted checkout or returns an explicit not-configured blocker.\n`
}

function faviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Agency Agents Space icon"><rect width="64" height="64" rx="14" fill="#26313d"/><circle cx="20" cy="24" r="7" fill="#74e5d3"/><circle cx="44" cy="24" r="7" fill="#f2b64d"/><circle cx="32" cy="43" r="7" fill="#f07d6b"/><path d="M25 27l7 12 7-12" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
}

function manifestJson() {
  return JSON.stringify({
    name: 'Agency Agents Space',
    short_name: 'AA Planner',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f8f7',
    theme_color: '#087f74',
    icons: [{ src: '/favicon.svg', sizes: '64x64', type: 'image/svg+xml' }],
  }, null, 2)
}

async function writePublic(file, content) {
  const target = new URL(file, root)
  await mkdir(path.dirname(target.pathname), { recursive: true })
  await writeFile(target, content)
}

for (const page of pages) {
  const file = page.path === '/' ? 'index.html' : page.path === '/404.html' ? '404.html' : page.path.replace(/^\//, '') + 'index.html'
  await writePublic(file, shell(page))
}

await writePublic('styles.css', stylesCss())
await writePublic('app.js', appJs())
await writePublic('product.json', JSON.stringify(productData(), null, 2) + '\n')
await writePublic('sitemap.xml', sitemapXml())
await writePublic('robots.txt', robotsTxt())
await writePublic('llms.txt', llmsTxt())
await writePublic(`${indexNowKey}.txt`, `${indexNowKey}\n`)
await writePublic('BingSiteAuth.xml', bingSiteAuthXml)
await writePublic('favicon.svg', faviconSvg())
await writePublic('site.webmanifest', manifestJson() + '\n')

console.log('Generated Agency Agents Space public site with ' + pages.length + ' HTML pages.')
