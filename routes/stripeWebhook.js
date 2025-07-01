import express from "express";
import Stripe from "stripe";
import Order from "../models/Order.js"; // ✅ Import Mongoose model

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error("❌ Webhook signature verification failed", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    try {
      await Order.create({
        name: session.metadata.name,
        email: session.customer_email,
        phone: session.metadata.phone,
        address: session.metadata.address,
        total: session.amount_total / 100,
        currency: session.currency,
      });

      console.log("✅ Order saved to MongoDB via Mongoose");
    } catch (err) {
      console.error("❌ Failed to save order:", err.message);
    }
  }

  res.status(200).json({ received: true });
});

export default router;
