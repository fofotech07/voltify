/**
 * Voltify × Chargily Pay - frontend connector (drop-in)
 * المكان المقترح: js/chargily-checkout.js
 *
 * طريقة الربط في index.html (أضِف قبل </body> وبعد سكربتاتك الحالية):
 * ------------------------------------------------------------------
 *   <script src="js/platform-api.js"></script>
 *   <script src="js/script.js"></script>
 *   <script src="js/chargily-checkout.js"></script>   <!-- جديد -->
 * ------------------------------------------------------------------
 *
 * ماذا يفعل؟
 *  - عند اختيار طريقة الدفع "💳 Chargily Pay (CIB / Edahabia)" (data-pay="card")
 *    والضغط على زر الإرسال، يُنشئ جلسة دفع عبر backend ثم يحوّل العميل
 *    إلى صفحة الدفع الآمنة في Chargily.
 *  - طرق الدفع الثلاث (Edahabia + CIB + Chargily App) تُعرض داخل صفحة Chargily
 *    ويختار العميل بينها (لم نُمرّر paymentMethod لتظهر كلها).
 *
 * ملاحظة: عدّل دالة collectOrderData() بما يناسب الحقول الفعلية لديك،
 * أو نادِ window.VoltifyChargily.startCheckout(orderData) مباشرة من كودك.
 */
;(function () {
  'use strict'

  // نقطة نهاية backend (راوتر Chargily)
  var CHECKOUT_ENDPOINT = '/api/payments/chargily/checkout'

  /**
   * بدء عملية الدفع عبر Chargily.
   * @param {object} orderData
   *   { amount, orderId, description?, customerName?, clientPhone?, clientEmail?, orderType?, game?, service? }
   */
  async function startCheckout(orderData) {
    if (!orderData || !orderData.amount || !orderData.orderId) {
      alert('بيانات الطلب غير مكتملة (المبلغ ورقم الطلب مطلوبان).')
      return
    }

    var btn = document.getElementById('modal-online-submit') || document.getElementById('modal-wa-submit')
    var originalText = btn ? btn.innerHTML : ''
    if (btn) {
      btn.disabled = true
      btn.innerHTML = '<span>جارٍ تجهيز الدفع الآمن…</span>'
    }

    try {
      var res
      // استخدم طبقة الـ API الموجودة لديك إن وُجدت، وإلا fetch مباشر
      if (window.VoltifyAPI && typeof window.VoltifyAPI.request === 'function') {
        res = await window.VoltifyAPI.request(CHECKOUT_ENDPOINT, {
          method: 'POST',
          body: JSON.stringify(orderData),
        })
      } else {
        var r = await fetch(CHECKOUT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData),
        })
        res = await r.json()
      }

      if (res && res.success && res.checkoutUrl) {
        // إعادة التوجيه إلى صفحة الدفع الآمنة في Chargily
        window.location.href = res.checkoutUrl
      } else {
        console.error('Chargily checkout failed:', res)
        alert((res && (res.error || res.message)) || 'تعذّر بدء الدفع. حاول مرة أخرى.')
      }
    } catch (err) {
      console.error('Chargily checkout error:', err)
      alert('حدث خطأ أثناء الاتصال ببوابة الدفع. تحقق من اتصالك وحاول مجدداً.')
    } finally {
      if (btn) {
        btn.disabled = false
        btn.innerHTML = originalText
      }
    }
  }

  /**
   * يجمع بيانات الطلب من حقول المودال. عدّلها حسب الـ IDs الفعلية لديك.
   * هذه القيم مبنية على index.html (order-uid / order-name / order-phone).
   */
  function collectOrderData() {
    var nameEl = document.getElementById('order-name')
    var phoneEl = document.getElementById('order-phone')
    var uidEl = document.getElementById('order-uid')
    var titleEl = document.getElementById('modal-game-title')

    // المبلغ: يُفترض أنك تخزّنه على عنصر مخفي أو على window أثناء فتح المودال.
    // عدّل السطر التالي ليقرأ السعر الحقيقي للباقة المختارة.
    var amount = Number(window.__voltifySelectedAmount || 0)

    return {
      amount: amount,
      orderId: 'VLT-' + Date.now(),
      description: (titleEl ? titleEl.textContent : 'Voltify Order'),
      customerName: nameEl ? nameEl.value.trim() : '',
      clientPhone: phoneEl ? phoneEl.value.trim() : '',
      orderType: 'game_topup',
      game: titleEl ? titleEl.textContent : null,
      metadata: { player_uid: uidEl ? uidEl.value.trim() : '' },
      // ملاحظة: لا نُمرّر paymentMethod حتى تظهر كل الطرق (Edahabia + CIB + Chargily App)
    }
  }

  /**
   * يربط منطق الدفع البطاقي بزر الإرسال عندما تكون الطريقة المختارة = card.
   * نتحقق من طريقة الدفع المختارة عبر العنصر .pay-option.selected[data-pay].
   */
  function wireUp() {
    var submitBtn = document.getElementById('modal-wa-submit')
    var paySelect = document.getElementById('modal-pay-select')
    if (!submitBtn || !paySelect) return

    submitBtn.addEventListener(
      'click',
      function (e) {
        var selected = paySelect.querySelector('.pay-option.selected')
        var method = selected ? selected.getAttribute('data-pay') : null

        // نعترض فقط الدفع الإلكتروني عبر Chargily (card). باقي الطرق تبقى كما هي (واتساب…)
        if (method === 'card') {
          e.preventDefault()
          e.stopImmediatePropagation()
          startCheckout(collectOrderData())
        }
      },
      true // capture: لنعترض قبل معالج واتساب الأصلي
    )
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireUp)
  } else {
    wireUp()
  }

  // تصدير للاستخدام اليدوي إن رغبت
  window.VoltifyChargily = { startCheckout: startCheckout }
})()
