// services/productService.js
import Product from "../models/Product.js";

/**
 * Get products with optional pagination/sorting.
 * By default returns a plain array (no pagination object) to match current controllers.
 *
 * options = {
 *   page?: number,         // 1-based
 *   pageSize?: number,     // default 20
 *   sort?: string|object,  // e.g. "-createdAt" or { createdAt: -1 }
 *   select?: string,       // e.g. "name imageSrc priceCents"
 *   paginate?: boolean,    // if true, returns { items, total, page, pageSize, pages }
 * }
 */
export const getAllProducts = async (filter = {}, options = {}) => {
  const {
    page = 1,
    pageSize = 20,
    sort = "-createdAt",
    select,
    paginate = false,
  } = options;

  const query = Product.find(filter).sort(sort).select(select);

  if (paginate) {
    const [items, total] = await Promise.all([
      query
        .skip((Math.max(1, page) - 1) * pageSize)
        .limit(pageSize)
        .lean({ virtuals: true }),
      Product.countDocuments(filter),
    ]);
    return {
      items,
      total,
      page: Math.max(1, page),
      pageSize,
      pages: Math.ceil(total / pageSize) || 1,
    };
  }

  // Non-paginated (current controller behavior)
  return query.lean({ virtuals: true });
};

export const getProductById = (id) =>
  Product.findById(id).lean({ virtuals: true });

export const createProduct = (data) => Product.create(data);

export const updateProduct = (id, updates) =>
  Product.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  }).lean({ virtuals: true });

export const deleteProduct = (id) => Product.findByIdAndDelete(id);
