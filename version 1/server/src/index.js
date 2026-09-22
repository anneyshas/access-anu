import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import apiRoutes from "./routes/index.js";   // ← add this line

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", apiRoutes);   // ← add this line

async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`AccessANU API listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
}

start();