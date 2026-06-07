const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const dataDir = path.join(__dirname, "..", "data");
const storePath = path.join(dataDir, "store.json");

const defaultStore = () => ({
  admins: [],
  orders: [],
  repairs: [],
  invoices: [],
  products: [],
  posts: [],
  gallery: [],
  services: [],
  settings: {},
  transactions: [],
  productSeq: 0,
  serviceSeq: 0,
  transactionSeq: 0
});

let store = defaultStore();

function loadStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(storePath)) {
    store = defaultStore();
    saveStore();
    return;
  }
  store = { ...defaultStore(), ...JSON.parse(fs.readFileSync(storePath, "utf8")) };
}

function saveStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");
}

async function seedAdmin() {
  if (store.admins.length) return;
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "AdminPassword123!";
  store.admins.push({
    id: 1,
    username,
    password_hash: await bcrypt.hash(password, 10),
    role: "superadmin",
    created_at: new Date().toISOString()
  });
  saveStore();
}

function ensureAdminRoles() {
  let changed = false;
  store.admins.forEach((a) => {
    if (!a.role) { a.role = a.id === 1 ? "superadmin" : "editor"; changed = true; }
  });
  if (changed) saveStore();
}

function seedDefaultServices() {
  if (store.services && store.services.length) return;
  const defaults = [
    {
      slug: "phone_repair", sort_order: 10, active: true, coming_soon: false, highlight: false,
      action: "none", link: "#contact", icon: "phone", emoji: "📱",
      title_ar: "إصلاح الهواتف", title_en: "Smartphone Repair", title_fr: "Réparation mobile",
      desc_ar: "إصلاح احترافي لجميع الماركات: شاشة، بطارية، أعطال مائية، وبرمجيات.",
      desc_en: "Expert repairs for all smartphone brands.",
      desc_fr: "Réparations pour toutes les marques.",
      features_ar: ["إصلاح الشاشة","تبديل البطارية","استعادة الأعطال المائية","فتح القفل والبرمجيات"],
      features_en: ["Screen repair","Battery replacement","Water damage","Software & unlock"],
      features_fr: ["Écran","Batterie","Dégâts des eaux","Logiciel"]
    },
    {
      slug: "pc_repair", sort_order: 20, active: true, coming_soon: false, highlight: false,
      action: "none", link: "#contact", icon: "pc", emoji: "💻",
      title_ar: "صيانة الحاسوب واللابتوب", title_en: "PC & Laptop Repair", title_fr: "Réparation PC",
      desc_ar: "تشخيص كامل، ترقية RAM/SSD، استرجاع البيانات، وإزالة الفيروسات.",
      desc_en: "Diagnostics, upgrades, and data recovery.",
      desc_fr: "Diagnostic et récupération de données.",
      features_ar: ["تشخيص العتاد","ترقية RAM و SSD","استرجاع البيانات","إزالة الفيروسات"],
      features_en: ["Hardware diagnostics","RAM & SSD upgrades","Data recovery","Malware removal"],
      features_fr: ["Diagnostic","Upgrades","Récupération","Antivirus"]
    },
    {
      slug: "mobile_credit", sort_order: 5, active: true, coming_soon: true, highlight: true,
      action: "topup", link: "#gaming", icon: "mobile_credit", emoji: "📶",
      title_ar: "شحن رصيد الهاتف", title_en: "Mobile Credit Top-Up", title_fr: "Recharge mobile",
      desc_ar: "شحن Mobilis و Ooredoo و Djezzy — قريباً مع تتبع فوري للطلب.",
      desc_en: "Mobilis, Ooredoo & Djezzy top-ups — launching soon.",
      desc_fr: "Recharges opérateurs — bientôt disponible.",
      features_ar: ["Mobilis","Ooredoo","Djezzy","تسليم سريع"],
      features_en: ["Mobilis","Ooredoo","Djezzy","Fast delivery"],
      features_fr: ["Mobilis","Ooredoo","Djezzy","Livraison rapide"]
    },
    {
      slug: "gaming_topup", sort_order: 15, active: true, coming_soon: false, highlight: false,
      action: "link", link: "#gaming", icon: "game", emoji: "🎮",
      title_ar: "شحن الألعاب", title_en: "Game Top-Ups", title_fr: "Recharges jeux",
      desc_ar: "Free Fire، PUBG، Mobile Legends وغيرها — تسليم فوري.",
      desc_en: "Instant delivery for popular games.",
      desc_fr: "Livraison instantanée pour vos jeux.",
      features_ar: ["Free Fire","PUBG UC","Mobile Legends","بطاقات هدايا"],
      features_en: ["Free Fire","PUBG UC","Mobile Legends","Gift cards"],
      features_fr: ["Free Fire","PUBG","MLBB","Cartes cadeaux"]
    }
  ];
  defaults.forEach((row) => {
    store.serviceSeq += 1;
    store.services.push({ id: store.serviceSeq, created_at: new Date().toISOString(), ...row });
  });
  saveStore();
}

