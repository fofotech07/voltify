'use strict';

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('./db');
const { signAdminToken, loginAdmin, requireAdmin, requireRole, ROLES } = require('./auth');
const payments = require('./payments');
const gameProviders = require('./game-providers');

dotenv.config();

const app = express();
const uploadsDir = path.join(__dirname, '..', 'data', 'uploads');

// ─── SECURITY HEADERS ──────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  res.removeHeader('X-Powered-By');
  next();
});

// ─── CORS ──────────────────────────────────────────────────────────────────
const corsOrigin = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((s) => s.trim()).filter(Boolean)
  : true;
app.use(cors({ origin: corsOrigin, methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({
  limit: '12mb',
  verify: (req, _res, buf) => { req.rawBody = buf; }
}));
app.use('/uploads', express.static(uploadsDir));

// ─── RATE LIMITING ─────────────────────────────────────────────────────────
const rateLimitStore = new Map();
function rateLimit(maxRequests, windowMs) {
  return (req, res, next) => {
    const key = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    const bucket = rateLimitStore.get(key) || { count: 0, reset: now + windowMs };
    if (now > bucket.reset) { bucket.count = 0; bucket.reset = now + windowMs; }
    bucket.count += 1;
    rateLimitStore.set(key, bucket);
    if (bucket.count > maxRequests) {
      return res.status(429).json({ error: 'Too many requests. Please wait and try again.' });
    }
    next();
  };
}
// Cleanup old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitStore.entries()) {
    if (now > val.reset) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000);

// ─── INPUT SANITIZATION ────────────────────────────────────────────────────
function sanitizeStr(val, maxLen = 500) {
  return String(val || '').trim().slice(0, maxLen);
}
function sanitizePhone(phone) {
  return String(phone || '').replace(/[^\d+\s\-]/g, '').trim().slice(0, 20);
}
function isValidAlgerianPhone(phone) {
  const cleaned = String(phone || '').replace(/\D/g, '');
  // 10 digits starting with 0, or 12 digits starting with 213, or 13 with +213
  return /^(0[5-7]\d{8}|213[5-7]\d{8})$/.test(cleaned);
}

// ─── ROLE MIDDLEWARE ───────────────────────────────────────────────────────
const readAuth  = [requireAdmin];
const writeAuth = [requireAdmin, requireRole(ROLES.SUPER, ROLES.EDITOR)];
const superAuth = [requireAdmin, requireRole(ROLES.SUPER)];

// ─── UTILITIES ─────────────────────────────────────────────────────────────
function nowIso() { return new Date().toISOString(); }
function uid(prefix) { return `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`; }

function normalizePhone(p) {
  return String(p || '').replace(/\D/g, '').replace(/^213/, '0').replace(/^0+/, '');
}
function phonesMatch(a, b) { return normalizePhone(a) === normalizePhone(b); }
function normalizeTracking(code) { return String(code || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase(); }

/** Turn relative checkout paths into absolute URLs (required when frontend is not on the API origin). */
function absoluteAppUrl(req, urlOrPath) {
  const u = String(urlOrPath || '').trim();
  if (!u) return u;
  if (/^https?:\/\//i.test(u)) return u;
  const origin = `${req.protocol}://${req.get('host')}`;
  return u.startsWith('/') ? origin + u : `${origin}/${u}`;
}

// ─── HEALTH ───────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, version: '2.0.0' }));

// ─── AUTH ─────────────────────────────────────────────────────────────────
app.post('/api/auth/login', rateLimit(10, 60000), async (req, res) => {
  const username = sanitizeStr(req.body?.username, 80);
  const password = sanitizeStr(req.body?.password, 200);
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
  const admin = await loginAdmin(username, password);
  if (!admin) return res.status(401).json({ error: 'Invalid username or password' });
  const token = signAdminToken(admin);
  return res.json({ token, admin: { id: admin.id, username: admin.username, role: admin.role || ROLES.SUPER } });
});

// ─── STATS ────────────────────────────────────────────────────────────────
app.get('/api/stats', ...readAuth, (_req, res) => res.json(db.getStats()));

// ─── ORDERS (ADMIN) ───────────────────────────────────────────────────────
app.get('/api/orders', ...readAuth, (_req, res) => res.json(db.listOrders()));
app.post('/api/orders', ...writeAuth, (req, res) => {
  const id = req.body.id || uid('VLT');
  const tracking_number = req.body.tracking_number || uid('TRK');
  db.createOrder({
    id, tracking_number,
    customer:    sanitizeStr(req.body.customer, 100),
    phone:       sanitizePhone(req.body.phone),
    game:        sanitizeStr(req.body.game, 100),
    pkg:         sanitizeStr(req.body.pkg, 200),
    price:       Number(req.body.price || 0),
    status:      req.body.status || 'processing',
    uid:         sanitizeStr(req.body.uid, 100),
    server_id:   sanitizeStr(req.body.server_id, 50),
    nickname:    sanitizeStr(req.body.nickname, 100),
    order_type:  req.body.order_type || 'gaming',
    operator:    sanitizeStr(req.body.operator, 50),
    created_at:  nowIso()
  });
  res.status(201).json({ id, tracking_number });
});
app.patch('/api/orders/:id', ...writeAuth, (req, res) => {
  db.updateOrderStatus(req.params.id, req.body.status || 'processing');
  res.json({ ok: true });
});
app.delete('/api/orders/:id', ...writeAuth, (req, res) => {
  db.deleteOrder(req.params.id);
  res.json({ ok: true });
});

// ─── REPAIRS (ADMIN) ──────────────────────────────────────────────────────
app.get('/api/repairs', ...readAuth, (_req, res) => res.json(db.listRepairs()));
app.post('/api/repairs', ...writeAuth, (req, res) => {
  const code = req.body.code || uid('REP');
  db.createRepair({
    code, name: sanitizeStr(req.body.name, 100),
    phone:       sanitizePhone(req.body.phone),
    dev_type:    sanitizeStr(req.body.dev_type, 100),
    brand_model: sanitizeStr(req.body.brand_model, 100),
    svc_type:    sanitizeStr(req.body.svc_type, 100),
    status:      req.body.status || 'received',
    estimated_completion_date: sanitizeStr(req.body.estimated_completion_date, 30),
    description: sanitizeStr(req.body.description, 1000),
    created_at:  nowIso()
  });
  res.status(201).json({ code });
});
app.patch('/api/repairs/:code', ...writeAuth, (req, res) => {
  db.updateRepairStatus(req.params.code, req.body.status || 'received');
  res.json({ ok: true });
});
app.delete('/api/repairs/:code', ...writeAuth, (req, res) => {
  db.deleteRepair(req.params.code);
  res.json({ ok: true });
});

// ─── INVOICES (ADMIN) ─────────────────────────────────────────────────────
app.get('/api/invoices', ...readAuth, (_req, res) => res.json(db.listInvoices()));
app.post('/api/invoices', ...writeAuth, (req, res) => {
  const id = req.body.id || uid('INV');
  const subtotal = Number(req.body.subtotal || 0);
  const total    = Number(req.body.total || subtotal);
  db.createInvoice({
    id, order_ref: sanitizeStr(req.body.order_ref, 50),
    client:   sanitizeStr(req.body.client, 100),
    phone:    sanitizePhone(req.body.phone),
    payment:  sanitizeStr(req.body.payment, 50),
    status:   req.body.status || 'paid',
    subtotal, total,
    currency: req.body.currency || 'DZD',
    created_at: nowIso()
  });
  res.status(201).json({ id });
});
app.delete('/api/invoices/:id', ...writeAuth, (req, res) => {
  db.deleteInvoice(req.params.id);
  res.json({ ok: true });
});

// ─── PRODUCTS ─────────────────────────────────────────────────────────────
app.get('/api/products', ...readAuth, (_req, res) => res.json(db.listProducts()));
app.post('/api/products', ...writeAuth, (req, res) => {
  const item = db.createProduct({
    name:        sanitizeStr(req.body.name, 100),
    price:       Number(req.body.price || 0),
    category:    sanitizeStr(req.body.category, 50),
    emoji:       sanitizeStr(req.body.emoji, 10),
    description: sanitizeStr(req.body.description, 500),
    link:        sanitizeStr(req.body.link, 300),
    operator:    sanitizeStr(req.body.operator, 50),
    amount:      req.body.amount
  });
  res.status(201).json(item);
});
app.delete('/api/products/:id', ...writeAuth, (req, res) => {
  db.deleteProduct(req.params.id);
  res.json({ ok: true });
});

// ─── POSTS ────────────────────────────────────────────────────────────────
app.get('/api/posts', ...readAuth, (_req, res) => res.json(db.listPosts()));
app.post('/api/posts', ...writeAuth, (req, res) => {
  const id = req.body.id || uid('POST');
  db.createPost({
    id,
    title: sanitizeStr(req.body.title, 200),
    body:  sanitizeStr(req.body.body, 2000),
    type:  sanitizeStr(req.body.type, 30) || 'notice',
    created_at: nowIso()
  });
  res.status(201).json({ id });
});
app.delete('/api/posts/:id', ...writeAuth, (req, res) => {
  db.deletePost(req.params.id);
  res.json({ ok: true });
});

// ─── GALLERY ──────────────────────────────────────────────────────────────
app.get('/api/gallery', ...readAuth, (_req, res) => res.json(db.listGallery()));
app.post('/api/gallery', ...writeAuth, (req, res) => {
  const id = req.body.id || uid('GAL');
  db.createGalleryItem({ id, label: sanitizeStr(req.body.label, 100), url: sanitizeStr(req.body.url, 500) });
  res.status(201).json({ id });
});
app.delete('/api/gallery/:id', ...writeAuth, (req, res) => {
  db.deleteGalleryItem(req.params.id);
  res.json({ ok: true });
});

// ─── SERVICES ─────────────────────────────────────────────────────────────
app.get('/api/services', ...readAuth, (_req, res) => res.json(db.listServices()));
app.post('/api/services', ...writeAuth, (req, res) => {
  try { res.status(201).json(db.createService(req.body || {})); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.get('/api/services/:id', ...readAuth, (req, res) => {
  const item = db.listServices().find((x) => String(x.id) === String(req.params.id));
  if (!item) return res.status(404).json({ error: 'Service not found' });
  res.json(item);
});
app.patch('/api/services/:id', ...writeAuth, (req, res) => {
  try {
    const item = db.updateService(req.params.id, req.body || {});
    if (!item) return res.status(404).json({ error: 'Service not found' });
    res.json(item);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete('/api/services/:id', ...writeAuth, (req, res) => {
  if (!db.deleteService(req.params.id)) return res.status(404).json({ error: 'Service not found' });
  res.json({ ok: true });
});

// ─── SETTINGS ─────────────────────────────────────────────────────────────
app.get('/api/settings', ...readAuth, (_req, res) => res.json(db.getSettingsMap()));
app.put('/api/settings', ...superAuth, (req, res) => {
  const payload = req.body || {};
  const normalized = {};
  // Whitelist safe settings keys (never expose tgBotToken etc. to client from here)
  const allowedKeys = [
    'wa','tg','brandTitle','brandLogo','baridimob_rip','flexy_number',
    'chargily_secret_key','chargerily_secret_key','stripe_secret_key','stripe_webhook_secret',
    'payment_mode','tgBotToken','tgChatId','passcode'
  ];
  Object.keys(payload).forEach((k) => {
    if (allowedKeys.includes(k)) normalized[k] = String(payload[k] ?? '');
  });
  db.saveSettingsMap(normalized);
  res.json({ ok: true });
});

// ─── PUBLIC CONTENT ───────────────────────────────────────────────────────
app.get('/api/public/products', (_req, res) => res.json(db.listProducts()));
app.get('/api/public/posts', (_req, res) => res.json(db.listPosts()));
app.get('/api/public/gallery', (_req, res) => res.json(db.listGallery()));
app.get('/api/public/services', (_req, res) => res.json(db.listPublicServices()));
app.get('/api/public/content', (_req, res) => {
  const s = db.getSettingsMap();
  res.json({
    products: db.listProducts(),
    posts:    db.listPosts(),
    gallery:  db.listGallery(),
    services: db.listPublicServices(),
    settings: {
      wa:         s.wa         || '213676422372',
      tg:         s.tg         || 'CPETechOrdersBot',
      brandTitle: s.brandTitle || 'Voltify',
      brandLogo:  s.brandLogo  || '⚡'
      // NOTE: tgBotToken and tgChatId are NEVER exposed to the public
    }
  });
});
app.get('/api/public/settings', (_req, res) => {
  const s = db.getSettingsMap();
  const mode = s.payment_mode || process.env.PAYMENT_MODE || 'test';
  res.json({
    wa:         s.wa         || '213676422372',
    tg:         s.tg         || 'CPETechOrdersBot',
    brandTitle: s.brandTitle || 'Voltify',
    brandLogo:  s.brandLogo  || '⚡',
    payment_mode: mode,
    chargily_configured: !!payments.getChargilySecretKey(s)
    // Telegram Bot Tokens are NEVER sent to frontend
  });
});

// ─── GAME PROVIDER API ────────────────────────────────────────────────────
/**
 * List all supported game providers
 * GET /api/public/game/providers
 */
app.get('/api/public/game/providers', (_req, res) => {
  res.json(gameProviders.listProviders());
});

/**
 * Verify a player ID for a specific game
 * POST /api/public/game/verify
 * Body: { game, player_id, server_id? }
 */
app.post('/api/public/game/verify', rateLimit(30, 60000), async (req, res) => {
  const game      = sanitizeStr(req.body?.game, 100);
  const player_id = sanitizeStr(req.body?.player_id, 100);
  const server_id = sanitizeStr(req.body?.server_id, 50);
  if (!game || !player_id) {
    return res.status(400).json({ error: 'game and player_id are required' });
  }
  try {
    const result = await gameProviders.verifyPlayer(game, player_id, server_id, {});
    res.json(result);
  } catch (err) {
    console.error('[GameVerify] Error:', err.message);
    res.status(500).json({ valid: null, fallback: true, error: 'Verification service temporarily unavailable.' });
  }
});

/**
 * Get available packages / services for a game
 * POST /api/public/game/packages
 * Body: { game, player_id?, server_id? }
 */
app.post('/api/public/game/packages', rateLimit(30, 60000), async (req, res) => {
  const game      = sanitizeStr(req.body?.game, 100);
  const player_id = sanitizeStr(req.body?.player_id, 100);
  const server_id = sanitizeStr(req.body?.server_id, 50);
  if (!game) return res.status(400).json({ error: 'game is required' });
  try {
    const packages = await gameProviders.getPackages(game, player_id, server_id, {});
    res.json({ packages });
  } catch (err) {
    console.error('[GamePackages] Error:', err.message);
    res.status(500).json({ packages: [], error: 'Failed to load packages.' });
  }
});

/**
 * Get provider info for a specific game
 * GET /api/public/game/provider/:game
 */
app.get('/api/public/game/provider/:game', (req, res) => {
  const game = sanitizeStr(req.params.game, 100);
  const provider = gameProviders.getProvider(game);
  res.json({
    id:             provider.id,
    name:           provider.name,
    emoji:          provider.emoji,
    requiresServer: provider.requiresServer,
    serverLabel:    provider.serverLabel || null,
    servers:        provider.servers     || null,
    apiAvailable:   provider.apiAvailable,
    uidFormat:      provider.uidFormat   || null
  });
});

// ─── PUBLIC ORDERS ────────────────────────────────────────────────────────
app.post('/api/public/orders', rateLimit(20, 60000), (req, res) => {
  const id              = req.body.id            || uid('VLT');
  const tracking_number = req.body.tracking_number || uid('TRK');
  const orderType       = sanitizeStr(req.body.order_type || req.body.orderType, 30) || 'gaming';

  const order = {
    id, tracking_number,
    customer:   sanitizeStr(req.body.customer, 100) || 'Anonymous',
    phone:      sanitizePhone(req.body.phone),
    game:       sanitizeStr(req.body.game, 100),
    pkg:        sanitizeStr(req.body.pkg, 200),
    price:      Number(req.body.price || 0),
    status:     'processing',
    uid:        sanitizeStr(req.body.uid, 100),
    server_id:  sanitizeStr(req.body.server_id, 50),
    nickname:   sanitizeStr(req.body.nickname, 100),
    order_type: orderType,
    operator:   sanitizeStr(req.body.operator, 50),
    created_at: nowIso()
  };

  db.createOrder(order);

  // Fire Telegram alert from backend (credentials stay server-side)
  const settings = db.getSettingsMap();
  const msgText =
    `🎮 *New Game Order — Voltify*\n\n` +
    `🆔 Order ID: \`${id}\`\n` +
    `📦 Tracking: \`${tracking_number}\`\n` +
    `🎮 Game: ${order.game || '—'}\n` +
    `📦 Package: ${order.pkg || '—'}\n` +
    `💰 Price: ${order.price} DZD\n` +
    `👤 Player ID: \`${order.uid || '—'}\`\n` +
    `🌐 Server: ${order.server_id || '—'}\n` +
    `👾 Nickname: ${order.nickname || '—'}\n` +
    `👤 Customer: ${order.customer} (${order.phone || '—'})\n` +
    `📅 Date: ${new Date().toLocaleString()}`;
  payments.sendTelegramAlert(settings, msgText).catch((e) => console.error('[Telegram]', e.message));

  res.status(201).json({ id, tracking_number });
});

// ─── PUBLIC REPAIRS ───────────────────────────────────────────────────────
app.post('/api/public/repairs', rateLimit(10, 60000), (req, res) => {
  const code = req.body.code || uid('REP');
  const repair = {
    code,
    name:        sanitizeStr(req.body.name, 100),
    phone:       sanitizePhone(req.body.phone),
    dev_type:    sanitizeStr(req.body.dev_type || req.body.devType, 100),
    brand_model: sanitizeStr(req.body.brand_model || req.body.brandModel, 100),
    svc_type:    sanitizeStr(req.body.svc_type || req.body.svcType, 100),
    status:      'received',
    estimated_completion_date: '',
    description: sanitizeStr(req.body.description || req.body.desc, 1000),
    created_at:  nowIso()
  };

  db.createRepair(repair);

  const settings = db.getSettingsMap();
  const msgText =
    `🔧 *New Repair Request — Voltify*\n\n` +
    `📦 Request Code: \`${code}\`\n` +
    `👤 Customer: ${repair.name || 'Anonymous'} (${repair.phone || '—'})\n` +
    `💻 Device: ${repair.dev_type || '—'} (${repair.brand_model || '—'})\n` +
    `🔧 Service: ${repair.svc_type || '—'}\n` +
    `💬 Description: ${repair.description || '—'}\n` +
    `📅 Date: ${new Date().toLocaleString()}`;
  payments.sendTelegramAlert(settings, msgText).catch((e) => console.error('[Telegram]', e.message));

  res.status(201).json({ code });
});

// ─── PUBLIC NOTIFY (secure relay — no credentials needed in frontend) ─────
app.post('/api/public/notify', rateLimit(5, 60000), (req, res) => {
  const text = sanitizeStr(req.body?.text, 1000);
  if (!text) return res.status(400).json({ error: 'Missing message text' });
  const settings = db.getSettingsMap();
  payments.sendTelegramAlert(settings, text).catch((e) => console.error('[Notify]', e.message));
  res.json({ ok: true });
});

// ─── TRACKING SYSTEM ──────────────────────────────────────────────────────
/**
 * Game Order Tracking — uses Game ID (player UID) + Tracking Code only
 * No phone number required for game orders
 * POST /api/public/track/game
 */
app.post('/api/public/track/game', rateLimit(30, 60000), (req, res) => {
  const tracking = sanitizeStr(req.body.tracking, 50);
  const game_id  = sanitizeStr(req.body.game_id, 100); // Player UID / Game ID

  if (!tracking) return res.status(400).json({ error: 'Tracking code is required' });

  const normTracking = normalizeTracking(tracking);
  const normGameId   = String(game_id || '').trim().toUpperCase();

  // Search by tracking code (match either order.id or order.tracking_number)
  const allOrders = db.listOrders();
  let order = allOrders.find((o) =>
    (normalizeTracking(o.id) === normTracking || normalizeTracking(o.tracking_number) === normTracking) &&
    (o.order_type === 'gaming' || o.order_type === 'topup' || !o.order_type)
  );

  // If game_id provided, further validate it matches
  if (order && game_id && order.uid) {
    const orderUid = String(order.uid || '').trim().toUpperCase();
    if (orderUid !== normGameId) {
      order = null; // Game ID mismatch
    }
  }

  if (order && order.uid && !game_id) {
    return res.status(400).json({ error: 'Player ID is required to track this game order.' });
  }

  if (order) {
    const normId  = normalizeTracking(order.id);
    const normTrk = normalizeTracking(order.tracking_number);
    const invoice = db.listInvoices().find(
      (inv) => normalizeTracking(inv.order_ref) === normId || normalizeTracking(inv.order_ref) === normTrk
    );
    const transaction = db.listTransactions().find(
      (t) => normalizeTracking(t.order_id) === normId || normalizeTracking(t.order_id) === normTrk
    );
    return res.json({ type: 'order', data: order, invoice: invoice || null, transaction: transaction || null });
  }

  return res.status(404).json({ error: 'Order not found. Please check your tracking code and Player ID.' });
});

/**
 * Repair/Standard Tracking — uses phone number verification
 * POST /api/public/track
 */
app.post('/api/public/track', rateLimit(30, 60000), (req, res) => {
  const tracking = sanitizeStr(req.body.tracking, 50);
  const phone    = sanitizePhone(req.body.phone);

  if (!tracking) return res.status(400).json({ error: 'Tracking code is required' });
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });

  const normTracking = normalizeTracking(tracking);

  // Search orders by tracking + phone (non-game orders or legacy orders)
  const order = db.listOrders().find(
    (o) =>
      (normalizeTracking(o.id) === normTracking || normalizeTracking(o.tracking_number) === normTracking) &&
      phonesMatch(o.phone, phone)
  );
  if (order) {
    const normId  = normalizeTracking(order.id);
    const normTrk = normalizeTracking(order.tracking_number);
    const invoice = db.listInvoices().find(
      (inv) => normalizeTracking(inv.order_ref) === normId || normalizeTracking(inv.order_ref) === normTrk
    );
    const transaction = db.listTransactions().find(
      (t) => normalizeTracking(t.order_id) === normId || normalizeTracking(t.order_id) === normTrk
    );
    return res.json({ type: 'order', data: order, invoice: invoice || null, transaction: transaction || null });
  }

  // Search repairs by code + phone
  const repair = db.listRepairs().find(
    (r) => normalizeTracking(r.code) === normTracking && phonesMatch(r.phone, phone)
  );
  if (repair) {
    const normCode = normalizeTracking(repair.code);
    const invoice = db.listInvoices().find((inv) => normalizeTracking(inv.order_ref) === normCode);
    const transaction = db.listTransactions().find((t) => normalizeTracking(t.order_id) === normCode);
    return res.json({ type: 'repair', data: repair, invoice: invoice || null, transaction: transaction || null });
  }

  return res.status(404).json({ error: 'Not found. Please verify your tracking code and phone number.' });
});

// ─── IMAGE UPLOAD ─────────────────────────────────────────────────────────
app.post('/api/admin/upload', ...writeAuth, (req, res) => {
  try {
    const { data, filename } = req.body || {};
    const match = String(data || '').match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'Invalid image data' });
    const ext = match[1].replace('jpeg', 'jpg');
    const buf = Buffer.from(match[2], 'base64');
    if (buf.length > 8 * 1024 * 1024) return res.status(400).json({ error: 'Image too large (max 8MB)' });
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const safeName = (filename || 'image').replace(/[^\w.\-]/g, '_').slice(0, 40);
    const file = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeName}.${ext}`;
    fs.writeFileSync(path.join(uploadsDir, file), buf);
    return res.json({ url: `/uploads/${file}` });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── ADMIN USER MANAGEMENT ────────────────────────────────────────────────
app.get('/api/admin/users', ...superAuth, (_req, res) => res.json(db.listAdmins()));
app.post('/api/admin/users', ...superAuth, async (req, res) => {
  try {
    const { username, password, role } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });
    const allowed = [ROLES.SUPER, ROLES.EDITOR, ROLES.VIEWER];
    if (role && !allowed.includes(role)) return res.status(400).json({ error: 'Invalid role' });
    const user = await db.createAdminUser({ username, password, role: role || ROLES.EDITOR });
    res.status(201).json(user);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete('/api/admin/users/:id', ...superAuth, (req, res) => {
  if (String(req.admin.sub) === String(req.params.id)) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  if (!db.deleteAdminUser(req.params.id)) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true });
});

// ─── ADMIN IMPORT ─────────────────────────────────────────────────────────
app.post('/api/admin/import', ...superAuth, (req, res) => {
  const body = req.body || {};
  const imported = { orders: 0, repairs: 0, invoices: 0, products: 0, posts: 0, gallery: 0, services: 0 };

  (body.orders || []).forEach((o) => {
    if (!db.listOrders().find((x) => x.id === o.id)) {
      db.createOrder({
        id: o.id || uid('VLT'),
        tracking_number: o.trackingNumber || o.tracking_number || uid('TRK'),
        customer: o.customer || '',
        phone:    o.phone || '',
        game:     o.game  || '',
        pkg:      o.pkg   || '',
        price:    Number(o.price || 0),
        status:   o.status || 'processing',
        uid:      o.uid || '',
        server_id: o.server_id || '',
        nickname:  o.nickname  || '',
        order_type: o.order_type || 'gaming',
        created_at: o.created_at || nowIso()
      });
      imported.orders += 1;
    }
  });

  (body.repairs || []).forEach((r) => {
    if (!db.listRepairs().find((x) => x.code === r.code)) {
      db.createRepair({
        code: r.code || uid('REP'),
        name: r.name || '', phone: r.phone || '',
        dev_type: r.dev_type || r.devType || '',
        brand_model: r.brand_model || r.brandModel || '',
        svc_type: r.svc_type || r.svcType || '',
        status: r.status || 'received',
        estimated_completion_date: r.estimated_completion_date || '',
        description: r.description || r.desc || '',
        created_at: r.created_at || nowIso()
      });
      imported.repairs += 1;
    }
  });

  (body.invoices || []).forEach((inv) => {
    if (!db.listInvoices().find((x) => x.id === inv.id)) {
      db.createInvoice({
        id: inv.id || uid('INV'), order_ref: inv.orderRef || inv.order_ref || '',
        client: inv.client || '', phone: inv.phone || '',
        payment: inv.payment || '', status: inv.status || 'paid',
        subtotal: Number(inv.subtotal || 0),
        total: Number(inv.total || inv.subtotal || 0),
        currency: inv.cur || inv.currency || 'DZD',
        created_at: inv.created_at || nowIso()
      });
      imported.invoices += 1;
    }
  });

  (body.products || []).forEach((p) => {
    db.createProduct({ name: p.name || '', price: Number(p.price || 0), category: p.category || p.cat || '', emoji: p.emoji || '', description: p.description || '', link: p.link || '' });
    imported.products += 1;
  });

  (body.posts || []).forEach((p) => {
    if (!db.listPosts().find((x) => x.id === p.id)) {
      db.createPost({ id: p.id || uid('POST'), title: p.title || '', body: p.body || '', type: p.type || 'notice', created_at: p.created_at || nowIso() });
      imported.posts += 1;
    }
  });

  (body.gallery || []).forEach((g) => {
    if (!db.listGallery().find((x) => x.id === g.id)) {
      db.createGalleryItem({ id: g.id || uid('GAL'), label: g.label || '', url: g.url || '' });
      imported.gallery += 1;
    }
  });

  (body.services || []).forEach((s) => {
    if (!db.listServices().find((x) => x.slug === s.slug)) {
      db.createService(s);
      imported.services += 1;
    }
  });

  if (body.settings && typeof body.settings === 'object') {
    db.saveSettingsMap(body.settings);
  }

  res.json({ ok: true, imported });
});

// ─── PAYMENTS ─────────────────────────────────────────────────────────────
app.post('/api/public/payments/initiate', rateLimit(15, 60000), async (req, res) => {
  const { order_id, amount, currency, method, test_free } = req.body || {};
  if (!order_id || amount === undefined || amount === null || !method) {
    return res.status(400).json({ error: 'Missing required details: order_id, amount, method' });
  }
  const parsedAmount = Number(amount);
  if (isNaN(parsedAmount) || parsedAmount < 0) {
    return res.status(400).json({ error: 'Invalid payment amount' });
  }
  try {
    const settings = db.getSettingsMap();
    const mode = settings.payment_mode || process.env.PAYMENT_MODE || 'test';

    if (parsedAmount === 0) {
      if (mode === 'live') return res.status(400).json({ error: 'Zero amount transactions are not allowed in production mode' });
      if (!test_free) return res.status(400).json({ error: 'Zero amount only allowed in Sandbox mode if explicitly marked as test_free' });
    }

    const secret = process.env.JWT_SECRET || 'dev-secret';
    const rawTxn = {
      order_id, amount: parsedAmount,
      currency: currency || 'DZD',
      method,
      provider: (method === 'card' || method === 'chargily')
        ? (payments.getChargilySecretKey(settings) ? 'chargily' : (mode === 'live' ? 'stripe' : 'mock'))
        : 'manual',
      status: 'pending', mode, logs: []
    };

    const txn = db.createTransaction(rawTxn);
    payments.logTxnEvent(txn, 'initiated', `Payment initialized via method: ${method}`);
    txn.signature = payments.generateTransactionSignature(txn, secret);
    db.updateTransaction(txn.id, txn);

    if (method === 'card' || method === 'chargily') {
      const successUrl = `${req.protocol}://${req.get('host')}/payment-success.html`;
      const failureUrl = `${req.protocol}://${req.get('host')}/payment-failed.html`;
      const chargilyKey = payments.getChargilySecretKey(settings);
      let webhookProvider = 'mock';
      if (chargilyKey) webhookProvider = 'chargily';
      else if (mode === 'live' && (settings.stripe_secret_key || process.env.STRIPE_SECRET_KEY)) webhookProvider = 'stripe';

      const webhookUrl = `${req.protocol}://${req.get('host')}/api/public/payments/webhook/${webhookProvider}`;
      let checkoutData;
      if (chargilyKey) {
        const payMethod = method === 'chargily' ? (req.body.chargily_method || 'edahabia') : undefined;
        checkoutData = await payments.ChargilyProvider.createCheckout(
          txn, successUrl, failureUrl, webhookUrl, settings,
          { payment_method: payMethod, locale: req.body.locale || 'ar' }
        );
        txn.provider = 'chargily';
        txn.external_id = checkoutData.external_id;
      } else if (mode === 'live' && (settings.stripe_secret_key || process.env.STRIPE_SECRET_KEY)) {
        checkoutData = await payments.StripeProvider.createCheckout(txn, successUrl, failureUrl, settings);
      } else {
        checkoutData = await payments.MockProvider.createCheckout(txn, successUrl, failureUrl, webhookUrl);
      }
      txn.status = 'pending';
      payments.logTxnEvent(txn, 'gateway_redirect_created', checkoutData);
      db.updateTransaction(txn.id, txn);
      return res.status(201).json({
        type: 'redirect',
        checkout_url: absoluteAppUrl(req, checkoutData.checkout_url),
        transaction_id: txn.id,
        provider: txn.provider || checkoutData.provider || webhookProvider
      });
    }

    // Manual payments
    let instructions = {};
    if (method === 'baridimob') {
      instructions = {
        rip: settings.baridimob_rip || '00799999000012345678',
        account_name: settings.brandTitle || 'Voltify Tech',
        amount: txn.amount,
        qr_data: `baridimob:${settings.baridimob_rip || '00799999000012345678'}?amount=${txn.amount}`
      };
    } else if (method === 'flexy') {
      instructions = {
        phone: settings.flexy_number || '0676422372',
        amount: txn.amount,
        instructions: `Transfer Flexy credit of ${txn.amount} DZD to the phone number above.`
      };
    }

    txn.status = 'pending_verification';
    payments.logTxnEvent(txn, 'instructions_rendered', instructions);
    db.updateTransaction(txn.id, txn);

    return res.status(201).json({ type: 'instructions', instructions, transaction_id: txn.id });
  } catch (err) {
    console.error('Payment initiation failed:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/public/payments/webhook/:provider', async (req, res) => {
  const { provider } = req.params;
  const settings = db.getSettingsMap();
  try {
    let txnId = ''; let status = 'failed'; let extDetails = req.body;
    if (provider === 'mock') {
      const mockSecret = process.env.MOCK_WEBHOOK_SECRET || process.env.JWT_SECRET || 'dev-secret';
      const provided = req.headers['x-mock-webhook-secret'] || req.body?.secret || '';
      if (provided !== mockSecret) return res.status(403).json({ error: 'Invalid mock webhook secret' });
      txnId = req.body.txn_id;
      status = req.body.status === 'success' ? 'paid' : 'failed';
    } else if (provider === 'stripe') {
      const isVerified = payments.StripeProvider.verifyWebhook(req.headers, JSON.stringify(req.body), settings);
      const secret = settings.stripe_webhook_secret || process.env.STRIPE_WEBHOOK_SECRET;
      if (secret && !isVerified) return res.status(400).json({ error: 'Webhook signature verification failed' });
      const session = req.body.data?.object;
      txnId  = session?.client_reference_id;
      status = session?.payment_status === 'paid' ? 'paid' : 'failed';
    } else if (provider === 'chargily' || provider === 'chargerily') {
      const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
      const secret = payments.getChargilySecretKey(settings);
      if (secret) {
        const isVerified = payments.ChargilyProvider.verifyWebhook(req.headers, rawBody, settings);
        if (!isVerified) return res.status(403).json({ error: 'Chargily webhook signature verification failed' });
      }
      const parsed = payments.ChargilyProvider.parseWebhookEvent(req.body);
      txnId = parsed.txnId;
      status = parsed.status === 'paid' ? 'paid' : 'failed';
      if (!txnId && parsed.checkout?.id) {
        const match = db.listTransactions().find((t) => t.external_id === parsed.checkout.id);
        if (match) txnId = match.id;
      }
    }

    if (!txnId) return res.status(400).json({ error: 'No transaction ID found in payload' });

    if (status === 'paid') {
      await payments.processCompletedTransaction(txnId, extDetails, db);
    } else {
      const txn = db.findTransaction(txnId);
      if (txn) {
        txn.status = 'failed';
        payments.logTxnEvent(txn, 'payment_failed', extDetails);
        const secret = process.env.JWT_SECRET || 'dev-secret';
        txn.signature = payments.generateTransactionSignature(txn, secret);
        db.updateTransaction(txnId, txn);
      }
    }
    return res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/** Sandbox only — completes a pending txn without calling external webhooks (manual / flexy / baridimob tests). */
app.post('/api/public/payments/sandbox/complete', rateLimit(15, 60000), async (req, res) => {
  const settings = db.getSettingsMap();
  const mode = settings.payment_mode || process.env.PAYMENT_MODE || 'test';
  if (mode === 'live') return res.status(403).json({ error: 'Sandbox completion is disabled in live mode' });
  const { transaction_id } = req.body || {};
  if (!transaction_id) return res.status(400).json({ error: 'Missing transaction_id' });
  try {
    const txn = await payments.processCompletedTransaction(transaction_id, { source: 'sandbox_complete' }, db);
    return res.json({ ok: true, transaction_id: txn.id, status: txn.status });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/public/payments/verify', (req, res) => {
  const { transaction_id } = req.body || {};
  if (!transaction_id) return res.status(400).json({ error: 'Missing transaction_id' });
  const txn = db.findTransaction(transaction_id);
  if (!txn) return res.status(404).json({ error: 'Transaction not found' });
  const secret = process.env.JWT_SECRET || 'dev-secret';
  const isValid = payments.verifyTransactionSignature(txn, secret);
  return res.json({
    transaction_id: txn.id,
    order_id: txn.order_id,
    status: txn.status,
    amount: txn.amount,
    currency: txn.currency,
    provider: txn.provider || null,
    signature_valid: isValid
  });
});

app.post('/api/public/payments/submit-proof', rateLimit(10, 60000), (req, res) => {
  const { transaction_id, ref_number, proof_image } = req.body || {};
  if (!transaction_id) return res.status(400).json({ error: 'Missing transaction_id' });
  const txn = db.findTransaction(transaction_id);
  if (!txn) return res.status(404).json({ error: 'Transaction not found' });

  txn.status = 'pending_verification';
  const details = { ref_number: sanitizeStr(ref_number, 100) };

  if (proof_image) {
    const match = String(proof_image).match(/^data:image\/(\w+);base64,(.+)$/);
    if (match) {
      const ext = match[1].replace('jpeg', 'jpg');
      const buf = Buffer.from(match[2], 'base64');
      if (buf.length > 8 * 1024 * 1024) return res.status(400).json({ error: 'Proof image too large (max 8MB)' });
      const file = `proof-${transaction_id}-${Date.now()}.${ext}`;
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      fs.writeFileSync(path.join(uploadsDir, file), buf);
      details.proof_url = `/uploads/${file}`;
    }
  }

  payments.logTxnEvent(txn, 'proof_submitted', details);
  const secret = process.env.JWT_SECRET || 'dev-secret';
  txn.signature = payments.generateTransactionSignature(txn, secret);
  db.updateTransaction(transaction_id, txn);

  const settings = db.getSettingsMap();
  const alertMsg =
    `📥 *New Manual Payment Proof — Voltify*\n\n` +
    `💳 *Transaction:* \`${txn.id}\`\n` +
    `🆔 *Order/Repair ID:* \`${txn.order_id}\`\n` +
    `💰 *Amount:* ${txn.amount} ${txn.currency}\n` +
    `💳 *Method:* ${txn.method.toUpperCase()}\n` +
    `🔢 *Reference No:* \`${ref_number || 'None provided'}\`\n` +
    `📄 *Proof:* ${details.proof_url ? `[View Proof](${req.protocol}://${req.get('host')}${details.proof_url})` : 'No image uploaded'}\n` +
    `📅 *Timestamp:* ${new Date().toLocaleString()}`;
  payments.sendTelegramAlert(settings, alertMsg).catch((err) => console.error('[Telegram]', err));

  return res.json({ ok: true, transaction_id: txn.id, status: txn.status });
});

// Interactive Mock Sandbox Checkout screen
app.get('/api/public/payments/mock-gateway', (req, res) => {
  const { txn_id, success_url, webhook_url } = req.query;
  const txn = db.findTransaction(txn_id);
  if (!txn) return res.status(404).send('Transaction not found');
  const mockWebhookSecret = process.env.MOCK_WEBHOOK_SECRET || process.env.JWT_SECRET || 'dev-secret';

  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Voltify Sandbox Gateway</title>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root { --bg:#0b0b14; --card-bg:rgba(18,18,29,0.6); --border:rgba(255,255,255,0.08); --primary:#0055ff; --text:#fff; --text-muted:#8e909a; }
    body { background:var(--bg); color:var(--text); font-family:'Inter',sans-serif; margin:0; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .orb { position:absolute; width:400px; height:400px; border-radius:50%; background:radial-gradient(circle,rgba(0,85,255,0.15) 0%,transparent 75%); z-index:-1; }
    .orb-1 { top:-100px; left:-100px; } .orb-2 { bottom:-100px; right:-100px; }
    .card { background:var(--card-bg); backdrop-filter:blur(20px); border:1px solid var(--border); border-radius:24px; padding:40px; width:100%; max-width:420px; box-shadow:0 20px 40px rgba(0,0,0,.4); position:relative; }
    .header { text-align:center; margin-bottom:30px; }
    .logo { font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:1.5rem; display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:12px; }
    .logo svg { width:24px; height:24px; stroke:#0055ff; fill:none; stroke-width:2.5; }
    .badge { display:inline-block; padding:4px 12px; background:rgba(0,85,255,.1); border:1px solid rgba(0,85,255,.2); border-radius:100px; font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#0055ff; }
    .amount-display { text-align:center; margin-bottom:30px; padding:20px; background:rgba(255,255,255,.02); border-radius:16px; border:1px solid var(--border); }
    .amount-val { font-size:2.2rem; font-weight:800; font-family:'Space Grotesk',sans-serif; color:#00c8ff; }
    .amount-lbl { font-size:.75rem; color:var(--text-muted); margin-top:4px; }
    .field { margin-bottom:18px; }
    .label { display:block; font-size:.75rem; font-weight:600; color:var(--text-muted); margin-bottom:8px; text-transform:uppercase; letter-spacing:.03em; }
    .input { width:100%; box-sizing:border-box; background:rgba(255,255,255,.03); border:1px solid var(--border); border-radius:12px; padding:14px; color:var(--text); font-size:.95rem; transition:all .2s; }
    .input:focus { outline:none; border-color:var(--primary); background:rgba(255,255,255,.05); box-shadow:0 0 0 3px rgba(0,85,255,.15); }
    .row { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
    .btn { width:100%; background:var(--primary); color:white; border:none; border-radius:12px; padding:16px; font-size:.95rem; font-weight:700; cursor:pointer; transition:all .2s; display:flex; align-items:center; justify-content:center; gap:10px; }
    .btn:hover { background:#1a66ff; transform:translateY(-1px); }
    .spinner { width:20px; height:20px; border:2px solid rgba(255,255,255,.3); border-top-color:white; border-radius:50%; animation:spin .8s linear infinite; display:none; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .status-screen { display:none; text-align:center; padding:40px 0; }
    .status-icon { font-size:4rem; margin-bottom:20px; }
    .status-title { font-size:1.3rem; font-weight:700; margin-bottom:8px; }
    .status-desc { color:var(--text-muted); font-size:.88rem; }
  </style>
</head>
<body>
  <div class="orb orb-1"></div><div class="orb orb-2"></div>
  <div class="card">
    <div id="payment-form">
      <div class="header">
        <div class="logo"><svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg><span>Voltify Pay</span></div>
        <span class="badge">Sandbox Test Gateway</span>
      </div>
      <div class="amount-display">
        <div class="amount-val">${txn.amount} ${txn.currency}</div>
        <div class="amount-lbl">Invoice Ref: ${txn.id} (Order: ${txn.order_id})</div>
      </div>
      <div class="field"><label class="label">Cardholder Name</label><input type="text" class="input" value="Test User" id="cardname"></div>
      <div class="field"><label class="label">Card Number</label><input type="text" class="input" value="4000 1234 5678 9010" id="cardnum"></div>
      <div class="row">
        <div class="field"><label class="label">Expiry</label><input type="text" class="input" value="12/29" id="cardexp"></div>
        <div class="field"><label class="label">CVV</label><input type="password" class="input" value="123" id="cardcvv"></div>
      </div>
      <button class="btn" id="paybtn" onclick="submitMockPayment()">
        <span class="spinner" id="btn-spinner"></span><span id="btn-text">Pay Securely</span>
      </button>
    </div>
    <div class="status-screen" id="status-screen">
      <div class="status-icon" id="status-icon">⌛</div>
      <div class="status-title" id="status-title">Processing Payment...</div>
      <div class="status-desc" id="status-desc">Please do not refresh or close this window.</div>
    </div>
  </div>
  <script>
    async function submitMockPayment() {
      const paybtn = document.getElementById('paybtn');
      const spinner = document.getElementById('btn-spinner');
      const btntext = document.getElementById('btn-text');
      paybtn.disabled = true; spinner.style.display = 'inline-block'; btntext.textContent = 'Processing...';
      document.getElementById('payment-form').style.display = 'none';
      document.getElementById('status-screen').style.display = 'block';
      setTimeout(async () => {
        try {
          const res = await fetch('${webhook_url}', { method:'POST', headers:{'Content-Type':'application/json','X-Mock-Webhook-Secret':'${mockWebhookSecret}'}, body: JSON.stringify({txn_id:'${txn_id}',status:'success',secret:'${mockWebhookSecret}'}) });
          if (!res.ok) throw new Error('Webhook callback failed');
          document.getElementById('status-icon').textContent = '✅';
          document.getElementById('status-icon').style.color = '#2ecc71';
          document.getElementById('status-title').textContent = 'Payment Completed!';
          document.getElementById('status-desc').textContent = 'Redirecting you back to Voltify...';
          setTimeout(() => { window.location.href = '${success_url}?txn_id=${txn_id}'; }, 1500);
        } catch(e) {
          document.getElementById('status-icon').textContent = '❌';
          document.getElementById('status-icon').style.color = '#ff4d4d';
          document.getElementById('status-title').textContent = 'Payment Failed';
          document.getElementById('status-desc').textContent = e.message || 'An error occurred.';
        }
      }, 1000);
    }
  </script>
</body>
</html>
  `);
});

// ─── ADMIN PAYMENTS ────────────────────────────────────────────────────────
app.get('/api/admin/payments/transactions', ...readAuth, (_req, res) => res.json(db.listTransactions()));
app.get('/api/admin/payments/transactions/:id', ...readAuth, (req, res) => {
  const txn = db.findTransaction(req.params.id);
  if (!txn) return res.status(404).json({ error: 'Transaction not found' });
  res.json(txn);
});
app.post('/api/admin/payments/transactions/:id/approve', ...writeAuth, async (req, res) => {
  try {
    const txn = db.findTransaction(req.params.id);
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });
    const approvedTxn = await payments.processCompletedTransaction(txn.id, { approved_by: req.admin.sub }, db);
    res.json({ ok: true, transaction: approvedTxn });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── STATIC FILES ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const p = req.path.toLowerCase();
  if (p.startsWith('/backend') || p.includes('/node_modules') || p.endsWith('.env')) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
});
app.use('/', express.static(path.join(__dirname, '..', '..'), { dotfiles: 'deny' }));

// ─── BOOTSTRAP ────────────────────────────────────────────────────────────
async function bootstrap() {
  await db.initDb();
  const port = Number(process.env.PORT || 4000);
  app.listen(port, () => {
    console.log(`✅ Voltify API v2.0 running on http://localhost:${port}`);
  });
}

bootstrap().catch((e) => {
  console.error('Failed to start server:', e);
  process.exit(1);
});
