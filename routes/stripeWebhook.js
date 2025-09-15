// routes/stripeWebhook.js
import express from "express";
import stripe from "../lib/stripe.js";           // ✅ centralized Stripe client (uses STRIPE_SECRET_KEY)
import Order from "../models/Order.js";

const router = express.Router();
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Final URL: POST /api/stripe/webhook
router.post(
  "/webhook",
  // Keep raw body ONLY on this route so we can verify the Stripe signature
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
            // We may not have your internal productId here because we used price_data
            // in Checkout. If you later use Prices/Products, you can map via li.price?.product
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

      // (Optional) handle other events if you need them:
      // - checkout.session.async_payment_succeeded
      // - payment_intent.succeeded
      // - charge.refunded, etc.

      return res.status(200).json({ received: true });
    } catch (err) {
      console.error("❌ Webhook handler failed:", err?.message || err);
      // Always 200 to prevent Stripe retries from exploding logs; but you can 500 if you want retries.
      return res.status(200).json({ received: true, warning: "handler_error" });
    }
  }
);

export default router;
