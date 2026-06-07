/**
 * إعادة تعيين كلمة مرور الأدمن
 * الاستخدام:
 *   node reset-admin-password.js
 *   node reset-admin-password.js "كلمة_مرور_جديدة"
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const storePath = path.join(__dirname, "data", "store.json");
const username = process.env.ADMIN_USERNAME || "admin";
const newPassword = process.argv[2] || process.env.ADMIN_PASSWORD || "AdminPassword123!";

if (!fs.existsSync(storePath)) {
  console.error("ملف store.json غير موجود:", storePath);
  process.exit(1);
}

const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
const admin = store.admins.find((a) => a.username === username) || store.admins[0];

if (!admin) {
  console.error("لا يوجد حساب أدمن في قاعدة البيانات.");
  process.exit(1);
}

admin.password_hash = bcrypt.hashSync(newPassword, 10);
fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");

console.log("تم إعادة تعيين كلمة المرور بنجاح.");
console.log("اسم المستخدم:", admin.username);
console.log("كلمة المرور الجديدة:", newPassword);
console.log("سجّل الدخول من: http://localhost:4000/admin.html");
