import mongoose from "mongoose";

mongoose.set("strictQuery", true);
if (process.env.MONGOOSE_DEBUG === "true") {
  mongoose.set("debug", true);
}

let cached = global.__mongooseConn;
if (!cached) cached = global.__mongooseConn = { conn: null, promise: null };

export default async function connectDB() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("Missing MONGODB_URI in .env");

  if (cached.conn) return cached.conn; // reuse existing connection

  const isProd = process.env.NODE_ENV === "production";
  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      autoIndex: !isProd,           // build indexes in dev, skip in prod for perf
      // You can add timeouts if you want:
      // serverSelectionTimeoutMS: 15000,
      // socketTimeoutMS: 45000,
    }).then((mongooseInstance) => {
      const { host, port, name } = mongooseInstance.connection;
      console.log(`✅ MongoDB connected: ${host}:${port}/${name}`);
      return mongooseInstance;
    });
  }

  cached.conn = await cached.promise;

  // Attach once
  if (!global.__mongooseEventsBound) {
    global.__mongooseEventsBound = true;
    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB error:", err.message);
    });
    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      console.log("👋 MongoDB disconnected (SIGINT)");
      process.exit(0);
    });
  }

  return cached.conn;
}
