# نشر منصة Voltify — دليل عربي

## رابط واحد أم رابطان؟

### الخيار 1 — رابط واحد (موصى به للبداية)

السيرفر يقدّم **كل شيء** من نفس العنوان:

| الصفحة | الرابط |
|--------|--------|
| الموقع للعملاء | `https://your-domain.com/` أو `/index.html` |
| تتبع الطلبات | `https://your-domain.com/customer.html` |
| لوحة التحكم | `https://your-domain.com/admin.html` |
| API | `https://your-domain.com/api/...` |

**مثال:** `https://voltify.onrender.com`

**المميزات:** إعداد بسيط، لا مشاكل CORS، بيانات وصور في مكان واحد.

**التشغيل محلياً (نفس الفكرة):**

```powershell
cd backend
.\run-dev.bat
```

ثم: `http://localhost:4000`

---

### الخيار 2 — رابطان (متقدم)

| الجزء | أين يُستضاف | الرابط |
|-------|-------------|--------|
| الموقع (HTML/CSS/JS) | Netlify / Cloudflare Pages / GitHub Pages | `https://voltify.com` |
| API + لوحة التحكم | Render / Railway / VPS | `https://api.voltify.com` |

في `index.html` قبل السكربتات (أو في إعدادات الاستضافة):

```html
<script>window.VOLTIFY_API_BASE = 'https://api.voltify.com';</script>
<script src="js/platform-api.js"></script>
```

وفي `backend/.env`:

```env
FRONTEND_URL=https://voltify.com,https://www.voltify.com
```

---

## نشر سريع على Render (رابط واحد)

1. ارفع المشروع إلى **GitHub**.
2. في [render.com](https://render.com) → **New Web Service** → اختر المستودع.
3. الإعدادات:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. متغيرات البيئة:
   - `JWT_SECRET` — سلسلة عشوائية طويلة
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD` — غيّرها
   - `NODE_ENV` = `production`
   - `PORT` = `10000` (أو اترك Render يحددها)
5. بعد النشر افتح: `https://اسم-خدمتك.onrender.com/admin.html`

**ملاحظة:** على الخطة المجانية قد ينام السيرفر؛ أول زيارة تأخذ بضع ثوانٍ.

---

## نشر على VPS (رابط واحد — احترافي)

مثال: Ubuntu + Node + PM2 + Nginx + دومين `voltify.dz`

```bash
# على السيرفر
cd /var/www/voltify/backend
npm install
cp .env.example .env
nano .env   # عدّل JWT_SECRET وكلمة الأدمن

npm install -g pm2
pm2 start src/server.js --name voltify
pm2 save
```

Nginx يوجّه `your-domain.com` → `localhost:4000`

احفظ نسخة من `backend/data/` (قاعدة JSON + الصور) في النسخ الاحتياطي.

---

## قبل النشر — قائمة تحقق

- [ ] تغيير `ADMIN_PASSWORD` و `JWT_SECRET` في `.env`
- [ ] عدم رفع ملف `.env` إلى GitHub (أضفه إلى `.gitignore`)
- [ ] تجربة الموقع عبر `https` وليس `file://`
- [ ] تجربة لوحة التحكم: طلبات، منتجات، **الخدمات**، معرض
- [ ] نسخ احتياطي لـ `backend/data/store.json`

---

## شحن رصيد الهاتف (قريباً)

1. **لوحة التحكم → الخدمات:** بطاقة «شحن رصيد الهاتف» — زر **تفعيل** عند الجاهزية (يزيل «قريباً»).
2. **لوحة التحكم → المنتجات:** أضف منتجات بفئة `topup` مع المشغّل والمبلغ (Mobilis / Ooredoo / Djezzy).
3. **الموقع:** تبويب **شحن الرصيد** في قسم الألعاب يعرض هذه المنتجات.

الطلبات تُسجّل في **الطلبات** مع `order_type: topup` عند الربط من نموذج الطلب لاحقاً.

---

## روابط مفيدة بعد النشر

| الغرض | المسار |
|--------|--------|
| فحص السيرفر | `GET /health` |
| محتوى الموقع دفعة واحدة | `GET /api/public/content` |
| المنتجات | `GET /api/public/products` |
| الخدمات | `GET /api/public/services` |

---

## دعم

- تثبيت Node على Windows: `backend\INSTALL-AR.md`
- تشغيل محلي: `backend\run-dev.bat`
