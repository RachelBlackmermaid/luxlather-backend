import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./db/connect.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import checkoutRoutes from "./routes/checkoutRoutes.js";
import bodyParser from "body-parser";
import stripeWebhook from "./routes/stripeWebhook.js";
import uploadRoute from "./routes/uploadRoute.js";
import authRoutes from "./routes/auth.js";



dotenv.config();
connectDB();

const app = express();
app.use(cors());
// Stripe needs raw body for signature verification
app.use(express.json()); //for other routes

app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/stripe/webhook", stripeWebhook);
app.use("/api/upload",uploadRoute);
app.use("/api/auth", authRoutes);



const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});