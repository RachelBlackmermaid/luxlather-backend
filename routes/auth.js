import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();
const router = express.Router();

const {
  JWT_SECRET,
  NODE_ENV,
  ADMIN_USERNAME,   // optional env-admin
  ADMIN_PASSWORD,   // optional env-admin
  ADMIN_EMAIL,      // optional env-admin
} = process.env;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is missing. Add it to your backend env.");
}

const isProd = NODE_ENV === "production";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: isProd ? "none" : "lax",
  secure: isProd,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const EMAIL_RE = /^\S+@\S+\.\S+$/i;

const toLowerTrim = (s) => (typeof s === "string" ? s.trim().toLowerCase() : "");
const toTrim = (s) => (typeof s === "string" ? s.trim() : "");

// JWT helpers
function signToken(payload, expiresIn = "7d") {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}
function setAuthCookie(res, token) {
  res.cookie("token", token, COOKIE_OPTS);
}

router.post("/signup", async (req, res) => {
  try {
    const { email, password, name, username } = req.body || {};
    const emailNorm = toLowerTrim(email);
    const usernameNorm = toLowerTrim(username);

    if (!emailNorm || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    // Uniqueness checks
    const existingByEmail = await User.findOne({ email: emailNorm }).select("_id");
    if (existingByEmail) return res.status(409).json({ error: "Email already in use" });

    if (usernameNorm) {
      const existingByUsername = await User.findOne({ username: usernameNorm }).select("_id");
      if (existingByUsername) return res.status(409).json({ error: "Username already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email: emailNorm,
      username: usernameNorm || undefined, // only save if provided
      passwordHash,
      name: toTrim(name),
      role: "customer",
    });

    const token = signToken({ sub: user._id.toString(), role: user.role });
    setAuthCookie(res, token);

    return res.json({
      token,
      user: { id: user._id, email: user.email, username: user.username, name: user.name, role: user.role },
    });
  } catch (e) {
    console.error("Signup failed:", e);
    return res.status(500).json({ error: "Signup failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { identifier, email, username, password } = req.body || {};
    const rawId = toTrim(identifier) || toTrim(email) || toTrim(username);
    if (!rawId || !password) {
      return res.status(400).json({ error: "Missing credentials" });
    }

    const looksLikeEmail = EMAIL_RE.test(rawId);
    const emailNorm = looksLikeEmail ? toLowerTrim(rawId) : undefined;
    const usernameNorm = looksLikeEmail ? undefined : toLowerTrim(rawId);

    let user = null;
    if (emailNorm) {
      user = await User.findOne({ email: emailNorm });
    } else if (usernameNorm) {
      user = await User.findOne({ username: usernameNorm });
    }

    if (user) {
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: "Invalid credentials" });

      const token = signToken({ sub: user._id.toString(), role: user.role });
      setAuthCookie(res, token);
      return res.json({
        token,
        user: { id: user._id, email: user.email, username: user.username, name: user.name, role: user.role },
      });
    }

    // --- Env-admin fallback (no DB user) ---
    const isEnvAdminId =
      (!!ADMIN_USERNAME && rawId === ADMIN_USERNAME) ||
      (!!ADMIN_EMAIL && rawId.toLowerCase() === ADMIN_EMAIL.toLowerCase());

    if (isEnvAdminId && password === ADMIN_PASSWORD) {
      const token = signToken({ role: "admin" }, "1d"); // no sub for env-admin
      setAuthCookie(res, token);
      return res.json({
        token,
        user: { id: null, email: ADMIN_EMAIL || null, username: ADMIN_USERNAME || null, name: "Env Admin", role: "admin" },
      });
    }

    return res.status(401).json({ error: "Invalid credentials" });
  } catch (e) {
    console.error("Login failed:", e);
    return res.status(500).json({ error: "Login failed" });
  }
});


router.post("/admin/env-login", (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = signToken({ role: "admin" }, "1d");
    setAuthCookie(res, token);
    return res.json({
      token,
      user: { id: null, email: ADMIN_EMAIL || null, username: ADMIN_USERNAME || null, name: "Env Admin", role: "admin" },
    });
  }
  return res.status(401).json({ error: "Invalid credentials" });
});


router.get("/me", async (req, res) => {
  try {
    const bearer = (req.headers.authorization || "").replace("Bearer ", "");
    const token = req.cookies?.token || bearer || (req.headers["x-auth-token"] || "");
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.sub) {
      const user = await User.findById(decoded.sub).select("_id email username name role");
      if (!user) return res.status(401).json({ error: "User not found" });
      return res.json({ id: user._id, email: user.email, username: user.username, name: user.name, role: user.role });
    }

    // env-admin fallback
    return res.json({
      id: null,
      email: ADMIN_EMAIL || null,
      username: ADMIN_USERNAME || null,
      name: "Env Admin",
      role: decoded.role || "admin",
    });
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
});

/**
 * POST /api/auth/logout
 * - Clears auth cookie
 */
router.post("/logout", (req, res) => {
  res.clearCookie("token", COOKIE_OPTS);
  res.json({ ok: true });
});

export default router;
