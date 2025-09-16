import express from "express";
import jwt from "jsonwebtoken";
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";

const router = express.Router();

/* ---------- Auth helpers (cookie or Bearer) ---------- */
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
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  next();
}

/* ---------- Public (read) ---------- */
router.get("/", getProducts);
router.get("/:id", getProduct);

/* ---------- Admin (write) ---------- */
router.post("/", optionalAuth, requireAdmin, createProduct);
router.patch("/:id", optionalAuth, requireAdmin, updateProduct);
router.delete("/:id", optionalAuth, requireAdmin, deleteProduct);

export default router;
