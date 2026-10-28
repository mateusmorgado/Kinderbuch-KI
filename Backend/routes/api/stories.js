const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const authMiddleware = require("../../middleware/authMiddleware");
const { logger } = require("../../middleware/logging");
const Story = require("../../models/Story");
const User = require("../../models/User");
const storage = require("../../services/storage");
const { deleteStoryWithImages } = require("../../services/stories");
const narration = require("../../services/narration");
const { narrationLimiter } = require("../../middleware/rateLimit");

const MAX_TITLE_LENGTH = 120;
const MAX_TEXT_LENGTH = 20000;

// Turns a stored story into the API shape: stored images are exposed as a
// loadable URL in `image`, and the internal path is not exposed.
const serializeStory = async (story, req) => {
  const plain = story.toObject ? story.toObject() : story;

  const content = await Promise.all(
    (plain.content || []).map(async ({ imagePath, image, ...section }) => {
      let imageUrl = image || "";
      if (imagePath) {
        try {
          imageUrl = await storage.getImageUrl(imagePath, storage.getPublicBaseUrl(req));
        } catch (error) {
          logger.error(`Could not sign image URL: ${error.message}`);
        }
      }
      return { ...section, image: imageUrl, hasImage: Boolean(imagePath || image) };
    }),
  );

  return { ...plain, content };
};

const buildTitle = (title, prompt) => {
  const candidate =
    (typeof title === "string" && title.trim()) ||
    (typeof prompt === "string" && prompt.trim().split(/[.!?\n]/)[0]) ||
    "Deine Geschichte";
  return candidate.slice(0, MAX_TITLE_LENGTH);
};

const findOwnedStory = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ error: "Story not found." });
    return null;
  }

  const story = await Story.findById(req.params.id);
  if (!story) {
    logger.warn(`Story with ID ${req.params.id} not found`);
    res.status(404).json({ error: "Story not found." });
    return null;
  }

  if (story.userId.toString() !== req.user.id) {
    logger.warn(
      `User ${req.user.id} tried to access story ${req.params.id} of another user`,
    );
    res.status(403).json({ error: "Not allowed to access this story." });
    return null;
  }

  return story;
};

// Get all stories of the logged-in user, newest first
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const stories = await Story.find({ userId: req.user.id }).sort({ createdAt: -1 });
    logger.info(`Fetched stories of user ${req.user.id} - Count: ${stories.length}`);
    res.status(200).json(await Promise.all(stories.map((story) => serializeStory(story, req))));
  } catch (error) {
    next(error);
  }
});

// Get all stories by a specific user (only your own)
router.get("/user/:userId", authMiddleware, async (req, res, next) => {
  try {
    if (req.params.userId !== req.user.id) {
      return res.status(403).json({ error: "Not allowed to access these stories." });
    }

    const stories = await Story.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    logger.info(`Fetched ${stories.length} stories for user ${req.params.userId}`);
    res.status(200).json(await Promise.all(stories.map((story) => serializeStory(story, req))));
  } catch (error) {
    next(error);
  }
});

// Get a single story by ID (only the owner)
router.get("/:id", authMiddleware, async (req, res, next) => {
  try {
    const story = await findOwnedStory(req, res);
    if (!story) return;

    logger.info(`Fetched story ${req.params.id} - Title: ${story.title}`);
    res.status(200).json(await serializeStory(story, req));
  } catch (error) {
    next(error);
  }
});

// Loads the owned story into req.story for the narration route.
const loadOwnedStory = async (req, res, next) => {
  try {
    const story = await findOwnedStory(req, res);
    if (!story) return;
    req.story = story;
    next();
  } catch (error) {
    next(error);
  }
};

// Only new recordings count against the narration limit.
const limitNewNarrations = async (req, res, next) => {
  try {
    const cached = await narration.hasCachedNarration({
      story: req.story,
      voice: req.query.voice,
    });
    if (cached) return next();
  } catch (error) {
    return next(error);
  }
  narrationLimiter(req, res, next);
};

// The story read aloud as MP3 (only the owner). `voice` is "female" or
// "male". The first request records it with ElevenLabs, later ones are
// served from the database.
router.get(
  "/:id/narration",
  authMiddleware,
  loadOwnedStory,
  limitNewNarrations,
  async (req, res, next) => {
    const voice = req.query.voice;
    if (!narration.presetNames().includes(voice)) {
      return res.status(400).json({ error: "Unknown voice." });
    }

    try {
      const audio = await narration.getNarration({ story: req.story, voice });
      // A fresh recording is a Buffer; one loaded from MongoDB is a Binary.
      const data = Buffer.isBuffer(audio.data) ? audio.data : Buffer.from(audio.data.buffer);

      logger.info(
        `Narration of story ${req.story._id} (${voice}) ${audio.cached ? "served from cache" : "recorded"}`,
      );
      res.set({
        "Content-Type": audio.mimeType,
        "Cache-Control": "private, no-store",
      });
      res.send(data);
    } catch (error) {
      if (error instanceof narration.NarrationError) {
        logger.warn(`Narration of story ${req.story._id} failed: ${error.message}`);
        return res.status(error.status).json({ error: error.message });
      }
      next(error);
    }
  },
);

// Create a new story. Accepts either `text` (one string) or `content`
// (array of { text } scenes). Images are attached afterwards through
// POST /api/contents/generate-image with the returned story id.
router.post("/", authMiddleware, async (req, res, next) => {
  try {
    const { title, prompt, text, content } = req.body;

    let scenes = [];
    if (Array.isArray(content)) {
      scenes = content
        .filter((scene) => typeof scene?.text === "string" && scene.text.trim())
        .map((scene, index) => ({ id: index + 1, text: scene.text.trim() }));
    } else if (typeof text === "string" && text.trim()) {
      scenes = [{ id: 1, text: text.trim() }];
    }

    if (!scenes.length || scenes.some((scene) => scene.text.length > MAX_TEXT_LENGTH)) {
      logger.warn(`Story creation failed - Invalid input from user ${req.user.id}`);
      return res.status(400).json({ error: "Valid story text is required." });
    }

    const newStory = await Story.create({
      userId: req.user.id,
      title: buildTitle(title, prompt),
      prompt: typeof prompt === "string" ? prompt.trim().slice(0, 2000) : "",
      content: scenes,
    });

    await User.findByIdAndUpdate(req.user.id, {
      $push: { createdStories: newStory._id },
    });

    logger.info(`New story created: ${newStory.title} by user ${req.user.id}`);
    res.status(201).json(await serializeStory(newStory, req));
  } catch (error) {
    next(error);
  }
});

// Rename a story (only the owner)
router.put("/:id", authMiddleware, async (req, res, next) => {
  try {
    const story = await findOwnedStory(req, res);
    if (!story) return;

    if (typeof req.body.title !== "string" || !req.body.title.trim()) {
      return res.status(400).json({ error: "A title is required." });
    }

    story.title = req.body.title.trim().slice(0, MAX_TITLE_LENGTH);
    await story.save();

    logger.info(`Story updated: ${req.params.id} by user ${req.user.id}`);
    res.status(200).json(await serializeStory(story, req));
  } catch (error) {
    next(error);
  }
});

// Delete a story and its stored images (only the owner)
router.delete("/:id", authMiddleware, async (req, res, next) => {
  try {
    const story = await findOwnedStory(req, res);
    if (!story) return;

    await deleteStoryWithImages(story);
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { createdStories: story._id },
    });

    logger.info(`Story deleted: ${req.params.id} by user ${req.user.id}`);
    res.status(200).json({ message: "Story deleted successfully." });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