async function initDb() {
  loadStore();
  if (!store.services) store.services = [];
  // Migrate: add missing fields to existing orders
  migrateOrders();
  await seedAdmin();
  ensureAdminRoles();
  seedDefaultServices();
}

/**
 * Migrate existing orders to include new fields if missing
 */
function migrateOrders() {
  let changed = false;
  (store.orders || []).forEach((o) => {
    if (o.player_id === undefined && o.uid) { o.player_id = o.uid; changed = true; }
    if (o.server_id === undefined) { o.server_id = ""; changed = true; }
    if (o.nickname === undefined) { o.nickname = ""; changed = true; }
    if (o.order_type === undefined) { o.order_type = "gaming"; changed = true; }
  });
  if (changed) saveStore();
}

function findAdmin(username) { return store.admins.find((a) => a.username === username) || null; }
function findAdminById(id) { return store.admins.find((a) => String(a.id) === String(id)) || null; }
function listAdmins() { return store.admins.map(({ password_hash, ...rest }) => rest); }

async function createAdminUser({ username, password, role }) {
  if (store.admins.some((a) => a.username === username)) throw new Error("Username already exists");
  const id = store.admins.reduce((m, a) => Math.max(m, a.id || 0), 0) + 1;
  const row = {
    id, username,
    password_hash: await bcrypt.hash(password, 10),
    role: role || "editor",
    created_at: new Date().toISOString()
  };
  store.admins.push(row);
  saveStore();
  const { password_hash, ...safe } = row;
  return safe;
}

function deleteAdminUser(id) {
  const before = store.admins.length;
  store.admins = store.admins.filter((a) => String(a.id) !== String(id));
  if (store.admins.length === before) return false;
  saveStore(); return true;
}

function getStats() {
  const revenue = store.invoices.reduce((s, i) => s + (Number(i.total) || 0), 0);
  return {
    orders:   store.orders.length,
    repairs:  store.repairs.length,
    invoices: store.invoices.length,
    revenue
  };
}

