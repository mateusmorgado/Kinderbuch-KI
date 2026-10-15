const express = require("express");
const bcrypt = require("bcryptjs");
const { logger } = require("../middleware/logging");
const User = require("../models/User");
const { getDbStatus } = require("../config/db");
const { authLimiter } = require("../middleware/rateLimit");
const { issueAccessToken } = require("../services/tokens");
const router = express.Router();

// Public health endpoint for the experiment deployment.
router.get("/", (req, res) => {
  res.json({ status: "ok", service: "kinderbuch-backend", db: getDbStatus() });
});

// Login Route
router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Check if username and password are provided
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required." });
    }

    // Sanitize username
    const sanitizedUsername = String(username).trim().toLowerCase();

    // Find user
    const user = await User.findOne({ username: sanitizedUsername }).lean();
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(String(password), user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const accessToken = issueAccessToken(user);
    logger.info(`User ${user.username} logged in`);

    res.json({
      accessToken,
      displayName: user.displayName,
      username: user.username,
      id: user._id,
    });
  } catch (error) {
    console.error("Error in login route:", error.stack);
    next(error);
  }
});

module.exports = router;
