# تثبيت Node بدون winget (حل لمشكلة "npm is not recognized")

## الطريقة 1: Node محمول داخل المشروع (موصى بها)

### الخطوة 1
افتح **PowerShell** كمسؤول أو عادي، ثم:

```powershell
cd C:\Users\HARICHA\Desktop\portfolio\backend
powershell -ExecutionPolicy Bypass -File setup-portable-node.ps1
```

انتظر حتى ترى `SUCCESS`.

### الخطوة 2
انقر مرتين على الملف:

`install-and-run.bat`

أو من PowerShell:

```powershell
cd C:\Users\HARICHA\Desktop\portfolio\backend
.\install-and-run.bat
```

### الخطوة 3
افتح المتصفح:

http://localhost:4000/dashboard.html

- المستخدم: `admin`
- كلمة المرور: `AdminPassword123!`

---

## الطريقة 2: تثبيت Node الرسمي (MSI)

1. افتح: https://nodejs.org
2. حمّل **LTS** (ملف `.msi`)
3. شغّل المثبت **Run as administrator**
4. أغلق PowerShell وافتحه من جديد
5. تحقق:

```powershell
node -v
npm -v
```

6. ثم:

```powershell
cd C:\Users\HARICHA\Desktop\portfolio\backend
npm install
copy .env.example .env
npm run dev
```

---

## إذا فشل التحميل (الطريقة 1)

- تأكد من اتصال الإنترنت
- جرّب VPN أو شبكة أخرى
- أو حمّل يدوياً من:
  https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip
- فك الضغط داخل:
  `C:\Users\HARICHA\Desktop\portfolio\tools\`
- أعد تسمية المجلد إلى `node` (المسار النهائي):
  `C:\Users\HARICHA\Desktop\portfolio\tools\node\node.exe`
