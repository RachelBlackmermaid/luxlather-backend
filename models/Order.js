import mongoose from "mongoose";

const LineItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true, trim: true },
    imageSrc: { type: String },
    priceCents: { type: Number, required: true, min: 0 },   // unit price in cents
    quantity: { type: Number, required: true, min: 1 },
    lineTotalCents: { type: Number, required: true, min: 0 } // priceCents * quantity
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    // who placed it (null = guest)
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },

    // customer details
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    phone: { type: String, default: null, trim: true },
    address: { type: String, required: true, trim: true },

    // items & money
    currency: { type: String, required: true, uppercase: true },
    items: { type: [LineItemSchema], default: [] },

    totalCents: { type: Number, min: 0 }, // canonical
    total: { type: Number, min: 0 },      

    // order lifecycle / payments
    status: {
      type: String,
      enum: ["pending", "paid", "fulfilled", "cancelled", "refunded"],
      default: "pending",
      index: true
    },
    stripeSessionId: { type: String, index: true, sparse: true }, // for webhook idempotency
    paymentIntentId: { type: String, index: true, sparse: true },
    chargeId: { type: String, index: true, sparse: true },

    // anything extra you want to stash
    metadata: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: true }
);

// Keep totalCents/total in sync & compute from items when available
OrderSchema.pre("save", function (next) {
  // If items exist, prefer computing from line totals
  if (Array.isArray(this.items) && this.items.length > 0) {
    const sum = this.items.reduce((acc, it) => acc + (it.lineTotalCents || 0), 0);
    this.totalCents = sum;
    this.total = sum / 100;
  } else {
    if (typeof this.totalCents !== "number" && typeof this.total === "number") {
      this.totalCents = Math.round(this.total * 100);
    }
    if (typeof this.total !== "number" && typeof this.totalCents === "number") {
      this.total = this.totalCents / 100;
    }
  }
  next();
});

OrderSchema.index({ userId: 1, createdAt: -1 });

OrderSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  }
});

const Order = mongoose.models.Order || mongoose.model("Order", OrderSchema);
export default Order;
