import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema({
    name: {type: String, required: true},
    email: {type: String, required: true},
    phone: {type: String, required: true},
    address: {type: String, required: true},
    items: [
        {
            _id: { type: String, required: true},
            name: String,
            price: Number,
            imageSrc: String,
            quantity: Number,

        },
    ],
    total: { type: String, required: true }, // formatted e.g., "¥3,000"
  },
  { timestamps: true }
);

const Order = mongoose.models.Order || mongoose.model("Order", OrderSchema);

export default Order;