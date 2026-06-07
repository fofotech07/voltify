# ⚡ Voltify — منصة تقنية متكاملة | Integrated Tech Platform

> **الحل الأول للشحن الفوري، إصلاح الأجهزة، والخدمات الرقمية في الجزائر**  
> **Your One-Stop Platform for Gaming Top-Ups, Device Repair & Digital Services in Algeria**

---

## 🌟 نظرة عامة | Overview

**Voltify** منصة ويب متكاملة تقدم:
- 🎮 **شحن فوري للألعاب** (Free Fire, PUBG, Mobile Legends، إلخ)
- 📱 **صيانة أجهزة** (هواتف ذكية، أجهزة كمبيوتر، حواسيب محمولة)
- 💳 **خدمات رقمية** (شحن رصيد، بطاقات هدايا، إلخ)
- 📦 **تتبع الطلبات** (تابع حالة طلبك في الوقت الفعلي)
- 💰 **دفع إلكتروني آمن** (Chargily Pay Live, BaridiMob, Flexy, CCP)
- 📲 **إشعارات فورية** (WhatsApp, Telegram)

---

## 📋 المميزات الرئيسية | Key Features

### للعملاء | For Customers
✅ واجهة عملية وسهلة (RTL عربي + LTR إنجليزي)  
✅ شحن فوري في دقائق  
✅ تتبع طلبات حي (Game Top-Ups & Repair Requests)  
✅ 💳 دفع آمن عبر **Chargily Pay (Live Mode)**  
✅ دعم 24/7 عبر WhatsApp و Telegram  
✅ 📲 إشعارات فورية عند كل تحديث  
✅ فواتير قابلة للتحميل (PDF)  

### للمسؤول | For Admin
✅ لوحة تحكم قوية (RTL عربي)  
✅ إدارة الطلبات والصيانة والفواتير  
✅ إدارة المنتجات والخدمات بـ 3 لغات  
✅ معرض صور ديناميكي  
✅ إدارة المستخدمين والصلاحيات  
✅ 📊 تقارير مبيعات يومية/شهرية  
✅ سجل المعاملات الكامل مع Chargily  

---

## 🏗️ هيكل المشروع | Project Structure

```
voltify/
├── 📄 index.html                    # الصفحة الرئيسية
├── 📄 admin.html                    # لوحة التحكم
├── 📄 customer.html                 # تتبع الطلبات
├── 📄 dashboard.html                # لوحة البيانات
├── 📄 payment-*.html                # صفحات الدفع
├── 📁 css/
│   ├── style.css                    # الأنماط الرئيسية
│   └── admin.css                    # أنماط لوحة التحكم
├── 📁 js/
│   ├── platform-api.js              # واجهة API للواجهة الأمامية
│   └── admin-api.js                 # واجهة API للمسؤول
├── 📁 backend/                      # Backend Node.js
│   ├── src/
│   │   ├── server.js                # خادم رئيسي
│   │   ├── routes/                  # مسارات API
│   │   ├── controllers/             # التحكم بالمنطق
│   │   ├── middleware/              # وسائط البيانات
│   │   ├── payments/                # تكامل الدفع (Chargily)
│   │   ├── notifications/           # إشعارات WhatsApp/Telegram
│   │   └── utils/                   # أدوات مساعدة
│   ├── data/
│   │   ├── store.json               # قاعدة البيانات الرئيسية
│   │   ├── backup/                  # النسخ الاحتياطية اليومية
│   │   └── uploads/                 # الصور المرفوعة
│   ├── .env.example                 # متغيرات البيئة (مثال)
│   ├── package.json                 # المكتبات
│   ├── run-dev.bat                  # تشغيل محلي (Windows)
│   ├── run-dev.sh                   # تشغيل محلي (Mac/Linux)
│   └── deploy.sh                    # نشر على Render
├── 📄 ROADMAP-AR.md                 # خريطة الطريق
└── 📄 DEPLOY-AR.md                  # دليل النشر
```

---

## 🚀 التثبيت والتشغيل | Installation & Setup

### المتطلبات | Requirements
- **Node.js** 16.0+ و **npm** 8.0+
- متصفح حديث (Chrome, Firefox, Safari, Edge)
- حساب **Chargily Pay** (Live Mode)
- رقم WhatsApp للإشعارات

### 1. استنساخ المستودع | Clone Repository
```bash
git clone https://github.com/fofotech07/voltify.git
cd voltify
cd backend
```

### 2. تثبيت المكتبات | Install Dependencies
```bash
npm install
```

### 3. إعداد البيئة | Setup Environment

أنشئ ملف `backend/.env`:

