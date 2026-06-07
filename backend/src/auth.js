const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { findAdmin } = require("./db");

const ROLES = {
  SUPER: "superadmin",
  EDITOR: "editor",
  VIEWER: "viewer"
};

function signAdminToken(admin) {
  const secret = process.env.JWT_SECRET || "dev-secret";
  const role = admin.role || ROLES.SUPER;
  return jwt.sign(
    { sub: admin.id, username: admin.username, role },
    secret,
    { expiresIn: "12h" }
  );
}

async function loginAdmin(username, password) {
  const admin = findAdmin(username);
  if (!admin) return null;
  const ok = await bcrypt.compare(password, admin.password_hash);
  if (!ok) return null;
  return admin;
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    req.admin = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.admin) return res.status(401).json({ error: "Unauthorized" });
    if (roles.includes(req.admin.role)) return next();
    return res.status(403).json({ error: "Forbidden" });
  };
}

function canWrite(role) {
  return role === ROLES.SUPER || role === ROLES.EDITOR;
}

module.exports = {
  ROLES,
  signAdminToken,
  loginAdmin,
  requireAdmin,
  requireRole,
  canWrite
};
