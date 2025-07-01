import express from "express";
import Order from "../models/Order.js";
const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { name, email, phone, address, items, total } = req.body;

        //basic validation
        if (! name || !email || !phone || !address || !items?.length || !total) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const newOrder = await Order.create({
            name, email, phone, address, items, total,
        });

        res.status(201).json({ message: "Order placed", orderId: newOrder._id });
    } catch (error) {
        console.error("Order save error:", error);
        res.status(500).json({error: "Failed to save order" });
        
    }
});

export default router;