;(function () {
  'use strict'

  function cleanBase(base) {
    return String(base || '').replace(/\/+$/, '')
  }

  const storedBase = localStorage.getItem('voltify_api_base')
  const defaultBase = location.protocol === 'file:' ? 'http://localhost:4000' : location.origin
  const state = { baseUrl: cleanBase(storedBase || defaultBase) }

  async function request(path, options = {}) {
    const url = /^https?:\/\//i.test(path) ? path : state.baseUrl + '/' + String(path).replace(/^\/+/, '')
    const headers = { ...(options.headers || {}) }
    if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json'
    }
    const token = localStorage.getItem('voltify_admin_token')
    if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`

    const res = await fetch(url, { ...options, headers })
    const contentType = res.headers.get('content-type') || ''
    const body = contentType.includes('application/json') ? await res.json() : await res.text()
    if (!res.ok) {
      const message = body && typeof body === 'object' ? (body.error || body.message) : body
      throw new Error(message || `Request failed (${res.status})`)
    }
    return body
  }

  function setBaseUrl(baseUrl) {
    state.baseUrl = cleanBase(baseUrl || defaultBase)
    localStorage.setItem('voltify_api_base', state.baseUrl)
  }

  async function fetchSettings() {
    return request('/api/public/settings')
  }

  async function fetchContent() {
    return request('/api/public/content')
  }

  async function track(tracking, phone) {
    return request('/api/public/track', {
      method: 'POST',
      body: JSON.stringify({ tracking, phone }),
    })
  }

  window.VoltifyAPI = {
    get baseUrl() { return state.baseUrl },
    setBaseUrl,
    request,
    fetchSettings,
    fetchContent,
    track,
  }
})()