```env
# ========== Server ==========
NODE_ENV=production
PORT=4000
JWT_SECRET=your-super-secret-key-min-32-chars-change-this-now

# ========== Admin Credentials ==========
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-strong-password-change-this

# ========== Frontend URLs (CORS) ==========
FRONTEND_URL=http://localhost:4000,https://voltify-live.onrender.com

# ========== LIVE MODE - Chargily Pay ==========
CHARGILY_MODE=live
CHARGILY_API_KEY=live_pk_your_public_key_here
CHARGILY_SECRET_KEY=live_sk_your_secret_key_here
CHARGILY_WEBHOOK_SECRET=whsec_your_webhook_secret_here
CHARGILY_WEBHOOK_URL=https://your-domain.com/api/payments/chargily/webhook

# ========== WhatsApp Notifications ==========
WHATSAPP_ENABLED=true
WHATSAPP_PHONE=0676422372
WHATSAPP_API_URL=https://api.whatsapp.com/send

# ========== Telegram Integration ==========
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=-100your_chat_id_here

# ========== Database (JSON - Best for Now) ==========
DATABASE_TYPE=json
DATABASE_PATH=./data/store.json
BACKUP_ENABLED=true
BACKUP_INTERVAL=86400000

# ========== Email (Optional - Future) ==========
MAIL_ENABLED=false
MAIL_SERVICE=gmail
MAIL_USER=your-email@gmail.com
MAIL_PASSWORD=your-app-password
```

### 4. تشغيل محلياً | Local Development

#### على Windows
```powershell
cd backend
.\run-dev.bat
```

#### على Mac/Linux
```bash
cd backend
bash run-dev.sh
```

ثم افتح: **http://localhost:4000**

---

## 💳 دمج Chargily Pay (LIVE MODE) | Chargily Integration

