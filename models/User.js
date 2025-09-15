import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String },
    username: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    role: { type: String, enum: ["admin", "customer"], default: "customer", index: true },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", userSchema);
