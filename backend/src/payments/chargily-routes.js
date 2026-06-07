/**
 * Chargily Pay Routes - جاهز للربط مع Express
 * المكان المقترح: backend/src/payments/chargily-routes.js
 *
 * طريقة الربط في server.js:
 * ------------------------------------------------------------------
 *   const chargilyRoutes = require('./payments/chargily-routes')
 *   app.use('/api/payments/chargily', chargilyRoutes)
 * ------------------------------------------------------------------
 *
 * ⚠️ مهم بخصوص الـ webhook:
 *   مسار الـ webhook يحتاج النص الخام (raw body) للتحقق من التوقيع.
 *   هذا الملف يضبط express.raw() داخلياً على مسار /webhook فقط،
 *   لذا تأكد أن app.use(express.json()) العام لا يلتقطه قبله.
 *   (الترتيب أعلاه يعمل لأن المسار الخاص يُسجَّل بـ express.raw الخاص به.)
 */

const express = require('express')
const ChargilyPayment = require('./chargily')

const router = express.Router()

// تهيئة Chargily من متغيرات البيئة
const chargily = new ChargilyPayment({
  mode: process.env.CHARGILY_MODE || 'live', // 'live' أو 'test'
  secretKey: process.env.CHARGILY_SECRET_KEY, // live_sk_xxx أو test_sk_xxx
  webhookUrl: process.env.CHARGILY_WEBHOOK_URL, // https://your-domain.com/api/payments/chargily/webhook
  feesAllocation: 'merchant', // التاجر يتحمّل الرسوم
})

/**
 * POST /api/payments/chargily/checkout
 * إنشاء جلسة دفع وإرجاع رابط الدفع
 *
 * body: { amount, orderId, description?, customerName?, clientEmail?, clientPhone?, paymentMethod?, orderType?, game?, service? }
 *  - paymentMethod اختياري: 'edahabia' | 'cib' | 'chargily_app'
 *    إذا لم يُمرَّر، تعرض صفحة Chargily كل الطرق المتاحة ويختار العميل.
 */
router.post('/checkout', express.json(), async (req, res) => {
  try {
    const { amount, orderId } = req.body
    if (!amount || Number(amount) < 50) {
      return res.status(400).json({ success: false, error: 'المبلغ غير صالح (الحد الأدنى 50 DZD)' })
    }
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'orderId مطلوب' })
    }

    const baseClientUrl = process.env.CLIENT_URL || `${req.protocol}://${req.get('host')}`

    const result = await chargily.createCheckout({
      amount,
      orderId,
      description: req.body.description,
      customerName: req.body.customerName,
      clientEmail: req.body.clientEmail,
      clientPhone: req.body.clientPhone,
      orderType: req.body.orderType,
      game: req.body.game,
      service: req.body.service,
      paymentMethod: req.body.paymentMethod, // اختياري
      // صفحة النجاح في Voltify تقرأ ?txn_id= وتستدعي /api/public/payments/verify
      successUrl: req.body.successUrl || `${baseClientUrl}/payment-success.html?txn_id=${orderId}`,
      failureUrl: req.body.failureUrl || `${baseClientUrl}/payment-failed.html?txn_id=${orderId}`,
    })

    if (!result.success) {
      return res.status(502).json(result)
    }

    // TODO: خزّن sessionId مع الطلب في قاعدة البيانات بحالة "pending" هنا.
    return res.json(result)
  } catch (err) {
    console.error('❌ /checkout error:', err)
    return res.status(500).json({ success: false, error: 'خطأ داخلي في الخادم' })
  }
})

/**
 * GET /api/payments/chargily/status/:id
 * الاستعلام عن حالة جلسة دفع
 */
router.get('/status/:id', express.json(), async (req, res) => {
  const result = await chargily.getCheckoutStatus(req.params.id)
  return res.status(result.success ? 200 : 502).json(result)
})

/**
 * POST /api/payments/chargily/webhook
 * نقطة استقبال أحداث Chargily.
 * express.raw() ضروري للتحقق من التوقيع على النص الخام.
 */
router.post('/webhook', express.raw({ type: '*/*' }), (req, res) => {
  const signature = req.get('signature') || req.get('Signature')
  const rawBody = req.body // Buffer بسبب express.raw

  if (!chargily.verifyWebhookSignature(rawBody, signature)) {
    console.warn('⚠️ توقيع Webhook غير صالح — تم الرفض')
    return res.status(403).json({ success: false, error: 'invalid signature' })
  }

  let event
  try {
    event = JSON.parse(rawBody.toString('utf8'))
  } catch {
    return res.status(400).json({ success: false, error: 'invalid json' })
  }

  const result = chargily.handleWebhook(event)

  // عالج النتيجة حسب منطق عملك:
  if (result.action === 'PAYMENT_SUCCESS') {
    // TODO: حدّث حالة الطلب result.orderId إلى "paid" ونفّذ الشحن/الخدمة.
  } else if (result.action === 'PAYMENT_FAILED') {
    // TODO: حدّث حالة الطلب result.orderId إلى "failed".
  }

  // أعد 200 دائماً بعد التحقق حتى لا تعيد Chargily الإرسال بلا داعٍ.
  return res.status(200).json({ received: true })
})

