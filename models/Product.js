import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    imageSrc: { type: String },
    description: { type: String },
    category: { type: String, enum: ["soap", "oil"], required: true },

    // Canonical unit amount in minor units (e.g., cents for USD, yen for JPY)
    priceCents: { type: Number, required: true, min: 0 },

    // Optional multi-currency support: store per-ISO code minor units
    // Example: { JPY: 1200, USD: 799 }
    prices: { type: Map, of: Number, default: undefined },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  }
);

// Backward-friendly virtual: lets you read/write "price" in major units
productSchema.virtual("price")
  .get(function () {
   
    return typeof this.priceCents === "number" ? this.priceCents / 100 : undefined;
  })
  .set(function (v) {
    const num = Number(v);
    if (Number.isFinite(num)) this.priceCents = Math.round(num * 100);
  });


productSchema.index({ category: 1, name: 1 });

const Product = mongoose.models.Product || mongoose.model("Product", productSchema);
export default Product;
