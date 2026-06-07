const crypto = require("crypto");

// Cryptographic signature for transaction records to prevent tampering
function generateTransactionSignature(txn, secret) {
  const data = `${txn.id}|${txn.order_id}|${txn.amount}|${txn.status}|${txn.mode}`;
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

function verifyTransactionSignature(txn, secret) {
  if (!txn.signature) return false;
  const expected = generateTransactionSignature(txn, secret);
  return crypto.timingSafeEqual(Buffer.from(txn.signature, "hex"), Buffer.from(expected, "hex"));
}

// Log lifecycle events securely
function logTxnEvent(txn, event, details) {
  if (!txn.logs) txn.logs = [];
  txn.logs.push({
    time: new Date().toISOString(),
    event,
    details: typeof details === "string" ? details : JSON.stringify(details)
  });
}

// Secure backend Telegram notification helper
async function sendTelegramAlert(settings, text) {
  if (!settings.tgBotToken || !settings.tgChatId) {
    console.warn("Telegram configurations missing in settings. Skipping notification.");
    return false;
  }
  try {
    const url = `https://api.telegram.org/bot${settings.tgBotToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: settings.tgChatId,
        text: text,
        parse_mode: "Markdown"
      })
    });
    return res.ok;
  } catch (err) {
    console.error("Failed to send Telegram alert from backend:", err);
    return false;
  }
}

// 1. Mock Payment Provider (Simulates card payment checkout screen)
const MockProvider = {
  async createCheckout(txn, successUrl, _cancelUrl, webhookUrl) {
    const redirectUrl = `/api/public/payments/mock-gateway?txn_id=${txn.id}&success_url=${encodeURIComponent(successUrl)}&webhook_url=${encodeURIComponent(webhookUrl)}`;
    return { checkout_url: redirectUrl };
  }
};

// 2. Stripe Payment Provider (Bank cards - international)
const StripeProvider = {
  async createCheckout(txn, successUrl, cancelUrl, settings) {
    const secretKey = settings.stripe_secret_key || process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new Error("Stripe Secret Key is not configured.");

    const amountInCents = Math.round(txn.amount * 100);
    const params = new URLSearchParams();
    params.append("success_url", successUrl + "?session_id={CHECKOUT_SESSION_ID}&txn_id=" + txn.id);
    params.append("cancel_url", cancelUrl);
    params.append("mode", "payment");
    params.append("client_reference_id", txn.id);
    params.append("line_items[0][price_data][currency]", String(txn.currency || "DZD").toLowerCase());
    params.append("line_items[0][price_data][product_data][name]", `Voltify Order — ${txn.order_id}`);
    params.append("line_items[0][price_data][unit_amount]", String(amountInCents));
    params.append("line_items[0][quantity]", "1");
    params.append("metadata[order_id]", txn.order_id);

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || "Failed to create Stripe Checkout Session");
    }

    return { checkout_url: data.url, external_id: data.id };
  },

  verifyWebhook(headers, bodyStr, settings) {
    const webhookSecret = settings.stripe_webhook_secret || process.env.STRIPE_WEBHOOK_SECRET;
    const sigHeader = headers["stripe-signature"] || "";
    if (!webhookSecret || !sigHeader) return false;

    // Signature verification logic for Stripe webhooks
    try {
      const parts = sigHeader.split(",");
      const tPart = parts.find(p => p.startsWith("t="));
      const v1Part = parts.find(p => p.startsWith("v1="));
      if (!tPart || !v1Part) return false;

      const t = tPart.split("=")[1];
      const v1 = v1Part.split("=")[1];

      const signedPayload = `${t}.${bodyStr}`;
      const hmac = crypto.createHmac("sha256", webhookSecret).update(signedPayload).digest("hex");

      return crypto.timingSafeEqual(Buffer.from(hmac, "hex"), Buffer.from(v1, "hex"));
    } catch (e) {
      return false;
    }
  }
};

// 3. Chargily Pay™ — CIB / Edahabia / Chargily App (Algeria)
// Docs: https://dev.chargily.com/pay-v2/introduction
const CHARGILY_TEST_BASE = "https://pay.chargily.net/test/api/v2";
const CHARGILY_LIVE_BASE = "https://pay.chargily.net/api/v2";

function getChargilySecretKey(settings = {}) {
  return (
    settings.chargily_secret_key ||
    settings.chargerily_secret_key ||
    process.env.CHARGILY_SECRET_KEY ||
    process.env.CHARGERILY_SECRET_KEY ||
    ""
  );
}

function getChargilyKeyMode(secretKey) {
  const key = String(secretKey || "");
  if (key.startsWith("live_")) return "live";
  if (key.startsWith("test_")) return "test";
  return null;
}

function getChargilyApiBase(secretKey, settings = {}) {
  const keyMode = getChargilyKeyMode(secretKey);
  if (keyMode === "test") return CHARGILY_TEST_BASE;
  if (keyMode === "live") return CHARGILY_LIVE_BASE;
  const mode = settings.payment_mode || process.env.PAYMENT_MODE || "test";
  return mode === "live" ? CHARGILY_LIVE_BASE : CHARGILY_TEST_BASE;
}

function verifyChargilySignature(signature, rawBody, secretKey) {
  if (!signature || !secretKey || rawBody == null) return false;
  try {
    const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), "utf8");
    const expected = crypto.createHmac("sha256", secretKey).update(body).digest("hex");
    const sigBuf = Buffer.from(String(signature), "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

function parseChargilyWebhookEvent(body) {
  const event = body || {};
  const type = event.type || "";
  const checkout = event.data || {};
  const meta = checkout.metadata || {};
  const txnId =
    meta.transaction_id ||
    meta.transactionId ||
    checkout.metadata?.transaction_id ||
    null;
  let status = "failed";
  if (type === "checkout.paid" || checkout.status === "paid") status = "paid";
  else if (type === "checkout.failed" || checkout.status === "failed") status = "failed";
  else if (checkout.status === "pending") status = "pending";
  return { type, txnId, status, checkout, event };
}

const ChargilyProvider = {
  getSecretKey: getChargilySecretKey,
  getApiBase: getChargilyApiBase,
  verifySignature: verifyChargilySignature,
  parseWebhookEvent: parseChargilyWebhookEvent,

  async createCheckout(txn, successUrl, failureUrl, webhookUrl, settings, options = {}) {
    const secretKey = getChargilySecretKey(settings);
    if (!secretKey) throw new Error("Chargily Secret Key is not configured.");

    const base = getChargilyApiBase(secretKey, settings);
    const amount = Math.round(Number(txn.amount || 0));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Chargily checkout requires a positive amount in DZD.");
    }

    const payload = {
      amount,
      currency: "dzd",
      success_url: `${successUrl}${successUrl.includes("?") ? "&" : "?"}txn_id=${encodeURIComponent(txn.id)}`,
      failure_url: `${failureUrl}${failureUrl.includes("?") ? "&" : "?"}txn_id=${encodeURIComponent(txn.id)}`,
      webhook_endpoint: webhookUrl,
      locale: options.locale || "ar",
      description: `Voltify — ${txn.order_id}`,
      metadata: {
        transaction_id: txn.id,
        order_id: txn.order_id
      }
    };

    const method = options.payment_method || options.paymentMethod;
    if (method && ["edahabia", "cib", "chargily_app"].includes(method)) {
      payload.payment_method = method;
    }

    const res = await fetch(`${base}/checkouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.message || data.error?.message || data.error || JSON.stringify(data);
      throw new Error(msg || "Failed to create Chargily checkout");
    }

    const checkoutUrl = data.checkout_url || data.url;
    if (!checkoutUrl) throw new Error("Chargily did not return a checkout_url");

    return { checkout_url: checkoutUrl, external_id: data.id, provider: "chargily", livemode: data.livemode };
  },

  verifyWebhook(headers, rawBody, settings) {
    const secretKey = getChargilySecretKey(settings);
    const signature =
      headers.signature ||
      headers.Signature ||
      headers["x-signature"] ||
      headers["chargerily-signature"] ||
      "";
    return verifyChargilySignature(signature, rawBody, secretKey);
  }
};

