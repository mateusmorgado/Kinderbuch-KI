const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { logger } = require("../middleware/logging");
const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");
const router = express.Router();

// Public health endpoint for the experiment deployment.
router.get("/", (req, res) => {
  res.json({ status: "ok", service: "kinderbuch-backend" });
});

// Login Route
router.post("/login", async (req, res, next) => {
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

    // Generate JWT tokens
    const payload = { id: user._id, name: user.displayName, username: user.username };
    const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "5d",
    });
    const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
      expiresIn: "7d",
    });

    await RefreshToken.create({ token: refreshToken, userId: user._id });

    logger.info(`User ${user.displayName} logged in`);

    // Set secure cookies with the refresh token and basic user data
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    };
    res.cookie("refreshToken", refreshToken, cookieOptions);
    res.cookie(
      "auth",
      JSON.stringify({
        username: user.username,
        displayName: user.displayName,
        id: user._id,
      }),
      cookieOptions,
    );

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

// Logout Route
router.post("/logout", async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken)
      return res.status(400).json({ error: "No refresh token found" });

    // Delete refresh token from database
    const deleted = await RefreshToken.deleteOne({ token: refreshToken });
    if (deleted.deletedCount === 0) {
      return res
        .status(400)
        .json({ error: "Refresh token not found in database" });
    }

    // Clear refresh token cookie
    res.clearCookie("refreshToken", { path: "/" });
    res.clearCookie("auth", { path: "/" });
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
});

// Refresh Token Route
router.post("/refresh-token", async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken)
      return res.status(401).json({ error: "No refresh token provided" });

    // Check if token exists in the database
    const existingToken = await RefreshToken.findOne({ token: refreshToken });
    if (!existingToken)
      return res.status(403).json({ error: "Invalid refresh token" });

    // Verify refresh token
    jwt.verify(refreshToken, REFRESH_SECRET, async (err, decoded) => {
      if (err) {
        await RefreshToken.deleteOne({ token: refreshToken }); // Remove expired token
        return res
          .status(403)
          .json({ error: "Invalid or expired refresh token" });
      }

      // Generate new access token
      const newAccessToken = jwt.sign(
        { id: decoded.id, name: decoded.name },
        ACCESS_SECRET,
        { expiresIn: "15m" },
      );

      res.json({ accessToken: newAccessToken });
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
