/**
 * Chargily Pay Integration - v2 (LIVE / TEST)
 * الدفع الآمن والفوري مع Chargily Pay
 *
 * المكان الصحيح للملف: backend/src/payments/chargily.js
 *
 * ملاحظات مهمة (تم تصحيحها مقابل الوثائق الرسمية v2):
 *  - الـ Base URL الصحيح هو pay.chargily.net وليس api.chargily.com.dz
 *  - حقول النجاح/الفشل هي success_url و failure_url (وليس back_url)
 *  - يُمرَّر webhook_endpoint داخل جسم الطلب
 *  - التحقق من التوقيع يتم بالمفتاح السري (secret key) على النص الخام للطلب
 *  - أحداث الـ webhook تأتي بالشكل { type: 'checkout.paid' | 'checkout.failed', data: {...} }
 */

const axios = require('axios')
const crypto = require('crypto')

class ChargilyPayment {
  /**
   * @param {object} config
   * @param {'live'|'test'} config.mode               الوضع: live للإنتاج، test للتجربة
   * @param {string}        config.secretKey           المفتاح السري (يبدأ بـ live_sk_ أو test_sk_) — يُستخدم للمصادقة وللتحقق من التوقيع
   * @param {string}        config.webhookUrl          رابط نقطة استقبال الـ webhook لديك
   * @param {'merchant'|'customer'} [config.feesAllocation='merchant']  من يتحمّل الرسوم
   */
  constructor(config) {
    this.mode = config.mode || 'live'
    // ملاحظة: Chargily تستخدم نفس المفتاح السري (Secret Key) للمصادقة وللتوقيع.
    this.secretKey = config.secretKey
    this.webhookUrl = config.webhookUrl
    this.feesAllocation = config.feesAllocation || 'merchant'

    this.baseURL =
      this.mode === 'live'
        ? 'https://pay.chargily.net/api/v2'
        : 'https://pay.chargily.net/test/api/v2'

    this.http = axios.create({
      baseURL: this.baseURL,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
    })
  }

  /**
   * إنشاء جلسة دفع جديدة
   * Create a new payment checkout session
   *
   * @param {object} orderData
   * @param {number} orderData.amount        المبلغ بالدينار الجزائري (عدد صحيح، الحد الأدنى عادة 50 DZD)
   * @param {string} orderData.orderId       رقم الطلب لديك (يُخزَّن في metadata)
   * @param {string} [orderData.description]  وصف الطلب
   * @param {string} [orderData.successUrl]   صفحة النجاح
   * @param {string} [orderData.failureUrl]   صفحة الفشل
   * @param {string} [orderData.paymentMethod] 'edahabia' | 'cib' | 'chargily_app' (اختياري — يمكن للعميل تغييره)
   * @param {object} [orderData.metadata]    بيانات إضافية
   */
  async createCheckout(orderData) {
    try {
      const payload = {
        amount: Math.round(Number(orderData.amount)),
        currency: 'dzd',
        success_url: orderData.successUrl,
        failure_url: orderData.failureUrl,
        webhook_endpoint: this.webhookUrl,
        description: orderData.description || 'Voltify Order',
        locale: orderData.locale || 'ar',
        // التاجر يتحمّل الرسوم
        chargily_pay_fees_allocation: this.feesAllocation,
        metadata: {
          order_id: orderData.orderId,
          order_type: orderData.orderType || 'game_topup',
          customer_name: orderData.customerName || null,
          customer_email: orderData.clientEmail || null,
          customer_phone: orderData.clientPhone || null,
          game: orderData.game || null,
          service: orderData.service || null,
          ...(orderData.metadata || {}),
        },
      }

      // تحديد طريقة الدفع فقط إذا مُرِّرت (وإلا يختار العميل من صفحة Chargily: Edahabia / CIB / Chargily App)
      if (orderData.paymentMethod) {
        payload.payment_method = orderData.paymentMethod
      }

      const { data } = await this.http.post('/checkouts', payload)

      return {
        success: true,
        checkoutUrl: data.checkout_url,
        sessionId: data.id,
        qrCodeUrl: data.qr_code_url || null, // يُرجَع فقط عند payment_method = chargily_app
        data,
      }
    } catch (error) {
      const details = error.response?.data || error.message
      console.error('❌ Chargily Checkout Error:', details)
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        details,
      }
    }
  }

  /**
   * استرجاع حالة جلسة الدفع
   * Retrieve a checkout status
   */
  async getCheckoutStatus(checkoutId) {
    try {
      const { data } = await this.http.get(`/checkouts/${checkoutId}`)
      return {
        success: true,
        status: data.status, // 'pending' | 'paid' | 'failed' | 'canceled' | 'expired'
        data,
      }
    } catch (error) {
      console.error('❌ Chargily Status Error:', error.response?.data || error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * التحقق من توقيع Webhook
   * Verify webhook signature
   *
   * مهم جداً: يجب تمرير "النص الخام" للطلب (raw body) كما وصل تماماً،
   * وليس الكائن بعد JSON.parse. استخدم express.raw() لمسار الـ webhook (انظر chargily-routes.js).
   *
   * @param {string|Buffer} rawBody    النص الخام لجسم الطلب
   * @param {string}        signature  قيمة ترويسة "signature" من Chargily
   * @returns {boolean}
   */
  verifyWebhookSignature(rawBody, signature) {
    if (!signature) return false
    const payload = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody
    const computed = crypto
      .createHmac('sha256', this.secretKey)
      .update(payload, 'utf8')
      .digest('hex')

    try {
      return crypto.timingSafeEqual(
        Buffer.from(computed, 'hex'),
        Buffer.from(signature, 'hex')
      )
    } catch {
      return false
    }
  }

  /**
   * معالجة محتوى الـ webhook (بعد التحقق من التوقيع)
   * Handle payment webhook event
   *
   * @param {object} event  الكائن الناتج عن JSON.parse للنص الخام: { type, data }
   */
  handleWebhook(event) {
    const type = event?.type
    const checkout = event?.data || {}
    const orderId = checkout?.metadata?.order_id || null
    const amount = checkout?.amount

    console.log(`📦 Webhook من Chargily:
    ✓ Type:        ${type}
    ✓ Checkout ID: ${checkout?.id}
    ✓ Order ID:    ${orderId}
    ✓ Status:      ${checkout?.status}
    ✓ Amount:      ${amount} DZD`)

    if (type === 'checkout.paid') {
      return {
        success: true,
        action: 'PAYMENT_SUCCESS',
        orderId,
        amount,
        checkout,
        message: 'تم استقبال الدفع بنجاح ✅',
      }
    }

    if (type === 'checkout.failed' || type === 'checkout.canceled' || type === 'checkout.expired') {
      return {
        success: false,
        action: 'PAYMENT_FAILED',
        orderId,
        checkout,
        message: 'فشل الدفع أو تم إلغاؤه ❌',
      }
    }

    return {
      success: null,
      action: 'PAYMENT_PENDING',
      orderId,
      checkout,
      message: 'حدث غير معالَج / قيد المعالجة ⏳',
    }
  }
}

module.exports = ChargilyPayment
