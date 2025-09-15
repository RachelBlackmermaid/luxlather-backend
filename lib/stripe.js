import "dotenv/config";           // preload .env BEFORE reading process.env
import Stripe from "stripe";


const apiKey = process.env.STRIPE_SECRET_KEY;
if (!apiKey) {
  throw new Error("STRIPE_SECRET_KEY is missing. Add it to your backend .env / Render env.");
}

const stripe = new Stripe(apiKey, {
  apiVersion: "2023-10-16",
  // telemetry: false, // optional
});

export default stripe;
