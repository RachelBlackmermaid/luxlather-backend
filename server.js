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

// behind proxy (Vercel/Render/Fly/NGINX) so secure cookies work
app.set("trust proxy", 1);

// CORS (allow cookies to frontend)

const ORIGINS = (process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, "")) // strip spaces + trailing slashes
  .filter(Boolean);

// Optional: allow Vercel preview apps too
const VERCEL_PREVIEW = /\.vercel\.app$/i;

const corsOptions = {
  credentials: true,
  origin(origin, callback) {
    // Non-browser (Postman, server-to-server like Stripe) -> allow
    if (!origin) return callback(null, true);

    const clean = origin.replace(/\/+$/, "");
    if (ORIGINS.includes(clean) || VERCEL_PREVIEW.test(clean)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
};

app.use(cors(corsOptions));



/**
 * Stripe webhook MUST be mounted BEFORE express.json()
 * stripeWebhook router exposes POST /webhook
 * Final URL => POST /api/stripe/webhook
 */
app.use("/api/stripe", stripeWebhook);

// Parsers for the rest of the routes
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/upload", uploadRoute);
app.use("/api/contact", contactRoutes);


// Healthcheck
app.get("/health", (_req, res) => res.json({ ok: true }));

// 404
app.use((req, res) => res.status(404).json({ error: "Not found" }));

// Central error handler
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

// Start only after DB connects
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to connect DB:", err?.message || err);
    process.exit(1);
  });

// Optional: log unhandled rejections so they don't fail silently
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
