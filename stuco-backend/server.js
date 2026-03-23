import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import joinRoutes from "./routes/join.js";
import bookSessionRoute from "./routes/bookSession.js";

dotenv.config();

const app = express();

/* Middleware */
app.use(cors());
app.use(express.json());

/* MongoDB */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

/* Routes */
app.use("/api/join", joinRoutes);
app.use("/api/book-session", bookSessionRoute);

app.get("/", (req, res) => {
  res.send("Student Learning Hub API is running");
});

/* Start server */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
