import mongoose from "mongoose";

let connectPromise: Promise<typeof mongoose> | null = null;

export async function connectMongoose() {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!connectPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error(
        "MONGODB_URI is not set. Add it to .env (see .env.example) before starting the server."
      );
    }
    connectPromise = mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
    });
  }
  return connectPromise;
}
