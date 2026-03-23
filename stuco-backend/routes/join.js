import express from "express";
import Join from "stuco-backend/models/Join.js";

const router = express.Router();

/* POST: new signup */
router.post("/", async (req, res) => {
  try {
    const submission = new Join(req.body);
    await submission.save();

    res.status(201).json({
      success: true,
      message: "Signup saved"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

export default router;
