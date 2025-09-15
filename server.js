// server/server.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import connectDB from "./db/connect.js";

import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import checkoutRoutes from "./routes/checkoutRoutes.js";
import stripeWebhook from "./routes/stripeWebhook.js";
import uploadRoute from "./routes/uploadRoute.js";
import authRoutes from "./routes/auth.js";
import contactRoutes from "./routes/contactRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5050;

app.set("trust proxy", 1);

/* --------------------------- CORS (credentials) --------------------------- */
const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "https://luxlather.vercel.app", // your Vercel production domain (adjust if different)
  "https://luxlather.store",      // your custom domain (if used)
];

const ORIGINS = (
  process.env.CLIENT_ORIGINS ||
  process.env.CLIENT_ORIGIN ||
  DEFAULT_ORIGINS.join(",")
)
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);

// Allow all Vercel preview URLs like https://<branch>-<proj>.vercel.app
const VERCEL_PREVIEW = /\.vercel\.app$/i;

const corsOptions = {
  credentials: true,
  origin(origin, cb) {
    if (!origin) return cb(null, true); // curl/server-to-server/no-Origin
    const clean = origin.replace(/\/+$/, "");
    if (ORIGINS.includes(clean) || VERCEL_PREVIEW.test(clean)) return cb(null, true);
    console.warn("[CORS] Blocked origin:", origin);
    // don't throw → avoids Express 500s; browser will block due to missing ACAO
    return cb(null, false);
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
// ❌ remove app.options("*", ...) or "(.*)" to avoid path-to-regexp errors

/* ------------------- Stripe webhook BEFORE body parsers ------------------- */
app.use("/api/stripe", stripeWebhook);

/* --------------------------- Body/Cookie parsers -------------------------- */
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* --------------------------------- Routes -------------------------------- */
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/upload", uploadRoute);
app.use("/api/contact", contactRoutes);

/* ------------------------------- Healthcheck ------------------------------ */
app.get("/health", (_req, res) => res.json({ ok: true }));

/* ---------------------------------- 404s ---------------------------------- */
app.use((req, res) => res.status(404).json({ error: "Not found", path: req.path, query: req.query }));

/* --------------------------- Central error handler ------------------------ */
app.use((err, req, res, _next) => {
  const msg = err?.message || "Server error";
  const status = /not allowed by cors/i.test(msg) ? 403 : 500;
  console.error("[ERROR]", msg);
  res.status(status).json({ error: msg });
});

/* ------------------------- Start after DB connects ------------------------ */
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`[CORS] Allowed origins: ${ORIGINS.join(", ")}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to connect DB:", err?.message || err);
    process.exit(1);
  });

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
