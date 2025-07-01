import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    }, 
    imageSrc: String,
    description: String,
    price: {
        type: Number, 
        required: true,
        min: 0,
    },
    category: {
        type: String,
        enum: ['soap', 'oil'],required: true
    }
});

const Product = mongoose.model("Product", productSchema);

export default Product;