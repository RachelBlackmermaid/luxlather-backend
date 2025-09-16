import express from "express";
import stripe from "../lib/stripe.js";           //centralized Stripe client (uses STRIPE_SECRET_KEY)
import Order from "../models/Order.js";

const router = express.Router();
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// POST /api/stripe/webhook
router.post(
  "/webhook",

  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!endpointSecret) {
      console.error("❌ Missing STRIPE_WEBHOOK_SECRET");
      return res.status(500).send("Webhook misconfigured");
    }

    const sig = req.headers["stripe-signature"];
    let event;

    try {
      // req.body is a Buffer because of express.raw()
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        // Retrieve full session w/ line items for persistence
        const full = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ["line_items"],
        });

        const currency = (full.currency || session.currency || "").toUpperCase();
        const amountTotal = full.amount_total ?? session.amount_total ?? 0;

        // Normalize items from line_items (fallbacks included)
        const items = (full.line_items?.data || []).map((li) => {
          // Prefer price.unit_amount (minor units), else derive from totals
          const unitMinor =
            li.price?.unit_amount ??
            (li.amount_total && li.quantity ? Math.round(li.amount_total / li.quantity) : null) ??
            (li.amount_subtotal && li.quantity ? Math.round(li.amount_subtotal / li.quantity) : 0);

          return {
            name: li.description || li.price?.nickname || li.price?.id || "Item",
            quantity: li.quantity || 1,
            priceCents: unitMinor ?? 0,
            lineTotalCents: li.amount_total ?? li.amount_subtotal ?? (unitMinor || 0) * (li.quantity || 1),
          };
        });

        // Upsert by stripeSessionId to avoid duplicates on retries
        const status = full.payment_status === "paid" ? "paid" : "pending";

        await Order.findOneAndUpdate(
          { stripeSessionId: session.id },
          {
            name: full.metadata?.name || "",
            email: full.customer_details?.email || full.customer_email || "",
            phone: full.metadata?.phone || full.customer_details?.phone || "",
            address: full.metadata?.address || "",
            currency,
            items,
            totalCents: amountTotal,
            total: amountTotal / 100,
            stripeSessionId: session.id,
            status,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        console.log("✅ Order saved/updated from Stripe webhook:", session.id);
      }

      return res.status(200).json({ received: true });
    } catch (err) {
      console.error("❌ Webhook handler failed:", err?.message || err);
      return res.status(200).json({ received: true, warning: "handler_error" });
    }
  }
);

export default router;
