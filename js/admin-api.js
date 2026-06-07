;(function () {
  'use strict'

  const $ = (id) => document.getElementById(id)
  const api = () => window.VoltifyAPI
  let admin = JSON.parse(localStorage.getItem('voltify_admin_user') || 'null')

  function msg(id, text, ok = true) {
    const el = $(id)
    if (!el) return
    el.textContent = text
    el.className = `admin-msg msg ${ok ? 'success' : 'error'}`
  }

  async function request(path, options = {}) {
    return api().request(path, options)
  }

  function isSuper() { return admin && admin.role === 'superadmin' }
  function canWrite() { return admin && (admin.role === 'superadmin' || admin.role === 'editor') }

  function applyRoleUi() {
    document.querySelectorAll('.super-only').forEach((el) => el.classList.toggle('hidden', !isSuper()))
    document.querySelectorAll('.write-only').forEach((el) => el.classList.toggle('hidden', !canWrite()))
    $('roleBadge').textContent = admin ? admin.role : '—'
    $('userLabel').textContent = admin ? admin.username : ''
  }

  function showApp() {
    $('authBox').classList.add('hidden')
    $('app').classList.remove('hidden')
    $('app').classList.add('admin-ready')
    applyRoleUi()
    loadAll()
  }

  async function login() {
    const base = $('apiBase').value.trim()
    api().setBaseUrl(base)
    try {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: $('loginUser').value.trim(), password: $('loginPass').value }),
      })
      localStorage.setItem('voltify_admin_token', res.token)
      localStorage.setItem('voltify_admin_user', JSON.stringify(res.admin))
      admin = res.admin
      showApp()
    } catch (err) {
      msg('authMsg', err.message, false)
    }
  }

  function logout() {
    localStorage.removeItem('voltify_admin_token')
    localStorage.removeItem('voltify_admin_user')
    location.reload()
  }

  function rowActions(type, id) {
    if (!canWrite()) return ''
    return `<button class="btn btn-admin-danger btn-admin-sm" data-del="${type}:${id}">حذف</button>`
  }

  function renderTable(id, rows, map) {
    const body = $(id)
    if (!body) return
    body.innerHTML = rows.map(map).join('') || `<tr><td colspan="7" class="text-muted">لا توجد بيانات</td></tr>`
  }

  async function loadAll() {
    try {
      const [stats, orders, repairs, invoices, products, services, posts, gallery, settings, txns] = await Promise.all([
        request('/api/stats'), request('/api/orders'), request('/api/repairs'), request('/api/invoices'),
        request('/api/products'), request('/api/services'), request('/api/posts'), request('/api/gallery'),
        request('/api/settings'), request('/api/admin/payments/transactions'),
      ])
      $('sOrders').textContent = stats.orders || orders.length || 0
      $('sRepairs').textContent = stats.repairs || repairs.length || 0
      $('sInvoices').textContent = stats.invoices || invoices.length || 0
      $('sRevenue').textContent = Number(stats.revenue || 0).toLocaleString()

      renderTable('ordersBody', orders, (o) => `<tr><td>${o.id}</td><td>${o.customer || '—'}</td><td>${o.game || '—'}</td><td>${o.price || 0}</td><td>${o.status || '—'}</td><td>${rowActions('orders', o.id)}</td></tr>`)
      renderTable('repairsBody', repairs, (r) => `<tr><td>${r.code}</td><td>${r.name || '—'}</td><td>${r.brand_model || r.dev_type || '—'}</td><td>${r.svc_type || '—'}</td><td>${r.status || '—'}</td><td>${rowActions('repairs', r.code)}</td></tr>`)
      renderTable('invoicesBody', invoices, (i) => `<tr><td>${i.id}</td><td>${i.client || '—'}</td><td>${i.orderRef || i.trackingNo || '—'}</td><td>${i.total || i.subtotal || 0}</td><td>${rowActions('invoices', i.id)}</td></tr>`)
      renderTable('productsBody', products, (p) => `<tr><td>${p.name || p.title || '—'}</td><td>${p.price || 0}</td><td>${p.category || p.cat || '—'}</td><td>${rowActions('products', p.id)}</td></tr>`)
      renderTable('postsBody', posts, (p) => `<tr><td>${p.title || '—'}</td><td>${p.type || 'notice'}</td><td>${rowActions('posts', p.id)}</td></tr>`)
      renderTable('galleryBody', gallery, (g) => `<tr><td>${g.label || '—'}</td><td>${g.url ? `<img src="${g.url}" style="height:42px;border-radius:8px">` : '—'}</td><td>${rowActions('gallery', g.id)}</td></tr>`)
      renderTable('transactionsBody', txns, (t) => `<tr><td>${t.id}</td><td>${t.order_id}</td><td>${t.amount}</td><td>${t.method}</td><td>${t.mode}</td><td>${t.status}</td><td><button class="btn btn-outline btn-admin-sm" data-txn="${t.id}">عرض</button></td></tr>`)
      renderServices(services)
      fillSettings(settings)
      if (isSuper()) loadUsers()
    } catch (err) {
      msg('serverAlert', err.message, false)
      $('serverAlert').classList.remove('hidden')
    }
  }

  function renderServices(services) {
    const list = $('servicesList')
    if (!list) return
    list.innerHTML = services.map((s) => `
      <div class="admin-svc-card">
        <div><strong>${s.title_ar || s.title_en || s.slug}</strong><p class="text-muted">${s.desc_ar || s.desc_en || ''}</p></div>
        <div>${s.active === false ? 'غير نشطة' : 'نشطة'} ${rowActions('services', s.id)}</div>
      </div>
    `).join('')
    $('servicesEmpty').classList.toggle('hidden', services.length > 0)
  }

  function fillSettings(s) {
    const map = {
      setWa: 'wa', setTg: 'tg', setBrand: 'brandTitle', setLogo: 'brandLogo',
      setCode: 'passcode', setPayMode: 'payment_mode', setBaridiRIP: 'baridimob_rip',
      setFlexyNum: 'flexy_number', setStripeWebhook: 'stripe_webhook_secret',
      setChargerilyKey: 'chargily_secret_key', setStripeKey: 'stripe_secret_key',
      setTgBotToken: 'tgBotToken', setTgChatId: 'tgChatId',
    }
    Object.entries(map).forEach(([id, key]) => { if ($(id) && s[key]) $(id).value = s[key] })
    if ($('chargilyWebhookUrl')) $('chargilyWebhookUrl').value = `${api().baseUrl}/api/public/payments/webhook/chargily`
  }

  function collectSettings() {
    return {
      wa: $('setWa').value, tg: $('setTg').value, brandTitle: $('setBrand').value, brandLogo: $('setLogo').value,
      passcode: $('setCode').value, payment_mode: $('setPayMode').value, baridimob_rip: $('setBaridiRIP').value,
      flexy_number: $('setFlexyNum').value, stripe_webhook_secret: $('setStripeWebhook').value,
      chargily_secret_key: $('setChargerilyKey').value, stripe_secret_key: $('setStripeKey').value,
      tgBotToken: $('setTgBotToken').value, tgChatId: $('setTgChatId').value,
    }
  }

  async function add(path, data, msgId) {
    try { await request(path, { method: 'POST', body: JSON.stringify(data) }); msg(msgId || 'saveMsg', 'تم الحفظ'); loadAll() }
    catch (err) { msg(msgId || 'saveMsg', err.message, false) }
  }

  async function remove(type, id) {
    if (!confirm('حذف العنصر؟')) return
    const paths = { orders: `/api/orders/${id}`, repairs: `/api/repairs/${id}`, invoices: `/api/invoices/${id}`, products: `/api/products/${id}`, posts: `/api/posts/${id}`, gallery: `/api/gallery/${id}`, services: `/api/services/${id}` }
    await request(paths[type], { method: 'DELETE' })
    loadAll()
  }

  async function loadUsers() {
    const users = await request('/api/admin/users')
    renderTable('usersBody', users, (u) => `<tr><td>${u.username}</td><td>${u.role}</td><td>${u.created_at || '—'}</td><td>${u.id === 1 ? '—' : `<button class="btn btn-admin-danger btn-admin-sm" data-user-del="${u.id}">حذف</button>`}</td></tr>`)
  }

  function servicePayload() {
    const lines = (id) => ($(id).value || '').split('\n').map((x) => x.trim()).filter(Boolean)
    return {
      id: $('svEditId').value || undefined, slug: $('svSlug').value, emoji: $('svEmoji').value, icon: $('svIcon').value,
      sort_order: Number($('svSort').value || 50), action: $('svAction').value, link: $('svLink').value,
      active: $('svActive').checked, coming_soon: $('svSoon').checked, highlight: $('svHighlight').checked,
      image_url: $('svImageUrl').value, title_ar: $('svTitleAr').value, title_en: $('svTitleEn').value,
      title_fr: $('svTitleFr').value, desc_ar: $('svDescAr').value, desc_en: $('svDescEn').value, desc_fr: $('svDescFr').value,
      features_ar: lines('svFeatAr'), features_en: lines('svFeatEn'), features_fr: lines('svFeatFr'),
      btn_ar: $('svBtnAr').value, btn_en: $('svBtnEn').value,
    }
  }

  function wire() {
    $('apiBase').value = api().baseUrl
    $('loginBtn').addEventListener('click', login)
    $('logoutBtn').addEventListener('click', logout)
    document.querySelectorAll('.admin-nav-btn').forEach((btn) => btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-nav-btn').forEach((x) => x.classList.remove('active'))
      document.querySelectorAll('.admin-panel').forEach((x) => x.classList.remove('active'))
      btn.classList.add('active')
      $(btn.dataset.tab).classList.add('active')
    }))
    document.body.addEventListener('click', (e) => {
      const del = e.target.dataset.del
      if (del) { const [type, id] = del.split(':'); remove(type, id) }
      if (e.target.dataset.userDel) request(`/api/admin/users/${e.target.dataset.userDel}`, { method: 'DELETE' }).then(loadUsers)
      if (e.target.dataset.txn) showTxn(e.target.dataset.txn)
    })
    $('addOrder').addEventListener('click', () => add('/api/orders', { customer: $('oCustomer').value, phone: $('oPhone').value, game: $('oGame').value, pkg: $('oPkg').value, price: Number($('oPrice').value || 0), status: $('oStatus').value, uid: $('oUid').value }))
    $('addRepair').addEventListener('click', () => add('/api/repairs', { name: $('rName').value, phone: $('rPhone').value, dev_type: $('rDevice').value, brand_model: $('rModel').value, svc_type: $('rSvc').value, status: $('rStatus').value, estimated_completion_date: $('rEst').value }))
    $('addInvoice').addEventListener('click', () => add('/api/invoices', { client: $('iClient').value, phone: $('iPhone').value, orderRef: $('iRef').value, subtotal: Number($('iSubtotal').value || 0), total: Number($('iSubtotal').value || 0), payment: $('iPayment').value, status: $('iStatus').value, currency: $('iCur').value }))
    $('addProduct').addEventListener('click', () => add('/api/products', { name: $('pName').value, price: Number($('pPrice').value || 0), category: $('pCat').value, operator: $('pOperator').value, amount: Number($('pAmount').value || 0), emoji: $('pEmoji').value, desc: $('pDesc').value, link: $('pLink').value }))
    $('addPost').addEventListener('click', () => add('/api/posts', { title: $('postTitle').value, type: $('postType').value, body: $('postBody').value }))
    $('addGallery').addEventListener('click', () => add('/api/gallery', { label: $('gLabel').value, url: $('gUrl').value }))
    $('saveService').addEventListener('click', () => add('/api/services', servicePayload(), 'svcFormMsg'))
    $('saveSettings').addEventListener('click', async () => { await request('/api/settings', { method: 'PUT', body: JSON.stringify(collectSettings()) }); msg('saveMsg', 'تم حفظ الإعدادات') })
    $('addUser').addEventListener('click', () => add('/api/admin/users', { username: $('uName').value, password: $('uPass').value, role: $('uRole').value }, 'usersMsg'))
    $('seedMobileCredit').addEventListener('click', () => { $('svSlug').value = 'mobile-credit'; $('svTitleAr').value = 'شحن رصيد الهاتف'; $('svTitleEn').value = 'Mobile Credit'; $('svEmoji').value = '📶'; $('svAction').value = 'topup'; $('svSoon').checked = true })
    $('svcResetForm').addEventListener('click', () => document.querySelectorAll('#svcEditor input, #svcEditor textarea').forEach((el) => { if (el.type !== 'checkbox') el.value = '' }))
  }

  async function showTxn(id) {
    const t = await request(`/api/admin/payments/transactions/${id}`)
    $('txnModalContent').innerHTML = `<pre style="white-space:pre-wrap">${JSON.stringify(t, null, 2)}</pre>`
    $('txnModal').classList.add('open')
  }

  document.addEventListener('DOMContentLoaded', () => {
    wire()
    if (localStorage.getItem('voltify_admin_token') && admin) showApp()
  })
})()
