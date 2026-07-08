import dotenv from "dotenv";
import app from "./app.js";
import connectDB from "./config/db.js";

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

// Define Port
const PORT = process.env.PORT || 5000;

// Start Server
app.listen(PORT, () => {
  console.log("==================================");
  console.log(`🚀 Server is running on Port ${PORT}`);
  console.log(`🌍 http://localhost:${PORT}`);
  console.log("==================================");
});