// ─── ORDERS ───────────────────────────────────────────────────────────────
function listOrders() {
  return [...store.orders].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function createOrder(row) {
  const item = {
    id:              row.id              || "",
    tracking_number: row.tracking_number || "",
    customer:        row.customer        || "",
    phone:           row.phone           || "",
    game:            row.game            || "",
    pkg:             row.pkg             || "",
    price:           Number(row.price    || 0),
    status:          row.status          || "processing",
    // Game-specific fields
    uid:             row.uid             || row.player_id || "",
    player_id:       row.player_id       || row.uid       || "",
    server_id:       row.server_id       || "",
    nickname:        row.nickname        || "",
    // Order metadata
    order_type:      row.order_type      || "gaming",
    operator:        row.operator        || "",
    payment:         row.payment         || "",
    created_at:      row.created_at      || new Date().toISOString()
  };
  // Avoid duplicate IDs
  const existing = store.orders.findIndex((o) => o.id === item.id);
  if (existing !== -1) {
    // Update existing instead of duplicating
    store.orders[existing] = { ...store.orders[existing], ...item };
  } else {
    store.orders.push(item);
  }
  saveStore();
  return item;
}

function updateOrder(id, patch) {
  const idx = store.orders.findIndex((x) => x.id === id);
  if (idx === -1) return false;
  store.orders[idx] = { ...store.orders[idx], ...patch, updated_at: new Date().toISOString() };
  saveStore(); return true;
}

function updateOrderStatus(id, status) {
  const o = store.orders.find((x) => x.id === id);
  if (!o) return false;
  o.status = status;
  o.updated_at = new Date().toISOString();
  saveStore(); return true;
}

function deleteOrder(id) {
  store.orders = store.orders.filter((x) => x.id !== id);
  saveStore();
}

// ─── REPAIRS ──────────────────────────────────────────────────────────────
function listRepairs() {
  return [...store.repairs].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}
function createRepair(row) {
  const existing = store.repairs.findIndex((r) => r.code === row.code);
  if (existing !== -1) {
    store.repairs[existing] = { ...store.repairs[existing], ...row };
  } else {
    store.repairs.push(row);
  }
  saveStore();
}
function updateRepairStatus(code, status) {
  const r = store.repairs.find((x) => x.code === code);
  if (!r) return false;
  r.status = status;
  r.updated_at = new Date().toISOString();
  saveStore(); return true;
}
function deleteRepair(code) {
  store.repairs = store.repairs.filter((x) => x.code !== code);
  saveStore();
}

// ─── INVOICES ─────────────────────────────────────────────────────────────
function listInvoices() {
  return [...store.invoices].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}
function createInvoice(row) { store.invoices.push(row); saveStore(); }
function deleteInvoice(id) { store.invoices = store.invoices.filter((x) => x.id !== id); saveStore(); }

// ─── PRODUCTS ─────────────────────────────────────────────────────────────
function listProducts() { return [...store.products].sort((a, b) => (b.id || 0) - (a.id || 0)); }
function createProduct(row) {
  store.productSeq += 1;
  const item = {
    id:          store.productSeq,
    name:        row.name        || "",
    price:       Number(row.price || 0),
    category:    row.category    || "",
    emoji:       row.emoji       || "",
    description: row.description || "",
    link:        row.link        || "",
    operator:    row.operator    || "",
    amount:      row.amount != null ? Number(row.amount) : null,
    created_at:  new Date().toISOString()
  };
  store.products.push(item);
  saveStore(); return item;
}
function deleteProduct(id) { store.products = store.products.filter((x) => String(x.id) !== String(id)); saveStore(); }

// ─── SERVICES ─────────────────────────────────────────────────────────────
function listServices() {
  return [...(store.services || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}
function listPublicServices() { return listServices().filter((s) => s.active !== false); }
function parseFeatureList(val) {
  if (Array.isArray(val)) return val.map((x) => String(x).trim()).filter(Boolean);
  if (typeof val === "string") return val.split("\n").map((x) => x.trim()).filter(Boolean);
  return [];
}
function normalizeServiceRow(row, id, isNew) {
  const slug = String(row.slug || `svc-${id}`).trim().toLowerCase().replace(/\s+/g, "-");
  return {
    id, slug,
    sort_order: Number(row.sort_order ?? 50),
    active: row.active !== false,
    coming_soon: row.coming_soon === true || row.coming_soon === "true",
    highlight: !!row.highlight,
    action: row.action || "none", link: row.link || "#contact",
    icon: row.icon || "phone", emoji: row.emoji || "⚡",
    image_url: row.image_url || "",
    title_ar: row.title_ar || row.title || "", title_en: row.title_en || "", title_fr: row.title_fr || "",
    desc_ar: row.desc_ar || row.description || "", desc_en: row.desc_en || "", desc_fr: row.desc_fr || "",
    features_ar: parseFeatureList(row.features_ar),
    features_en: parseFeatureList(row.features_en),
    features_fr: parseFeatureList(row.features_fr),
    button_ar: row.button_ar || "", button_en: row.button_en || "", button_fr: row.button_fr || "",
    created_at: isNew ? new Date().toISOString() : row.created_at,
    updated_at: new Date().toISOString()
  };
}
function createService(row) {
  if (row.slug && store.services.some((s) => s.slug === row.slug)) throw new Error("Slug already exists");
  store.serviceSeq = (store.serviceSeq || 0) + 1;
  const item = normalizeServiceRow(row, store.serviceSeq, true);
  store.services.push(item); saveStore(); return item;
}
function updateService(id, patch) {
  const s = store.services.find((x) => String(x.id) === String(id));
  if (!s) return null;
  if (patch.slug && store.services.some((x) => x.slug === patch.slug && String(x.id) !== String(id))) {
    throw new Error("Slug already exists");
  }
  const merged = normalizeServiceRow({ ...s, ...patch }, s.id, false);
  merged.created_at = s.created_at;
  Object.assign(s, merged); saveStore(); return s;
}
function deleteService(id) {
  const before = store.services.length;
  store.services = store.services.filter((x) => String(x.id) !== String(id));
  if (store.services.length === before) return false;
  saveStore(); return true;
}

// ─── POSTS ────────────────────────────────────────────────────────────────
function listPosts() { return [...store.posts].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))); }
function createPost(row) { store.posts.push(row); saveStore(); }
function deletePost(id) { store.posts = store.posts.filter((x) => x.id !== id); saveStore(); }

