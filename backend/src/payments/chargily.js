/**
 * Chargily Pay Integration - LIVE MODE
 * الدفع الآمن والفوري مع Chargily Pay
 * 
 * ملاحظة: هذا الملف يجب أن يكون في backend/src/payments/chargily.js
 */

const axios = require('axios');
const crypto = require('crypto');

class ChargilyPayment {
  constructor(config) {
    this.mode = config.mode || 'live'; // 'test' أو 'live'
    this.apiKey = config.apiKey;
    this.secretKey = config.secretKey;
    this.webhookSecret = config.webhookSecret;
    this.webhookUrl = config.webhookUrl;
    this.baseURL = this.mode === 'live' 
      ? 'https://api.chargily.com.dz/api/v2'
      : 'https://test-api.chargily.com.dz/api/v2';
  }

  /**
   * إنشاء جلسة دفع جديدة
   * Create a new payment checkout session
   */
  async createCheckout(orderData) {
    try {
      const checkoutData = {
        amount: orderData.amount, // بالدنانير الجزائرية
        currency: 'DZD',
        description: orderData.description || 'Voltify Order',
        client_email: orderData.clientEmail || 'customer@voltify.dz',
        client_phone: orderData.clientPhone || '+213676422372',
        order_id: orderData.orderId,
        webhook_url: this.webhookUrl,
        back_url: orderData.backUrl,
        failure_url: orderData.failureUrl,
        metadata: {
          order_type: orderData.orderType || 'game_topup', // game_topup أو repair
          customer_name: orderData.customerName,
          game: orderData.game || null,
          service: orderData.service || null,
        }
      };

      const response = await axios.post(
        `${this.baseURL}/checkouts`,
        checkoutData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        checkoutUrl: response.data.checkout_url,
        sessionId: response.data.id,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Chargily Checkout Error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * التحقق من حالة الدفع
   * Check payment status
   */
  async getCheckoutStatus(checkoutId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/checkouts/${checkoutId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return {
        success: true,
        status: response.data.status, // 'pending', 'completed', 'failed'
        data: response.data
      };
    } catch (error) {
      console.error('❌ Chargily Status Error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * التحقق من توقيع Webhook
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature) {
    const hash = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return hash === signature;
  }

  /**
   * معالجة webhook الدفع
   * Handle payment webhook
   */
  async handleWebhook(webhookData) {
    const { id, status, order_id, amount } = webhookData;

    console.log(`📦 Webhook من Chargily:
    ✓ Checkout ID: ${id}
    ✓ Order ID: ${order_id}
    ✓ Status: ${status}
    ✓ Amount: ${amount} DZD`);

    if (status === 'completed') {
      return {
        success: true,
        action: 'PAYMENT_SUCCESS',
        orderId: order_id,
        amount: amount,
        message: 'تم استقبال الدفع بنجاح ✅'
      };
    } else if (status === 'failed') {
      return {
        success: false,
        action: 'PAYMENT_FAILED',
        orderId: order_id,
        message: 'فشل الدفع، يرجى المحاولة مجدداً ❌'
      };
    }

    return {
      success: null,
      action: 'PAYMENT_PENDING',
      orderId: order_id,
      message: 'الدفع قيد المعالجة ⏳'
    };
  }
}

module.exports = ChargilyPayment;
