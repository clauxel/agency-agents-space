(() => {
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
      if (payload.checkoutUrl && /^https:\/\/([^/]+\.)?polar\.(sh|io)\//i.test(payload.checkoutUrl)) {
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
})()