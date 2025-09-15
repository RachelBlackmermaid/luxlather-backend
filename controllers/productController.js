// controllers/productController.js
import * as productService from "../services/productService.js";

const ALLOWED_CATEGORIES = new Set(["soap", "oil"]);
const ALLOWED_SORT_FIELDS = new Set(["createdAt", "priceCents", "name"]);

// Convert ?sort=-createdAt or ?sort=priceCents to a safe sort object
function sanitizeSort(sortParam) {
  const s = String(sortParam || "").trim();
  if (!s) return { createdAt: -1 }; // default newest first

  let dir = 1;
  let field = s;

  if (s.startsWith("-")) {
    dir = -1;
    field = s.slice(1);
  }

  if (!ALLOWED_SORT_FIELDS.has(field)) {
    return { createdAt: -1 };
  }
  return { [field]: dir };
}

// GET /api/products?category=soap|oil&page=1&pageSize=12&sort=-createdAt
export const getProducts = async (req, res) => {
  try {
    const { category, page = "1", pageSize = "12", sort = "-createdAt" } = req.query;

    const filter = category ? { category } : {};
    const safeSort = sanitizeSort(sort);

    const result = await productService.getAllProducts(filter, {
      page: Math.max(1, parseInt(page, 10) || 1),
      pageSize: Math.min(50, Math.max(1, parseInt(pageSize, 10) || 12)),
      sort: safeSort,
      paginate: true,
    });

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ message: err?.message || "Failed to fetch products" });
  }
};

export const getProduct = async (req, res) => {
  try {
    const product = await productService.getProductById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found!" });
    res.status(200).json(product);
  } catch (err) {
    res.status(500).json({ message: err?.message || "Failed to fetch product" });
  }
};

export const createProduct = async (req, res) => {
  try {
    const {
      name,
      imageSrc,
      description,
      category,
      price,      // major units (optional)
      priceCents, // minor units (optional)
      prices,     // optional map: { JPY: 1200, USD: 799 }
    } = req.body || {};

    if (!name || !category) {
      return res.status(400).json({ message: "Name and category are required" });
    }
    if (!ALLOWED_CATEGORIES.has(String(category))) {
      return res.status(400).json({ message: "Invalid category" });
    }

    const hasAnyPrice =
      price !== undefined || priceCents !== undefined || (prices && Object.keys(prices).length > 0);
    if (!hasAnyPrice) {
      return res.status(400).json({ message: "Provide price, priceCents, or per-currency prices" });
    }

    if (price !== undefined) {
      const p = Number(price);
      if (!Number.isFinite(p) || p < 0) return res.status(400).json({ message: "price must be a non-negative number" });
    }
    if (priceCents !== undefined) {
      const pc = Number(priceCents);
      if (!Number.isInteger(pc) || pc < 0)
        return res.status(400).json({ message: "priceCents must be a non-negative integer" });
    }
    if (prices) {
      for (const [k, v] of Object.entries(prices)) {
        const val = Number(v);
        if (!Number.isInteger(val) || val < 0)
          return res.status(400).json({ message: `prices.${k} must be a non-negative integer (minor units)` });
      }
    }

    const newProduct = await productService.createProduct({
      name: String(name).trim(),
      imageSrc,
      description,
      category: String(category),
      price,      // Product model virtual maps this to priceCents
      priceCents,
      prices,
    });

    res.status(201).json(newProduct);
  } catch (err) {
    res.status(500).json({ message: err?.message || "Failed to create product" });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const updates = {};
    const body = req.body || {};

    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.imageSrc !== undefined) updates.imageSrc = body.imageSrc;
    if (body.description !== undefined) updates.description = body.description;

    if (body.category !== undefined) {
      if (!ALLOWED_CATEGORIES.has(String(body.category))) {
        return res.status(400).json({ message: "Invalid category" });
      }
      updates.category = String(body.category);
    }

    if (body.price !== undefined) {
      const p = Number(body.price);
      if (!Number.isFinite(p) || p < 0) return res.status(400).json({ message: "price must be a non-negative number" });
      updates.price = p; // virtual -> priceCents
    }

    if (body.priceCents !== undefined) {
      const pc = Number(body.priceCents);
      if (!Number.isInteger(pc) || pc < 0)
        return res.status(400).json({ message: "priceCents must be a non-negative integer" });
      updates.priceCents = pc;
    }

    if (body.prices !== undefined) {
      if (body.prices && typeof body.prices === "object") {
        const cleaned = {};
        for (const [k, v] of Object.entries(body.prices)) {
          const val = Number(v);
          if (!Number.isInteger(val) || val < 0)
            return res.status(400).json({ message: `prices.${k} must be a non-negative integer (minor units)` });
          cleaned[String(k).toUpperCase()] = val; // store ISO code uppercase
        }
        updates.prices = cleaned;
      } else {
        updates.prices = undefined;
      }
    }

    const product = await productService.updateProduct(req.params.id, updates);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.status(200).json(product);
  } catch (err) {
    res.status(500).json({ message: err?.message || "Failed to update product" });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const product = await productService.deleteProduct(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.status(200).json({ message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err?.message || "Failed to delete product" });
  }
};
