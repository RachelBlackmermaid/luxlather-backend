import express from "express";
import stripe from "../lib/stripe.js";          // ✅ centralized Stripe client (with key loaded)
import Product from "../models/Product.js";

const router = express.Router();

/* ---------- currency helpers (aligned with orderRoutes) ---------- */
const SUPPORTED_CURRENCIES = new Set(
  (process.env.SUPPORTED_CURRENCIES || "UGX,JPY,USD,EUR,KES,RWF,TZS")
    .split(",")
    .map((s) => s.trim().toUpperCase())
);
const DEFAULT_CURRENCY = (process.env.DEFAULT_CURRENCY || "USD").toUpperCase();
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
const toMinor = (major, currency) =>
  Math.round(Number(major) * 10 ** getExponent(currency));

/** Resolve product unit price in minor units for the chosen currency */
const getUnitAmountMinor = (product, currency) => {
  // Prefer per-currency map already in minor units
  if (product?.prices && typeof product.prices[currency] === "number") {
    return product.prices[currency];
  }
  // Legacy fallbacks
  if (typeof product.priceCents === "number") return product.priceCents; // assumes 2-dec base
  if (typeof product.price === "number") return toMinor(product.price, currency);
  throw new Error("No usable price on product for selected currency");
};

/* ---------- util: client base URL ---------- */
const CLIENT_BASE = (
  process.env.CLIENT_ORIGIN ||
  process.env.CLIENT_URI ||
  "http://localhost:5173"
).replace(/\/+$/, "");

/* ---------- POST handler ---------- */
async function createCheckoutSession(req, res) {
  try {
    const {
      items,                 // [{ productId, quantity }]
      currency: rawCurrency, // optional; default from env
      customer = {},         // { email?, name?, phone?, address? }
    } = req.body || {};

    // Validate input
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "At least one item is required" });
    }
    const currency = (rawCurrency || DEFAULT_CURRENCY).toUpperCase();
    if (!SUPPORTED_CURRENCIES.has(currency)) {
      return res.status(400).json({ error: `Unsupported currency: ${currency}` });
    }

    const productIds = items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds } })
      .select("_id name imageSrc price priceCents prices")
      .lean();

    if (products.length !== items.length) {
      return res
        .status(400)
        .json({ error: "One or more items refer to missing products" });
    }

    const map = new Map(products.map((p) => [String(p._id), p]));
    const line_items = items.map((it) => {
      const p = map.get(String(it.productId));
      if (!p) throw new Error("Product not found");

      const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
      const unitMinor = getUnitAmountMinor(p, currency);

      return {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: p.name,
            ...(p.imageSrc?.startsWith("http") ? { images: [p.imageSrc] } : {}),
          },
          unit_amount: unitMinor, // integer minor units (JPY/UGX/RWF: whole; USD/EUR/KES/TZS: cents)
        },
        quantity: qty,
      };
    });

    // Optional: shipping address countries
    const allowedCountriesRaw = process.env.ALLOWED_SHIP_COUNTRIES;
    const shipping_address_collection = allowedCountriesRaw
      ? {
          allowed_countries: allowedCountriesRaw
            .split(",")
            .map((c) => c.trim().toUpperCase())
            .filter(Boolean),
        }
      : undefined;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      customer_email: customer.email || undefined,
      success_url: `${CLIENT_BASE}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CLIENT_BASE}/checkout`,
      allow_promotion_codes: true,
      phone_number_collection: { enabled: true },
      ...(shipping_address_collection ? { shipping_address_collection } : {}),
      metadata: {
        name: customer.name || "",
        phone: customer.phone || "",
        address: customer.address || "",
      },
    });

    return res.json({ id: session.id, url: session.url });
  } catch (err) {
    console.error("Stripe session error:", err?.message || err);
    return res.status(500).json({ error: "Failed to create checkout session" });
  }
}

/* ---------- routes (support both paths) ---------- */
router.post("/session", createCheckoutSession);
router.post("/create-session", createCheckoutSession); // backward compatible

export default router;
