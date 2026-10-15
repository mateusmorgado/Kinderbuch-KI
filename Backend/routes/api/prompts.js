const Prompt = require("../../models/Prompt");
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const authMiddleware = require("../../middleware/authMiddleware");
const { logger } = require("../../middleware/logging");

// GET all prompts
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const prompts = await Prompt.find();
    logger.info(`Fetched all prompts - Count: ${prompts.length}`);
    res.status(200).json(prompts);
  } catch (error) {
    next(error);
  }
});

// GET a single prompt by ID
router.get("/:id", authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    const prompt = await Prompt.findById(id);
    if (!prompt) {
      logger.warn(`Prompt with ID ${id} not found`);
      return res.status(404).json({ message: "Prompt not found" });
    }

    logger.info(`Fetched prompt ${id} - Title: ${prompt.title}`);
    res.status(200).json(prompt);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