// ─── GALLERY ──────────────────────────────────────────────────────────────
function listGallery() { return [...store.gallery]; }
function createGalleryItem(row) { store.gallery.push(row); saveStore(); }
function deleteGalleryItem(id) { store.gallery = store.gallery.filter((x) => x.id !== id); saveStore(); }

// ─── SETTINGS ─────────────────────────────────────────────────────────────
function getSettingsMap() { return { ...store.settings }; }
function saveSettingsMap(payload) { store.settings = { ...store.settings, ...payload }; saveStore(); }

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────
function listTransactions() {
  if (!store.transactions) store.transactions = [];
  return [...store.transactions].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}
function findTransaction(id) {
  if (!store.transactions) store.transactions = [];
  return store.transactions.find((x) => x.id === id) || null;
}
function createTransaction(row) {
  if (!store.transactions) store.transactions = [];
  store.transactionSeq = (store.transactionSeq || 0) + 1;
  const item = {
    id:         row.id || `TXN-${100000 + store.transactionSeq}`,
    order_id:   row.order_id  || "",
    amount:     Number(row.amount || 0),
    currency:   row.currency  || "DZD",
    method:     row.method    || "bank_card",
    provider:   row.provider  || "mock",
    status:     row.status    || "pending",
    mode:       row.mode      || "test",
    signature:   row.signature   || "",
    external_id: row.external_id || "",
    logs:        row.logs        || [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  store.transactions.push(item); saveStore(); return item;
}
function updateTransaction(id, patch) {
  if (!store.transactions) store.transactions = [];
  const idx = store.transactions.findIndex((x) => x.id === id);
  if (idx === -1) return null;
  const updated = { ...store.transactions[idx], ...patch, updated_at: new Date().toISOString() };
  store.transactions[idx] = updated; saveStore(); return updated;
}

module.exports = {
  initDb,
  findAdmin, findAdminById, listAdmins, createAdminUser, deleteAdminUser,
  getStats,
  listOrders, createOrder, updateOrder, updateOrderStatus, deleteOrder,
  listRepairs, createRepair, updateRepairStatus, deleteRepair,
  listInvoices, createInvoice, deleteInvoice,
  listProducts, createProduct, deleteProduct,
  listPosts, createPost, deletePost,
  listGallery, createGalleryItem, deleteGalleryItem,
  listServices, listPublicServices, createService, updateService, deleteService,
  getSettingsMap, saveSettingsMap,
  listTransactions, findTransaction, createTransaction, updateTransaction
};
