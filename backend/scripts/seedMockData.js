import dotenv from "dotenv";
import connectDB from "../config/db.js";
import { seedMockData } from "../services/mockDataService.js";

dotenv.config();

async function runSeed() {
  try {
    await connectDB();
    const result = await seedMockData({ force: true });
    console.log("✅ Mock AWS data seeded");
    console.log(result);
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed");
    console.error(error.message);
    process.exit(1);
  }
}

runSeed();
