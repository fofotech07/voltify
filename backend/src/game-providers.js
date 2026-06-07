/**
 * Voltify — Game Provider Integration Layer
 * ==========================================
 * Each provider exposes:
 *   verifyPlayer(playerId, serverId?)  → { valid, nickname, level?, region?, avatar? }
 *   getPackages(playerId?, serverId?)  → Package[]
 *
 * To add a new provider: add an entry to the `providers` map below.
 * No other code needs to change.
 */

'use strict';

const https = require('https');
const http  = require('http');

// ─── HTTP helper (no external deps) ────────────────────────────────────────
function httpGet(url, headers = {}, timeoutMs = 7000) {
  return new Promise((resolve, reject) => {
    const lib    = url.startsWith('https') ? https : http;
    const req    = lib.get(url, { headers, timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

function httpPost(url, payload, headers = {}, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const urlObj = new URL(url);
    const lib    = urlObj.protocol === 'https:' ? https : http;
    const opts   = {
      hostname: urlObj.hostname,
      port:     urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path:     urlObj.pathname + urlObj.search,
      method:   'POST',
      timeout:  timeoutMs,
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers },
    };
    const req = lib.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(body);
    req.end();
  });
}

// ─── Standard package definitions ──────────────────────────────────────────
const PACKAGES = {
  freeFire: [
    { id: 'ff_100',    name: '100 Diamonds',   price: 100,  type: 'topup',        popular: false },
    { id: 'ff_310',    name: '310 Diamonds',   price: 290,  type: 'topup',        popular: false },
    { id: 'ff_520',    name: '520 Diamonds',   price: 480,  type: 'topup',        popular: true  },
    { id: 'ff_1060',   name: '1060 Diamonds',  price: 960,  type: 'topup',        popular: false },
    { id: 'ff_2180',   name: '2180 Diamonds',  price: 1950, type: 'topup',        popular: true  },
    { id: 'ff_5600',   name: '5600 Diamonds',  price: 4900, type: 'topup',        popular: false },
    { id: 'ff_weekly', name: 'Weekly Pass',    price: 140,  type: 'subscription', period: 'weekly'  },
    { id: 'ff_monthly',name: 'Monthly Pass',   price: 480,  type: 'subscription', period: 'monthly' },
  ],
  mobileLegends: [
    { id: 'ml_86',     name: '86 Diamonds',    price: 100,  type: 'topup',        popular: false },
    { id: 'ml_172',    name: '172 Diamonds',   price: 195,  type: 'topup',        popular: false },
    { id: 'ml_257',    name: '257 Diamonds',   price: 290,  type: 'topup',        popular: false },
    { id: 'ml_344',    name: '344 Diamonds',   price: 385,  type: 'topup',        popular: true  },
    { id: 'ml_706',    name: '706 Diamonds',   price: 770,  type: 'topup',        popular: true  },
    { id: 'ml_2195',   name: '2195 Diamonds',  price: 2300, type: 'topup',        popular: false },
    { id: 'ml_weekly', name: 'Weekly Diamond Pass', price: 140, type: 'subscription', period: 'weekly'  },
    { id: 'ml_twinkle',name: 'Twilight Pass',  price: 500,  type: 'membership',   period: 'monthly' },
  ],
  pubgMobile: [
    { id: 'pubg_60',   name: '60 UC',          price: 110,  type: 'topup',        popular: false },
    { id: 'pubg_325',  name: '325 UC',         price: 550,  type: 'topup',        popular: false },
    { id: 'pubg_660',  name: '660 UC',         price: 1100, type: 'topup',        popular: true  },
    { id: 'pubg_1800', name: '1800 UC',        price: 2900, type: 'topup',        popular: true  },
    { id: 'pubg_3850', name: '3850 UC',        price: 5900, type: 'topup',        popular: false },
    { id: 'pubg_8100', name: '8100 UC',        price: 11900,type: 'topup',        popular: false },
    { id: 'pubg_rp',   name: 'Royale Pass',    price: 600,  type: 'subscription', period: 'monthly' },
  ],
  valorant: [
    { id: 'vp_475',    name: '475 VP',         price: 350,  type: 'topup',        popular: false },
    { id: 'vp_1000',   name: '1000 VP',        price: 700,  type: 'topup',        popular: true  },
    { id: 'vp_2050',   name: '2050 VP',        price: 1400, type: 'topup',        popular: true  },
    { id: 'vp_3650',   name: '3650 VP',        price: 2400, type: 'topup',        popular: false },
    { id: 'vp_5350',   name: '5350 VP',        price: 3500, type: 'topup',        popular: false },
    { id: 'vp_11000',  name: '11000 VP',       price: 7000, type: 'topup',        popular: false },
    { id: 'vp_rp',     name: 'Battlepass',     price: 1000, type: 'subscription', period: 'season' },
  ],
  clashOfClans: [
    { id: 'coc_80',    name: '80 Gems',        price: 100,  type: 'topup',        popular: false },
    { id: 'coc_500',   name: '500 Gems',       price: 600,  type: 'topup',        popular: true  },
    { id: 'coc_1200',  name: '1200 Gems',      price: 1400, type: 'topup',        popular: false },
    { id: 'coc_2500',  name: '2500 Gems',      price: 2800, type: 'topup',        popular: false },
    { id: 'coc_6500',  name: '6500 Gems',      price: 7000, type: 'topup',        popular: true  },
    { id: 'coc_14000', name: '14000 Gems',     price: 14000,type: 'topup',        popular: false },
  ],
  genshinImpact: [
    { id: 'gi_60',     name: '60 Primogems',   price: 100,  type: 'topup',        popular: false },
    { id: 'gi_300',    name: '300 Primogems',  price: 490,  type: 'topup',        popular: false },
    { id: 'gi_980',    name: '980 Primogems',  price: 1400, type: 'topup',        popular: true  },
    { id: 'gi_1980',   name: '1980 Primogems', price: 2800, type: 'topup',        popular: true  },
    { id: 'gi_3280',   name: '3280 Primogems', price: 4600, type: 'topup',        popular: false },
    { id: 'gi_bp',     name: 'Blessing of Welkin Moon', price: 600, type: 'subscription', period: 'monthly' },
    { id: 'gi_gnostic','name': 'Gnostic Hymn', price: 2000, type: 'battlepass',   period: 'season' },
  ],
};

// ─── SERVER LIST (for MLBB and similar) ────────────────────────────────────
const MLBB_SERVERS = [
  { id: '5001', label: 'Asia (SEA)'       },
  { id: '5008', label: 'North America'    },
  { id: '5010', label: 'Europe'           },
  { id: '5017', label: 'Middle East'      },
  { id: '5019', label: 'South America'    },
  { id: '5021', label: 'Turkey'           },
  { id: '5034', label: 'Russia'           },
  { id: '5022', label: 'North Africa'     },
];

// ─── PROVIDER IMPLEMENTATIONS ───────────────────────────────────────────────

/**
 * FREE FIRE — via Codashop/Garena reseller API
 * Endpoint publicly available for partner/reseller verification
 */
const FreeFire = {
  id: 'freeFire',
  name: 'Free Fire',
  emoji: '🔥',
  requiresServer: false,
  apiAvailable: true,
  async verifyPlayer(playerId, _serverId, env = {}) {
    try {
      // Codashop public verification endpoint
      const url = `https://order.codashop.com/api/v2/user-id-validation/28?userId=${encodeURIComponent(playerId)}&svcGameId=28`;
      const res = await httpGet(url, {
        'User-Agent':     'Mozilla/5.0',
        'Referer':        'https://www.codashop.com/',
        'Origin':         'https://www.codashop.com',
        'Accept':         'application/json',
        'x-clientVersion':'v1.0',
      });

      if (res.status === 200 && res.data && res.data.data) {
        const d = res.data.data;
        const nickname = d.username || d.nickname || d.name || null;
        if (nickname) {
          return { valid: true, nickname, region: d.region || null };
        }
      }
      // If API gives empty or invalid username, player not found
      return { valid: false, nickname: null, error: 'Player ID not found' };
    } catch (err) {
      console.warn('[FreeFire] Verify API error:', err.message);
      return { valid: null, nickname: null, error: 'Verification service temporarily unavailable', fallback: true };
    }
  },
  async getPackages(_playerId, _serverId, _env) {
    return PACKAGES.freeFire;
  },
};

/**
 * MOBILE LEGENDS — via Moonton / Codashop API
 * Requires player ID + server (zone) ID
 */
const MobileLegends = {
  id: 'mobileLegends',
  name: 'Mobile Legends',
  emoji: '⚔️',
  requiresServer: true,
  serverLabel: 'Zone ID / Server',
  servers: MLBB_SERVERS,
  apiAvailable: true,
  async verifyPlayer(playerId, serverId, env = {}) {
    if (!serverId) return { valid: false, nickname: null, error: 'Server ID (Zone) is required for Mobile Legends.' };
    try {
      const url = `https://order.codashop.com/api/v2/user-id-validation/9?userId=${encodeURIComponent(playerId)}&zoneId=${encodeURIComponent(serverId)}&svcGameId=9`;
      const res = await httpGet(url, {
        'User-Agent': 'Mozilla/5.0',
        'Referer':    'https://www.codashop.com/',
        'Origin':     'https://www.codashop.com',
        'Accept':     'application/json',
      });
      if (res.status === 200 && res.data && res.data.data) {
        const d = res.data.data;
        const nickname = d.username || d.nickname || d.name || null;
        if (nickname) return { valid: true, nickname, region: serverId };
      }
      return { valid: false, nickname: null, error: 'Player ID or Zone ID not found' };
    } catch (err) {
      console.warn('[MLBB] Verify API error:', err.message);
      return { valid: null, nickname: null, error: 'Verification service temporarily unavailable', fallback: true };
    }
  },
  async getPackages(_playerId, _serverId, _env) {
    return PACKAGES.mobileLegends;
  },
};

/**
 * PUBG MOBILE — via Codashop reseller API
 */
const PUBGMobile = {
  id: 'pubgMobile',
  name: 'PUBG Mobile',
  emoji: '🪖',
  requiresServer: false,
  apiAvailable: true,
  async verifyPlayer(playerId, _serverId, env = {}) {
    try {
      const url = `https://order.codashop.com/api/v2/user-id-validation/10?userId=${encodeURIComponent(playerId)}&svcGameId=10`;
      const res = await httpGet(url, {
        'User-Agent': 'Mozilla/5.0',
        'Referer':    'https://www.codashop.com/',
        'Origin':     'https://www.codashop.com',
        'Accept':     'application/json',
      });
      if (res.status === 200 && res.data && res.data.data) {
        const d = res.data.data;
        const nickname = d.username || d.nickname || d.name || null;
        if (nickname) return { valid: true, nickname };
      }
      return { valid: false, nickname: null, error: 'PUBG Mobile Player ID not found' };
    } catch (err) {
      console.warn('[PUBG] Verify API error:', err.message);
      return { valid: null, nickname: null, error: 'Verification service temporarily unavailable', fallback: true };
    }
  },
  async getPackages(_playerId, _serverId, _env) {
    return PACKAGES.pubgMobile;
  },
};

/**
 * VALORANT — No public player verification API available
 * Uses manual Riot ID format: Name#TAG
 * Packages are standard (not player-specific)
 */
const Valorant = {
  id: 'valorant',
  name: 'Valorant',
  emoji: '🎯',
  requiresServer: false,
  apiAvailable: false,
  uidFormat: 'Name#TAG (e.g. Player#1234)',
  async verifyPlayer(playerId, _serverId, _env) {
    // Basic format validation (Name#Tag)
    const match = playerId.match(/^[^\s#]{1,16}#[A-Za-z0-9]{3,5}$/);
    if (match) {
      return {
        valid: null, // null = unverified (manual)
        nickname: playerId,
        fallback: true,
        message: 'Riot ID accepted. Our team will verify before delivery.',
      };
    }
    return {
      valid: false,
      nickname: null,
      error: 'Invalid Riot ID format. Use: PlayerName#TAG (e.g. Ace#EUW1)',
    };
  },
  async getPackages(_playerId, _serverId, _env) {
    return PACKAGES.valorant;
  },
};

/**
 * CLASH OF CLANS — No public API; Supercell Tag format
 */
const ClashOfClans = {
  id: 'clashOfClans',
  name: 'Clash of Clans',
  emoji: '🏰',
  requiresServer: false,
  apiAvailable: false,
  uidFormat: 'Player Tag (e.g. #ABC123XY)',
  async verifyPlayer(playerId, _serverId, _env) {
    const cleaned = playerId.replace(/^#/, '').toUpperCase();
    if (/^[0-9A-Z]{6,12}$/.test(cleaned)) {
      return {
        valid: null,
        nickname: '#' + cleaned,
        fallback: true,
        message: 'Player tag accepted. Our team will verify before delivery.',
      };
    }
    return { valid: false, nickname: null, error: 'Invalid player tag format. Use format: #ABC123XY' };
  },
  async getPackages() { return PACKAGES.clashOfClans; },
};

/**
 * GENSHIN IMPACT — HoYoverse (no public reseller verification API)
 */
const GenshinImpact = {
  id: 'genshinImpact',
  name: 'Genshin Impact',
  emoji: '🌸',
  requiresServer: true,
  serverLabel: 'Game Server',
  servers: [
    { id: 'os_usa',    label: 'America'        },
    { id: 'os_euro',   label: 'Europe'         },
    { id: 'os_asia',   label: 'Asia'           },
    { id: 'os_cht',    label: 'TW/HK/MO'      },
    { id: 'cn_gf01',   label: 'China (天空岛)' },
    { id: 'cn_qd01',   label: 'China (世界树)' },
  ],
  apiAvailable: false,
  async verifyPlayer(playerId, serverId, _env) {
    if (!/^\d{9}$/.test(playerId)) {
      return { valid: false, nickname: null, error: 'Genshin UID must be exactly 9 digits.' };
    }
    if (!serverId) {
      return { valid: false, nickname: null, error: 'Please select your game server.' };
    }
    return {
      valid: null,
      nickname: `UID: ${playerId}`,
      fallback: true,
      message: 'UID accepted. Manual verification will be completed before delivery.',
    };
  },
  async getPackages() { return PACKAGES.genshinImpact; },
};

/**
 * GENERIC FALLBACK — For any unrecognized game
 * Accepts any Player ID, requires manual verification
 */
const Generic = {
  id: 'generic',
  name: 'Game',
  emoji: '🎮',
  requiresServer: false,
  apiAvailable: false,
  async verifyPlayer(playerId, _serverId, _env) {
    if (!playerId || playerId.trim().length < 3) {
      return { valid: false, nickname: null, error: 'Please enter a valid Player ID (minimum 3 characters).' };
    }
    return {
      valid: null,
      nickname: playerId.trim(),
      fallback: true,
      message: 'Player ID accepted. Our team will verify your account before delivery.',
    };
  },
  async getPackages() { return []; },
};

// ─── PROVIDER REGISTRY ──────────────────────────────────────────────────────
const providers = {
  freeFire:      FreeFire,
  free_fire:     FreeFire,
  'free fire':   FreeFire,
  mobileLegends: MobileLegends,
  mobile_legends:MobileLegends,
  mlbb:          MobileLegends,
  'mobile legends': MobileLegends,
  pubgMobile:    PUBGMobile,
  pubg:          PUBGMobile,
  'pubg mobile': PUBGMobile,
  valorant:      Valorant,
  clashOfClans:  ClashOfClans,
  'clash of clans': ClashOfClans,
  coc:           ClashOfClans,
  genshinImpact: GenshinImpact,
  genshin:       GenshinImpact,
  'genshin impact': GenshinImpact,
};

/**
 * Get a provider by game name or ID (case-insensitive)
 */
function getProvider(gameId) {
  const key = String(gameId || '').trim().toLowerCase();
  return providers[key] || Generic;
}

/**
 * Verify a player for a given game
 */
async function verifyPlayer(gameId, playerId, serverId, env = {}) {
  const provider = getProvider(gameId);
  return provider.verifyPlayer(playerId, serverId, env);
}

/**
 * Get all packages for a game (optionally player-specific)
 */
async function getPackages(gameId, playerId, serverId, env = {}) {
  const provider = getProvider(gameId);
  return provider.getPackages(playerId, serverId, env);
}

/**
 * List all registered providers (unique, deduplicated)
 */
function listProviders() {
  const seen = new Set();
  return Object.values(providers)
    .filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    })
    .map((p) => ({
      id:             p.id,
      name:           p.name,
      emoji:          p.emoji,
      requiresServer: p.requiresServer,
      serverLabel:    p.serverLabel || null,
      servers:        p.servers     || null,
      apiAvailable:   p.apiAvailable,
      uidFormat:      p.uidFormat   || null,
    }));
}

module.exports = {
  getProvider,
  verifyPlayer,
  getPackages,
  listProviders,
  MLBB_SERVERS,
};
