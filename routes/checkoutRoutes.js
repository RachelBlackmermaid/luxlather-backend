import express from "express";
import dotenv from "dotenv";
dotenv.config();


import Stripe from "stripe";

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16",});

router.post("/create-session", async (req, res) => {
    try {
        const { items, customer } = req.body;

        const line_items = items.map((item) => ({
          price_data: {
            currency: "jpy",
            product_data: {
              name: item.name,
              ...(item.imageSrc?.startsWith("http") && {
                images: [item.imageSrc],
              }),
            },
            unit_amount: item.price * 100,
          },
          quantity: item.quantity,
        }));
        

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items,
            mode: "payment",
            success_url: `${process.env.CLIENT_URL}/success`,
            cancel_url: `${process.env.CLIENT_URL}/checkout`,
            customer_email: customer.email,
            metadata: {
              name: customer.name,
              phone: customer.phone,
              address: customer.address,
            },
          });
      
          res.json({ url: session.url });


    } catch (err) {
        console.error(err);
    res.status(500).json({ message: "Stripe session creation failed" });
  }
        
    
});

export default router;

