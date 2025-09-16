import express from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import jwt from "jsonwebtoken";
import ContactMessage from "../models/ContactMessage.js";
import nodemailer from "nodemailer";

const router = express.Router();

/* ---------- rate limit: 5 req/min per IP ---------- */
const contactLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ---------- validation ---------- */
const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(320),
  message: z.string().min(5).max(5000),
  website: z.string().max(0).optional().or(z.literal("")), // honeypot must be empty
});

/* ---------- optional auth (for admin endpoints) ---------- */
function optionalAuth(req, _res, next) {
  try {
    const bearer = (req.headers.authorization || "").replace("Bearer ", "");
    const token = req.cookies?.token || bearer;
    if (!token) return next();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.sub, role: decoded.role };
  } catch {}
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

/* ---------- mailer  ---------- */
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true", // true for 465, false for 587
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

/* ---------- POST /api/contact ---------- */
router.post("/", contactLimiter, async (req, res) => {
  try {
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input" });
    }
    const { name, email, message, website } = parsed.data;

    // honeypot triggered → pretend success
    if (website) return res.json({ ok: true });

    // persist to DB
    const doc = await ContactMessage.create({
      name,
      email,
      message,
      ip: req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress,
      userAgent: req.headers["user-agent"],
    });

    // send email notification (best-effort)
    if (transporter && process.env.CONTACT_TO_EMAIL) {
      try {
        await transporter.sendMail({
          from: process.env.CONTACT_FROM_EMAIL || process.env.SMTP_USER,
          to: process.env.CONTACT_TO_EMAIL,
          subject: `New contact message from ${name}`,
          text: `From: ${name} <${email}>\n\n${message}\n\nMessage ID: ${doc._id}`,
          html: `<p><strong>From:</strong> ${name} &lt;${email}&gt;</p><p>${message.replace(/\n/g, "<br/>")}</p><p>Message ID: <code>${doc._id}</code></p>`,
        });
      } catch (e) {
        console.error("Email send failed:", e?.message || e);
        // Do not fail the request — the message is saved in DB
      }
    }

    return res.json({ ok: true, id: doc._id });
  } catch (err) {
    console.error("Contact submit error:", err);
    return res.status(500).json({ error: "Failed to submit message" });
  }
});

/* ---------- Admin: list messages (paginated) ---------- */
router.get("/", optionalAuth, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || "20", 10)));
    const status = req.query.status?.toString();

    const filter = status ? { status } : {};
    const [items, total] = await Promise.all([
      ContactMessage.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      ContactMessage.countDocuments(filter),
    ]);

    res.json({ items, total, page, pageSize, pages: Math.ceil(total / pageSize) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

/* ---------- Admin: update status ---------- */
router.patch("/:id/status", optionalAuth, requireAdmin, async (req, res) => {
  try {
    const next = String(req.body?.status || "").toLowerCase();
    const allowed = new Set(["new", "read", "resolved"]);
    if (!allowed.has(next)) return res.status(400).json({ error: "Invalid status" });

    const updates = { status: next };
    if (next === "read") updates.readAt = new Date();
    if (next === "resolved") updates.respondedAt = new Date();

    const doc = await ContactMessage.findByIdAndUpdate(req.params.id, updates, { new: true }).lean();
    if (!doc) return res.status(404).json({ error: "Message not found" });

    res.json({ message: "Status updated", doc });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update status" });
  }
});

export default router;
