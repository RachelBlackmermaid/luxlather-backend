import * as productService from "../services/productService.js";

// export const getProducts = async (req, res) => {
//   try {
//     const products = await productService.getAllProducts();
//     res.status(200).json(products);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

//get products by category 
export const getProducts = async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category ? { category } : {};
    const products = await productService.getAllProducts(filter);

    res.status(200).json(products);
    
  } catch (err) {
    res.status(500).json({message: err.message });
    
  }
}

export const getProduct = async (req, res) => {
  try {
    const product = await productService.getProductById(req.params.id);
    if (!product)
      return res.status(404).json({ message: "Product not found!" });
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: err.message });
  }
};

export const createProduct = async (req, res) => {
    try {
        const newProduct = await productService.createProduct(req.body);
    res.status(201).json(newProduct);
    } catch (err) {
        res.status(500).json({ message: err.message });
        
    }
};

export const updateProduct = async (req, res) => {
  try {
    const product = await productService.updateProduct(req.params.id, req.body);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.status(200).json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const product = await productService.deleteProduct(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.status(200).json({ message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