/** @deprecated use ChargilyProvider — kept for backward compatibility */
const ChargerilyProvider = ChargilyProvider;

// Main verification and confirmation logic
async function processCompletedTransaction(txnId, externalDetails, db) {
  const txn = db.findTransaction(txnId);
  if (!txn) throw new Error("Transaction not found");
  if (txn.status === "completed") return txn; // already processed

  const secret = process.env.JWT_SECRET || "dev-secret";

  // Check order type (order vs repair)
  const isRepair = txn.order_id.startsWith("REP-");
  let itemDesc = `Payment for request ${txn.order_id}`;
  let clientName = "Anonymous";
  let clientPhone = "";

  if (isRepair) {
    const r = db.listRepairs().find(x => x.code === txn.order_id);
    if (r) {
      r.status = "in repair";
      db.createRepair(r); // update status
      clientName = r.name;
      clientPhone = r.phone;
      itemDesc = `🛠️ Repair service payment: ${r.svc_type} for ${r.dev_type} (${r.brand_model})`;
    }
  } else {
    const o = db.listOrders().find(x => x.id === txn.order_id || x.tracking_number === txn.order_id);
    if (o) {
      o.status = "completed"; // or processing, let's keep completed/processing
      o.payment = txn.method.toUpperCase();
      db.createOrder(o); // update order in JSON database
      clientName = o.customer;
      clientPhone = o.phone;
      itemDesc = `🎮 Game Top-Up: ${o.game} - ${o.pkg} (Player UID: ${o.uid})`;
    }
  }

  // Update transaction status
  txn.status = "completed";
  logTxnEvent(txn, "payment_confirmed", externalDetails);
  txn.signature = generateTransactionSignature(txn, secret);
  db.updateTransaction(txnId, txn);

  // Generate automated paid invoice in database
  const invoiceId = `INV-${2026 + db.listInvoices().length + 1}`;
  const tax = txn.amount * 0.19;
  db.createInvoice({
    id: invoiceId,
    order_ref: txn.order_id,
    client: clientName,
    phone: clientPhone,
    payment: txn.method.toUpperCase(),
    status: "paid",
    subtotal: txn.amount - tax,
    total: txn.amount,
    currency: txn.currency,
    created_at: new Date().toISOString()
  });

  // Securely trigger Telegram notification from backend
  const settings = db.getSettingsMap();
  const notificationText = `✅ *Payment Confirmed — Voltify*\n\n` +
    `💳 *Transaction:* \`${txn.id}\`\n` +
    `🆔 *Order/Repair ID:* \`${txn.order_id}\`\n` +
    `💰 *Amount:* ${txn.amount} ${txn.currency}\n` +
    `💳 *Payment Method:* ${txn.method.toUpperCase()}\n` +
    `👤 *Customer:* ${clientName} (${clientPhone || "—"})\n` +
    `📦 *Item:* ${itemDesc}\n` +
    `🧾 *Invoice Created:* \`${invoiceId}\`\n` +
    `📅 *Timestamp:* ${new Date().toLocaleString()}`;

  await sendTelegramAlert(settings, notificationText);

  return txn;
}

module.exports = {
  generateTransactionSignature,
  verifyTransactionSignature,
  logTxnEvent,
  MockProvider,
  StripeProvider,
  ChargilyProvider,
  ChargerilyProvider,
  getChargilySecretKey,
  getChargilyKeyMode,
  processCompletedTransaction,
  sendTelegramAlert
};