/**
 * POST /verify  (عام — للواجهة الأمامية)
 * تستدعيه صفحة payment-success.html عبر /api/public/payments/verify.
 * يتحقق من حالة جلسة الدفع لدى Chargily ويعيد ملخصاً آمناً للعرض.
 *
 * للربط في server.js (مسار عام منفصل):
 *   const chargilyRoutes = require('./payments/chargily-routes')
 *   app.use('/api/payments/chargily', chargilyRoutes)
 *   // وأيضاً وجّه مسار التحقق العام إلى نفس الراوتر:
 *   app.post('/api/public/payments/verify', express.json(), chargilyRoutes.verifyHandler)
 *
 * body: { transaction_id }  حيث transaction_id هو sessionId جلسة Chargily (أو orderId إن كنت تخزّن الربط).
 */
async function verifyHandler(req, res) {
  try {
    const txnId = req.body?.transaction_id
    if (!txnId) {
      return res.status(400).json({ error: 'transaction_id مطلوب' })
    }

    const result = await chargily.getCheckoutStatus(txnId)
    if (!result.success) {
      return res.status(404).json({ error: 'لم يتم العثور على المعاملة' })
    }

    const c = result.data
    return res.json({
      transaction_id: c.id,
      order_id: c.metadata?.order_id || null,
      amount: Number(c.amount),
      currency: (c.currency || 'dzd').toUpperCase(),
      status: c.status, // paid | pending | failed | canceled | expired
      paid: c.status === 'paid',
    })
  } catch (err) {
    console.error('❌ /verify error:', err)
    return res.status(500).json({ error: 'خطأ داخلي في الخادم' })
  }
}

router.post('/verify', express.json(), verifyHandler)

/**
 * POST /api/payments/chargily/retry
 * تستدعيه صفحة payment-failed.html لإعادة بدء الدفع لطلب فشل سابقاً.
 *
 * body: { transaction_id }  (هو الـ orderId أو sessionId الذي مُرِّر في رابط الفشل)
 *
 * ملاحظة: للحصول على إعادة محاولة دقيقة، يُفضّل جلب بيانات الطلب الأصلي
 * (المبلغ/الوصف) من قاعدة بياناتك عبر transaction_id ثم إنشاء جلسة جديدة.
 * هنا نحاول قراءة الجلسة القديمة من Chargily لإعادة استخدام مبلغها وبياناتها.
 */
router.post('/retry', express.json(), async (req, res) => {
  try {
    const txnId = req.body?.transaction_id
    if (!txnId) {
      return res.status(400).json({ success: false, error: 'transaction_id مطلوب' })
    }

    const baseClientUrl = process.env.CLIENT_URL || `${req.protocol}://${req.get('host')}`

    // 1) حاول استرجاع الجلسة القديمة من Chargily لإعادة استخدام مبلغها وبياناتها.
    const prev = await chargily.getCheckoutStatus(txnId)

    let amount
    let metadata = {}
    let description = 'Voltify Order (إعادة محاولة)'
    let orderId = txnId

    if (prev.success && prev.data) {
      amount = Number(prev.data.amount)
      metadata = prev.data.metadata || {}
      orderId = metadata.order_id || txnId
      description = prev.data.description || description
    }

    // إن لم نتمكن من جلب المبلغ (مثلاً مرّ orderId وليس sessionId)،
    // اطلب من العميل العودة لصفحة الطلب لاختيار الباقة من جديد.
    if (!amount || amount < 50) {
      return res.status(422).json({
        success: false,
        error: 'تعذّرت إعادة المحاولة تلقائياً، يرجى إعادة الطلب من الصفحة الرئيسية',
      })
    }

    // 2) أنشئ جلسة دفع جديدة بنفس البيانات.
    const result = await chargily.createCheckout({
      amount,
      orderId,
      description,
      customerName: metadata.customer_name,
      clientEmail: metadata.customer_email,
      clientPhone: metadata.customer_phone,
      orderType: metadata.order_type,
      game: metadata.game,
      service: metadata.service,
      metadata,
      successUrl: `${baseClientUrl}/payment-success.html?txn_id=${orderId}`,
      failureUrl: `${baseClientUrl}/payment-failed.html?txn_id=${orderId}`,
    })

    return res.status(result.success ? 200 : 502).json(result)
  } catch (err) {
    console.error('❌ /retry error:', err)
    return res.status(500).json({ success: false, error: 'خطأ داخلي في الخادم' })
  }
})

module.exports = router
module.exports.verifyHandler = verifyHandler
