// seed.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "./models/Product.js";

dotenv.config();

/* ---------- sample data (keep/edit freely) ---------- */
const oils = [
  { name: "Lavendar Oil", price: 48, imageSrc: "/oil1.png", description: "Tall slender porcelain bottle with natural clay textured body and cork stopper.", category: "oil" },
  { name: "Batana Oil",   price: 35, imageSrc: "/oil2.png", description: "Olive drab green insulated bottle with flared screw lid and flat top.",       category: "oil" },
  { name: "Castor Oil",   price: 89, imageSrc: "/oil5.png", description: "Person using a pen to cross a task off a productivity paper card.",         category: "oil" },
  { name: "Rose Oil",     price: 35, imageSrc: "/oil4.png", description: "Hand holding black machined steel mechanical pencil with brass tip and top.", category: "oil" },
];

const soaps = [
  { name: "Orange Soap",  price: 48, imageSrc: "/soap1.png", description: "Tall slender porcelain bottle with natural clay textured body and cork stopper.", category: "soap" },
  { name: "Lime Soap",    price: 35, imageSrc: "/soap2.png", description: "Olive drab green insulated bottle with flared screw lid and flat top.",         category: "soap" },
  { name: "Citrus Soap",  price: 89, imageSrc: "/soap3.png", description: "Person using a pen to cross a task off a productivity paper card.",             category: "soap" },
  { name: "All Purpose",  price: 35, imageSrc: "/soap4.png", description: "Hand holding black machined steel mechanical pencil with brass tip and top.",   category: "soap" },
];

/* ---------- currency helpers (align with backend) ---------- */
const DEFAULT_CURRENCY = (process.env.DEFAULT_CURRENCY || "JPY").toUpperCase();
const CURRENCY_EXPONENT = { JPY: 0, USD: 2, EUR: 2, GBP: 2, UGX: 0 };
const getExponent = (cur) => CURRENCY_EXPONENT[cur] ?? 2;
const toMinor = (major, currency) => Math.round(Number(major) * 10 ** getExponent(currency));

/* ---------- main ---------- */
async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ Missing MONGODB_URI (or MONGO_URI) in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, { autoIndex: true });
    console.log("✅ Connected to MongoDB");

    const CLEAR_ALL = process.env.SEED_CLEAR_ALL === "1";
    if (CLEAR_ALL) {
      await Product.deleteMany({});
      console.log("🧹 Cleared existing products (SEED_CLEAR_ALL=1)");
    }

    const seedItems = [...oils, ...soaps];
    let created = 0;
    let updated = 0;

    for (const raw of seedItems) {
      const name = String(raw.name).trim();
      const category = String(raw.category);
      const imageSrc = raw.imageSrc ?? undefined;
      const description = raw.description ?? undefined;

      // price (major units) -> priceCents (minor units) using default currency
      const price = Number(raw.price);
      if (!Number.isFinite(price) || price < 0) {
        console.warn(`⚠️  Skipping "${name}" (${category}): invalid price "${raw.price}"`);
        continue;
      }
      const priceCents = toMinor(price, DEFAULT_CURRENCY);

      // Upsert by { name, category }
      const filter = { name, category };
      const update = {
        $set: { name, category, imageSrc, description, priceCents },
      };

      const result = await Product.updateOne(filter, update, { upsert: true });
      if (result.upsertedCount === 1) {
        created += 1;
        console.log(`➕ Created: ${name} (${category}) @ ${priceCents} [${DEFAULT_CURRENCY}]`);
      } else if (result.matchedCount === 1) {
        updated += 1;
        console.log(`♻️  Updated: ${name} (${category})`);
      } else {
        console.log(`ℹ️  No-op: ${name} (${category})`);
      }
    }

    console.log(`\n✅ Done. Created: ${created}, Updated: ${updated}`);
    console.log(`   Default currency: ${DEFAULT_CURRENCY}`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Seed error:", err?.message || err);
    process.exit(1);
  }
}

run();
