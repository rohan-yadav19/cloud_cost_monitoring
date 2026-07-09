import dotenv from "dotenv";
import app from "./app.js";
import connectDB from "./config/db.js";

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`🚀 Server is running on Port ${PORT}`);
    console.log(`🌍 http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("❌ Failed to start server");
  console.error(error.message);
  process.exit(1);
});
