import Product from "../models/Product.js";

export const getAllProducts = (filter = {}) => Product.find(filter);
// export const getProductsByCategory = (category) => Product.find({ category: category.toLowerCase() });
export const getProductById = (id) => Product.findById(id);
export const createProduct = (data) => Product.create(data);
export const updateProduct = (id, updates) => Product.findByIdAndUpdate(id, updates, { new: true});
export const deleteProduct = (id) => Product.findByIdAndDelete(id);