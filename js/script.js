;(function () {
  'use strict'

  const $ = (id) => document.getElementById(id)
  const api = () => window.VoltifyAPI
  const state = {
    lang: localStorage.getItem('vlt_lang') || 'en',
    theme: localStorage.getItem('vlt_theme') || 'dark',
    selectedProduct: null,
    settings: { wa: '213676422372', tg: 'CPETechOrdersBot', brandTitle: 'Voltify' },
    products: [],
  }

  const fallbackProducts = [
    { id: 'ff_520', name: 'Free Fire Diamonds', price: 480, category: 'mobile', emoji: '🔥', desc: '520 Diamonds' },
    { id: 'pubg_660', name: 'PUBG Mobile UC', price: 1100, category: 'mobile', emoji: '🎯', desc: '660 UC' },
    { id: 'ml_344', name: 'Mobile Legends', price: 385, category: 'mobile', emoji: '💎', desc: '344 Diamonds' },
    { id: 'psn_10', name: 'PlayStation Gift Card', price: 2500, category: 'gift', emoji: '🎮', desc: 'Digital card' },
    { id: 'mobilis_1000', name: 'Mobilis Credit', price: 1000, category: 'topup', emoji: '📶', desc: 'Mobile top-up' },
  ]

  function applyTheme() {
    document.body.classList.toggle('light', state.theme === 'light')
    const dark = state.theme !== 'light'
    ;['theme-icon-moon', 'theme-icon-m'].forEach((id) => { const el = $(id); if (el) el.style.display = dark ? 'block' : 'none' })
    const sun = $('theme-icon-sun')
    if (sun) sun.style.display = dark ? 'none' : 'block'
  }

  function toggleTheme() {
    state.theme = state.theme === 'light' ? 'dark' : 'light'
    localStorage.setItem('vlt_theme', state.theme)
    applyTheme()
  }

  function openModal(id) { const el = $(id); if (el) el.classList.add('open') }
  function closeModal(id) { const el = $(id); if (el) el.classList.remove('open') }

  function productName(p) {
    return p.name || p.title || p.title_en || p.title_ar || p.slug || 'Voltify service'
  }

  function renderProducts(cat = 'all') {
    const grid = $('games-grid')
    if (!grid) return
    const rows = (state.products.length ? state.products : fallbackProducts)
      .filter((p) => cat === 'all' || (p.category || p.cat) === cat)
    grid.innerHTML = rows.map((p, i) => `
      <article class="game-card reveal active">
        <div class="game-icon">${p.emoji || '⚡'}</div>
        <h3>${productName(p)}</h3>
        <p>${p.desc || p.description || p.pkg || ''}</p>
        <div class="game-price">${Number(p.price || 0).toLocaleString()} DZD</div>
        <button class="btn btn-primary order-btn" data-index="${i}">Order now</button>
      </article>
    `).join('')
    grid.querySelectorAll('.order-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.selectedProduct = rows[Number(btn.dataset.index)]
        $('modal-game-title').textContent = productName(state.selectedProduct)
        $('modal-pkg-name').textContent = state.selectedProduct.desc || productName(state.selectedProduct)
        $('modal-pkg-price').textContent = `${Number(state.selectedProduct.price || 0).toLocaleString()} DZD`
        window.__voltifySelectedAmount = Number(state.selectedProduct.price || 0)
        openModal('order-modal')
      })
    })
  }

  function renderAnnouncements(posts) {
    const section = $('announcements-section')
    const feed = $('announcements-feed')
    if (!section || !feed || !posts || !posts.length) return
    section.style.display = 'block'
    feed.innerHTML = posts.slice(0, 3).map((p) => `
      <div class="glass-card" style="padding:14px">
        <strong>${p.title || 'Update'}</strong>
        <p class="text-muted" style="margin:6px 0 0">${p.body || ''}</p>
      </div>
    `).join('')
  }

  async function loadPublicContent() {
    if (!api()) return renderProducts()
    try {
      const [content, settings] = await Promise.all([api().fetchContent(), api().fetchSettings()])
      state.settings = { ...state.settings, ...(content.settings || {}), ...settings }
      state.products = content.products || []
      localStorage.setItem('vlt_settings', JSON.stringify(state.settings))
      renderAnnouncements(content.posts || [])
    } catch {
      state.products = fallbackProducts
    }
    renderProducts()
  }

  function selectedPayment() {
    const el = document.querySelector('#modal-pay-select .pay-option.selected')
    return el ? el.dataset.pay : 'card'
  }

  async function submitOrder() {
    const product = state.selectedProduct || fallbackProducts[0]
    const customer = $('order-name').value.trim()
    const phone = $('order-phone').value.trim()
    const uid = $('order-uid').value.trim()
    const msg = $('order-msg')
    if (!customer || !phone || !uid) {
      msg.style.display = 'block'
      msg.className = 'msg error'
      msg.textContent = 'Please fill name, phone, and player ID.'
      return
    }
    const method = selectedPayment()
    const payload = {
      customer, phone, uid,
      game: productName(product),
      pkg: product.desc || productName(product),
      price: Number(product.price || 0),
      operator: product.operator || '',
    }
    try {
      const order = await api().request('/api/public/orders', { method: 'POST', body: JSON.stringify(payload) })
      localStorage.setItem('vlt_orders', JSON.stringify([...(JSON.parse(localStorage.getItem('vlt_orders') || '[]')), { ...payload, ...order }]))
      if (method === 'card') {
        const pay = await api().request('/api/public/payments/initiate', {
          method: 'POST',
          body: JSON.stringify({ order_id: order.id, amount: payload.price, currency: 'DZD', method: 'card', locale: state.lang }),
        })
        if (pay.checkout_url) location.href = pay.checkout_url
      } else {
        const text = encodeURIComponent(`New Voltify order ${order.id}: ${payload.game} / ${payload.pkg}, UID ${uid}, phone ${phone}`)
        location.href = `https://wa.me/${state.settings.wa || '213676422372'}?text=${text}`
      }
      msg.style.display = 'block'
      msg.className = 'msg success'
      msg.textContent = `Order created: ${order.tracking_number || order.id}`
    } catch (err) {
      msg.style.display = 'block'
      msg.className = 'msg error'
      msg.textContent = err.message
    }
  }

  async function submitRepair() {
    const contact = document.querySelector('#rep-contact-selector .pay-option.selected')
    const payload = {
      name: $('rep-name').value.trim(),
      phone: $('rep-phone').value.trim(),
      email: $('rep-email').value.trim(),
      dev_type: $('rep-device-type').value,
      brand_model: $('rep-brand-model').value.trim(),
      svc_type: $('rep-service-type').value,
      description: $('rep-desc').value.trim(),
      contact_method: contact ? contact.dataset.method : 'WhatsApp',
    }
    const msg = $('rep-status-msg')
    if (!payload.name || !payload.phone || !payload.brand_model || !payload.description) {
      msg.style.display = 'block'; msg.className = 'msg error'; msg.textContent = 'Please fill required fields.'
      return
    }
    try {
      const repair = await api().request('/api/public/repairs', { method: 'POST', body: JSON.stringify(payload) })
      localStorage.setItem('vlt_repairs', JSON.stringify([...(JSON.parse(localStorage.getItem('vlt_repairs') || '[]')), { ...payload, ...repair }]))
      msg.style.display = 'block'; msg.className = 'msg success'; msg.textContent = `Repair request created: ${repair.code}`
    } catch (err) {
      msg.style.display = 'block'; msg.className = 'msg error'; msg.textContent = err.message
    }
  }

  function wire() {
    applyTheme()
    ;['theme-btn', 'theme-btn-m'].forEach((id) => { const el = $(id); if (el) el.addEventListener('click', toggleTheme) })
    ;['lang-btn', 'lang-btn-m'].forEach((id) => { const el = $(id); if (el) el.addEventListener('click', () => { state.lang = state.lang === 'ar' ? 'en' : 'ar'; localStorage.setItem('vlt_lang', state.lang) }) })
    const hamburger = $('hamburger')
    const drawer = $('nav-drawer')
    const overlay = $('overlay')
    if (hamburger && drawer && overlay) hamburger.addEventListener('click', () => { drawer.classList.add('open'); overlay.classList.add('open') })
    if (overlay) overlay.addEventListener('click', () => { drawer.classList.remove('open'); overlay.classList.remove('open') })
    ;['modal-close', 'modal-cancel'].forEach((id) => { const el = $(id); if (el) el.addEventListener('click', () => closeModal('order-modal')) })
    ;['repair-modal-close', 'rep-modal-cancel'].forEach((id) => { const el = $(id); if (el) el.addEventListener('click', () => closeModal('repair-modal')) })
    ;['repair-nav-link', 'repair-nav-link-mobile'].forEach((id) => { const el = $(id); if (el) el.addEventListener('click', (e) => { e.preventDefault(); openModal('repair-modal') }) })
    document.querySelectorAll('.pay-option').forEach((el) => {
      el.addEventListener('click', () => {
        el.parentElement.querySelectorAll('.pay-option').forEach((x) => x.classList.remove('selected'))
        el.classList.add('selected')
      })
    })
    document.querySelectorAll('#game-tabs .filter-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#game-tabs .filter-tab').forEach((x) => x.classList.remove('active'))
        btn.classList.add('active')
        renderProducts(btn.dataset.cat || 'all')
      })
    })
    const closeAnn = $('close-announcements-btn')
    if (closeAnn) closeAnn.addEventListener('click', () => { $('announcements-section').style.display = 'none' })
    const orderSubmit = $('modal-wa-submit')
    if (orderSubmit) orderSubmit.addEventListener('click', submitOrder)
    const repairSubmit = $('rep-submit-btn')
    if (repairSubmit) repairSubmit.addEventListener('click', submitRepair)
  }

  document.addEventListener('DOMContentLoaded', () => {
    wire()
    loadPublicContent()
  })
})()
