import mongoose from "mongoose";

const connectDB = async () => {
  const uri =
    process.env.MONGO_URI || "mongodb://127.0.0.1:27017/cloud";

  try {
    const conn = await mongoose.connect(uri);

    console.log("✅ MongoDB Connected");
    console.log(`📦 Database: ${conn.connection.name}`);
    console.log(`🌐 Host: ${conn.connection.host}`);
  } catch (error) {
    console.error("❌ MongoDB Connection Failed");
    console.error(error.message);
    process.exit(1);
  }
};

export default connectDB;
