import express from "express";
import jwt from "jsonwebtoken";
import Order from "../models/Order.js";
import Product from "../models/Product.js";

const router = express.Router();

/* ---------- Auth helpers ---------- */
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
function requireAuth(req, res, next) {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  next();
}
function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  next();
}

/* ---------- Utilities ---------- */
const isEmail = (e) => typeof e === "string" && /^\S+@\S+\.\S+$/.test(e);
const toInt = (n) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.trunc(v) : NaN;
};

/* ---------- Currency config ---------- */
const SUPPORTED_CURRENCIES = new Set(
  (process.env.SUPPORTED_CURRENCIES || "JPY,USD,EUR").split(",").map(s => s.trim().toUpperCase())
);
const DEFAULT_CURRENCY = (process.env.DEFAULT_CURRENCY || "JPY").toUpperCase();
// ISO 4217 minor-unit exponents
const CURRENCY_EXPONENT = {
  UGX: 0,
  JPY: 0,
  USD: 2,
  EUR: 2,
  GBP: 2,
  KES: 2, // Kenya
  RWF: 0, // Rwanda
  TZS: 2, // Tanzania
};
const getExponent = (cur) => CURRENCY_EXPONENT[cur] ?? 2;
const toMinor = (major, currency) => {
  const exp = getExponent(currency);
  return Math.round(Number(major) * 10 ** exp);
};

const getUnitAmountMinor = (product, currency) => {
  if (product?.prices && typeof product.prices[currency] === "number") {
    return product.prices[currency]; 
  }
  if (typeof product.priceCents === "number") return product.priceCents; // legacy cents
  if (typeof product.price === "number") return toMinor(product.price, currency);
  throw new Error("No usable price on product for selected currency");
};

router.post("/", optionalAuth, async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      address,
      items,
      currency: rawCurrency,
      stripeSessionId,
    } = req.body || {};

    const currency = (rawCurrency || DEFAULT_CURRENCY).toUpperCase();
    if (!SUPPORTED_CURRENCIES.has(currency)) {
      return res.status(400).json({ error: `Unsupported currency: ${currency}` });
    }

    if (!name || !isEmail(email) || !address) {
      return res.status(400).json({ error: "Name, valid email, and address are required" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "At least one item is required" });
    }
    for (const it of items) {
      if (!it?.productId) return res.status(400).json({ error: "Each item must include productId" });
      const q = toInt(it.quantity);
      if (!Number.isFinite(q) || q <= 0) {
        return res.status(400).json({ error: "Each item must have a positive integer quantity" });
      }
    }

    if (stripeSessionId) {
      const existing = await Order.findOne({ stripeSessionId }).select("_id");
      if (existing) return res.status(200).json({ message: "Order already exists", orderId: existing._id });
    }

    const productIds = items.map(i => i.productId);
    const products = await Product.find({ _id: { $in: productIds } })
      .select("_id name imageSrc price priceCents prices")
      .lean();

    if (products.length !== items.length) {
      return res.status(400).json({ error: "One or more items refer to missing products" });
    }

    const map = new Map(products.map(p => [String(p._id), p]));
    let totalMinor = 0;

    const normalizedItems = items.map(it => {
      const p = map.get(String(it.productId));
      if (!p) throw new Error("Product not found");
      const quantity = toInt(it.quantity);
      const unitAmountMinor = getUnitAmountMinor(p, currency);
      const lineTotalMinor = unitAmountMinor * quantity;
      totalMinor += lineTotalMinor;
      return {
        productId: p._id,
        name: p.name,
        imageSrc: p.imageSrc,
        priceCents: unitAmountMinor,     // "cents" = minor units
        quantity,
        lineTotalCents: lineTotalMinor,  // minor units
      };
    });

    const newOrder = await Order.create({
      userId: req.user?.id || null,
      name,
      email,
      phone: phone || null,
      address,
      currency,
      items: normalizedItems,
      totalCents: totalMinor,
      total: totalMinor / 10 ** getExponent(currency),
      stripeSessionId: stripeSessionId || null,
      status: "pending",
    });

    return res.status(201).json({
      message: "Order placed",
      orderId: newOrder._id,
      total: newOrder.total,
      currency: newOrder.currency,
    });
  } catch (error) {
    console.error("Order creation error:", error);
    return res.status(500).json({ error: "Failed to create order" });
  }
});

/* ---------- My orders (auth) ---------- */
router.get("/mine", optionalAuth, requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize || "10", 10)));

    const [orders, count] = await Promise.all([
      Order.find({ userId: req.user.id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      Order.countDocuments({ userId: req.user.id }),
    ]);

    res.json({
      page,
      pageSize,
      total: count,
      pages: Math.ceil(count / pageSize),
      orders,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

/* ---------- Read order (owner or admin) ---------- */
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ error: "Order not found" });

    const isOwner = req.user?.id && String(order.userId) === String(req.user.id);
    const isAdmin = req.user?.role === "admin";
    if (!isOwner && !isAdmin) return res.status(403).json({ error: "Forbidden" });

    res.json(order);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

router.patch("/:id/status", optionalAuth, requireAdmin, async (req, res) => {
  try {
    const allowed = new Set(["pending", "paid", "fulfilled", "cancelled", "refunded"]);
    const nextStatus = String(req.body?.status || "").toLowerCase();
    if (!allowed.has(nextStatus)) return res.status(400).json({ error: "Invalid status value" });

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: nextStatus },
      { new: true }
    ).lean();

    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json({ message: "Status updated", order });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update status" });
  }
});

// GET /api/orders (admin-only): list orders, paginated
router.get("/", optionalAuth, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || "20", 10)));

    const [items, total] = await Promise.all([
      Order.find({})
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      Order.countDocuments({}),
    ]);

    res.json({ items, total, page, pageSize, pages: Math.ceil(total / pageSize) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});


export default router;