### الخطوة 1: إنشاء حساب Chargily
1. اذهب إلى [pay.chargily.com](https://pay.chargily.com)
2. اشترك وتحقق من البريد
3. أكمل التحقق من الهوية

### الخطوة 2: الحصول على مفاتيح Live
1. اذهب إلى **Developers Corner** → **Live Keys**
2. انسخ:
   - `live_pk_...` (Public Key)
   - `live_sk_...` (Secret Key)
3. ضعهما في `.env`

### الخطوة 3: إعداد Webhook
1. في **Developers Corner** → **Webhooks**
2. أضف URL: `https://your-domain.com/api/payments/chargily/webhook`
3. انسخ Webhook Secret
4. اختر الأحداث: **payment.success**, **payment.failed**

### الخطوة 4: اختبر الدفع
```bash
npm start
```

1. افتح الموقع
2. اختر منتج
3. اختر "Chargily Pay"
4. استخدم بطاقة **Edahabia** أو **CIB**

---

## 📱 إشعارات WhatsApp الفورية | WhatsApp Notifications

### الإعداد
في `.env`:
```env
WHATSAPP_ENABLED=true
WHATSAPP_PHONE=0676422372
```

### الأحداث المراقبة
- ✅ طلب جديد → إشعار فوري
- ✅ تحديث حالة الطلب → تنبيه
- ✅ دفع ناجح → تأكيد
- ✅ طلب صيانة جديد → إخطار

### الرسالة التي يتلقاها العميل:
```
🔔 شكراً لاستخدام Voltify!

📦 طلبك #VLT-123456 تم استقباله
🎮 منتج: Free Fire 1000 Diamond
💰 السعر: 1500 DZD
⏰ الحالة: قيد المعالجة

تابع طلبك: https://voltify.com/customer.html?tracking=VLT-123456

دعم 24/7:
📱 WhatsApp: 0676422372
🤖 Telegram: @CPETechOrdersBot
```

---

## 💾 حفظ البيانات بأفضل طريقة | Data Management

### النظام الحالي (JSON - محسّن)
✅ **سهل للبدء والنمو الأولي**
✅ **نسخ احتياطية تلقائية يومية**
✅ **ضغط البيانات (compression)**
✅ **تشفير كلمات المرور**

### النسخة المتقدمة (قريباً)
```env
# اختياري - لاحقاً:
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://user:pass@localhost/voltify
```

### النسخ الاحتياطية التلقائية
```
backend/data/
├── store.json                              # البيانات الحالية
└── backup/
    ├── store.backup.2026-06-07.json        # نسخة يومية
    ├── store.backup.2026-06-06.json
    └── store.backup.2026-06-05.json
```

يحفظ تلقائياً كل **24 ساعة** ويحتفظ بآخر **7 نسخ**.

---

## 🔐 الأمان | Security

### قبل النشر | Before Deployment
- [x] غيّر `ADMIN_PASSWORD` بكلمة قوية
- [x] غيّر `JWT_SECRET` بـ 32+ حرفاً عشوائياً
- [x] استخدم **HTTPS إجباري**
- [x] فعّل **Rate Limiting**
- [x] احفظ نسخة احتياطية يومية
- [x] استخدم **Live Keys** فقط بعد التحقق

### الأدوار والصلاحيات | Roles & Permissions
```
👤 مشاهد (Viewer):
   ✓ عرض الطلبات والمنتجات
   ✗ لا يمكن تعديل أو حذف

✏️ محرر (Editor):
   ✓ إضافة/تعديل الطلبات والمنتجات
   ✓ إدارة الخدمات
   ✗ لا يمكن تعديل المستخدمين

🔑 مدير عام (Superadmin):
   ✓ كل شيء
   ✓ إدارة المستخدمين والإعدادات
   ✓ عرض سجل التدقيق (Audit Log)
```

---

## 🚀 النشر على Render (مجاني) | Deploy to Render

### الخطوة 1: ارفع على GitHub
```bash
git add .
git commit -m "Ready for Render deployment"
git push origin main
```

### الخطوة 2: اربط Render
1. اذهب إلى [render.com](https://render.com)
2. اضغط **New** → **Web Service**
3. اختر المستودع

### الخطوة 3: الإعدادات
```
Name: voltify
Runtime: Node
Root Directory: backend
Build Command: npm install
Start Command: npm start
```

### الخطوة 4: متغيرات البيئة
أضف من `.env` الخاص بك:
```
NODE_ENV=production
PORT=10000
JWT_SECRET=your-32-char-secret
ADMIN_PASSWORD=your-strong-password
CHARGILY_API_KEY=live_pk_...
CHARGILY_SECRET_KEY=live_sk_...
CHARGILY_WEBHOOK_SECRET=whsec_...
CHARGILY_WEBHOOK_URL=https://your-render-url.onrender.com/api/payments/chargily/webhook
WHATSAPP_PHONE=0676422372
```

### الخطوة 5: Deploy!
اضغط **Create Web Service** وانتظر (~3 دقائق)

الرابط الخاص بك: `https://voltify-xxxx.onrender.com`

---

## 📊 واجهة API الكاملة | Complete API Reference

### تتبع الطلبات | Track Orders
```bash
POST /api/public/track
Content-Type: application/json

{
  "tracking_number": "VLT-123456",
  "phone": "0676422372"
}
```

### إنشاء طلب جديد | Create Order
```bash
POST /api/public/orders
Content-Type: application/json

{
  "customer": "أحمد محمد",
  "phone": "0676422372",
  "game": "Free Fire",
  "pkg": "1000 Diamonds",
  "price": 1500,
  "uid": "123456789",
  "payment_method": "chargily",
  "proof": "base64-image-or-url"
}
```

### طلب صيانة | Repair Request
```bash
POST /api/public/repairs
Content-Type: application/json

{
  "name": "أحمد محمد",
  "phone": "0676422372",
  "device_type": "Mobile Phone",
  "brand_model": "Samsung S23",
  "service_type": "Screen Replacement",
  "description": "الشاشة مكسورة تماماً",
  "contact_method": "WhatsApp"
}
```

### دفع Chargily | Chargily Payment
```bash
POST /api/payments/chargily/checkout
Content-Type: application/json

{
  "order_id": "VLT-123456",
  "amount": 1500,
  "currency": "DZD",
  "description": "Free Fire 1000 Diamonds"
}

Response:
{
  "checkout_url": "https://pay.chargily.com/checkout/...",
  "session_id": "..."
}
```

### Webhook Chargily | Payment Confirmation
```
POST /api/payments/chargily/webhook
(تُرسل تلقائياً من Chargily)

عند نجاح الدفع:
- ✅ تحديث حالة الطلب
- 📲 إشعار WhatsApp للعميل
- 📧 إشعار للمسؤول
- 🔔 سجل المعاملة
```

---

## 🛠️ استكشاف الأخطاء | Troubleshooting

### "Cannot connect to backend"
```
✓ تأكد من تشغيل السيرفر: npm start
✓ افتح http://localhost:4000/health
✓ تحقق من PORT في .env
✓ افتح ports في firewall
```

### "Chargily payment not working"
```
✓ تحقق من NODE_ENV=production في .env (Live Mode)
✓ تأكد من CHARGILY_API_KEY و CHARGILY_SECRET_KEY صحيحة
✓ تحقق من webhook URL في إعدادات Chargily
✓ تحقق من سجلات الخادم: tail -f backend/logs/error.log
```

### "WhatsApp notifications not sending"
```
✓ تأكد من WHATSAPP_ENABLED=true في .env
✓ تحقق من رقم الهاتف: 0676422372
✓ استخدم الرابط: https://api.whatsapp.com/send?phone=213676422372&text=Test
```

### "لا تظهر الصور المرفوعة"
```
✓ تأكد من وجود backend/data/uploads/
✓ تحقق من صلاحيات المجلد (755)
✓ استخدم مسار نسبي: /api/uploads/filename.jpg
```

---

## 📚 مراجع سريعة | Quick References

### ملفات المشروع المهمة
| الملف | الغرض |
|------|--------|
| `backend/.env` | متغيرات البيئة (غير قسري) |
| `backend/src/server.js` | الخادم الرئيسي |
| `backend/data/store.json` | قاعدة البيانات |
| `js/platform-api.js` | API للموقع العام |
| `js/admin-api.js` | API للمسؤول |

### أوامر مفيدة
```bash
# تشغيل محلي
npm start

# تشغيل في وضع الفهرسة (للتطوير)
npm run dev

# فحص الأخطاء
npm run lint

# عمل نسخة احتياطية يدوية
npm run backup

# مسح قاعدة البيانات (احذر!)
npm run reset-db
```

---

## 🗺️ خريطة الطريق | Roadmap

### ✅ الجاهز الآن
- [x] واجهة عملاء احترافية
- [x] لوحة تحكم متقدمة
- [x] نظام الطلبات والفواتير
- [x] دعم 3 لغات (عربي، إنجليزي، فرنسي)
- [x] **Chargily Pay Live Mode** 🎉
- [x] **إشعارات WhatsApp الفورية** 📲
- [x] **نسخ احتياطية تلقائية** 💾

### 🔄 قريباً (الأسابيع القادمة)
- [ ] حسابات عملاء (تسجيل/دخول)
- [ ] لوحة إحصائيات متقدمة
- [ ] نقاط الولاء والتخفيفات
- [ ] BaridiMob و Flexy Integration
- [ ] إشعارات Telegram Bot

### 🚀 المستقبل (الأشهر القادمة)
- [ ] تطبيق PWA (تثبيت على الجوال)
- [ ] تطبيق Android/iOS
- [ ] دعم العملات المتعددة
- [ ] تقارير ضريبية رسمية
- [ ] نظام احجز الموعد

---

## 🤝 المساهمة | Contributing

نرحب بالمساهمات! لإضافة ميزة:

1. اعمل fork للمستودع
2. أنشئ branch جديد: `git checkout -b feature/your-feature`
3. أضف تغييراتك والاختبارات
4. أرسل PR مع وصف واضح
5. سيتم مراجعة وقبول PR الخاص بك

---

## 📞 الدعم والتواصل | Support & Contact

| القناة | التفاصيل |
|--------|----------|
| 📱 WhatsApp | [0676 422 372](https://wa.me/213676422372) |
| 🤖 Telegram | [@CPETechOrdersBot](https://t.me/CPETechOrdersBot) |
| 📧 البريد | support@voltify.dz |
| 🐛 المشاكل والأخطاء | [GitHub Issues](https://github.com/fofotech07/voltify/issues) |
| 💬 النقاشات | [GitHub Discussions](https://github.com/fofotech07/voltify/discussions) |

---

## 📜 الترخيص | License

هذا المشروع مرخص تحت **MIT License** - انظر [LICENSE](LICENSE) للتفاصيل.

يمكنك استخدام، تعديل، ونشر هذا المشروع بحرية مع الإشارة للمصدر.

---

## 👤 المطور | Developer

**fofotech07**  
- GitHub: [@fofotech07](https://github.com/fofotech07)
- Location: Biskra, Algeria 🇩🇿

---

## 🙏 شكر خاص | Special Thanks

شكر لـ:
- ✨ فريق **Chargily Pay** على التكامل السلس
- ✨ مجتمع الويب الجزائري
- ✨ كل من ساهم في اختبار وتطوير المشروع
- ✨ عملائنا الكرام على الثقة

---

**صُنع بـ ❤️ في الجزائر | Made with ❤️ in Algeria**

**آخر تحديث:** 2026-06-07  
**الإصدار:** 1.0.0 Production Ready

---

## 📈 الإحصائيات | Statistics

| البند | القيمة |
|------|--------|
| السطور البرمجية | 5000+ |
| الملفات | 25+ |
| اللغات المدعومة | 3 |
| الألعاب المدعومة | 15+ |
| طرق الدفع | 5+ |
| الأدوار | 3 |
| الدول المدعومة | 1 (DZD) |
| وقت الشحن المتوسط | 5-30 دقيقة |

---

**شكراً لاستخدامك Voltify! 🚀**
