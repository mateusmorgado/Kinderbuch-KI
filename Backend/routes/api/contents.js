const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const optionalAuth = require("../../middleware/optionalAuth");
const { logger } = require("../../middleware/logging");
const Story = require("../../models/Story");
const storage = require("../../services/storage");

require("dotenv").config();

// Stores a generated image for the user's story. Never throws: the image is
// still returned to the client when saving fails.
const saveImageToStory = async ({ user, storyId, image }) => {
  if (!storyId) return { saved: false };
  if (!user) return { saved: false, saveError: "not-logged-in" };
  if (!storage.isConfigured()) {
    return { saved: false, saveError: "storage-not-configured" };
  }

  try {
    if (!mongoose.isValidObjectId(storyId)) {
      return { saved: false, saveError: "story-not-found" };
    }

    const story = await Story.findOne({ _id: storyId, userId: user.id });
    if (!story) return { saved: false, saveError: "story-not-found" };

    const parsed = storage.parseDataUrl(image);
    if (!parsed) return { saved: false, saveError: "invalid-image" };

    const objectName = await storage.uploadStoryImage({
      userId: user.id,
      storyId: story._id.toString(),
      ...parsed,
    });

    // The illustration belongs to the final scene of the story.
    const section = story.content[story.content.length - 1];
    const previousImagePath = section.imagePath;
    section.imagePath = objectName;
    section.image = "";
    story.updatedAt = Date.now();
    await story.save();

    if (previousImagePath) {
      storage.deleteObject(previousImagePath).catch((error) => {
        logger.error(`Could not delete old image ${previousImagePath}: ${error.message}`);
      });
    }

    logger.info(`Image saved for story ${story._id}: ${objectName}`);
    return { saved: true, storyId: story._id.toString() };
  } catch (error) {
    logger.error(`Saving image failed: ${error.message}`);
    return { saved: false, saveError: "storage-failed" };
  }
};

// Test route
router.get("/", (req, res) => {
  res.send("Story generation is ready");
});

// Generate one complete story from the user's prompt.
router.post("/generate", async (req, res, next) => {
  try {
    const { prompt } = req.body;

    if (typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "A story prompt is required" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res
        .status(500)
        .json({ error: "GEMINI_API_KEY is not configured" });
    }

    const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
    const instruction = `
            Schreibe eine vollständige, kindgerechte Geschichte in derselben Sprache wie die Idee des Nutzers.
            Wenn die Idee auf Englisch geschrieben ist, schreibe die Geschichte vollständig auf Englisch.
            Übersetze die Idee nicht und wechsle nicht mitten in der Geschichte die Sprache.
            Verwende einfache, lebendige Sprache und einen positiven, hoffnungsvollen Ton.
            Die Geschichte soll einen klaren Anfang, eine spannende Mitte und ein schönes Ende haben.
            Schreibe ungefähr 180 bis 250 Wörter und beende die Geschichte vollständig.
            Beende immer mit einem vollständigen letzten Satz.
            Beginne direkt mit der Geschichte, ohne Überschrift oder Erklärung.

            Idee des Nutzers:
            ${prompt.trim()}
        `.trim();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let response;

    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: instruction }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 4096,
            thinkingConfig: {
              thinkingLevel: "low",
            },
          },
        }),
      });
    } catch (error) {
      if (error.name === "AbortError") {
        return res.status(504).json({
          error: "Gemini hat zu lange gebraucht. Bitte versuche es erneut.",
        });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    const responseData = await response.json();
    if (!response.ok) {
      console.error("Gemini API error:", responseData);
      return res
        .status(502)
        .json({ error: "Gemini konnte die Geschichte nicht erstellen" });
    }

    const candidate = responseData.candidates?.[0];
    if (candidate?.finishReason === "MAX_TOKENS") {
      return res.status(502).json({
        error:
          "Gemini hat die Geschichte vor dem Ende abgeschnitten. Bitte versuche es erneut.",
      });
    }

    const resultText = candidate?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!resultText) {
      return res
        .status(502)
        .json({ error: "Gemini hat keine Geschichte zurückgegeben" });
    }

    res.json({ response: resultText });
  } catch (error) {
    next(error);
  }
});

// Generate an illustration for the final story paragraph.
// With a valid login and a `storyId`, the image is also stored in the Google
// Cloud Storage bucket and attached to that story.
router.post("/generate-image", optionalAuth, async (req, res, next) => {
  try {
    const { paragraph } = req.body;

    if (typeof paragraph !== "string" || !paragraph.trim()) {
      return res.status(400).json({ error: "A story paragraph is required" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res
        .status(500)
        .json({ error: "GEMINI_API_KEY is not configured" });
    }

    const model = process.env.GEMINI_IMAGE_MODEL || "gemini-nano-banana-2.1";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
    const instruction = `
      Create a warm, colorful children's book illustration based on this final story scene.
      Keep the image wholesome, imaginative, and suitable for young children.
      Do not add any text, letters, captions, logos, or watermarks.

      Final story scene:
      ${paragraph.trim()}
    `.trim();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    let response;

    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: instruction }] }],
          generationConfig: {
            responseModalities: ["IMAGE"],
          },
        }),
      });
    } catch (error) {
      if (error.name === "AbortError") {
        return res.status(504).json({
          error: "Gemini hat zu lange gebraucht, um das Bild zu erstellen.",
        });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    const responseData = await response.json();
    if (!response.ok) {
      console.error("Gemini image API error:", responseData);
      return res
        .status(502)
        .json({ error: "Gemini konnte das Bild nicht erstellen" });
    }

    const imagePart = responseData.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData?.data,
    );

    if (!imagePart) {
      return res.status(502).json({
        error: "Gemini hat kein Bild zurückgegeben. Prüfe GEMINI_IMAGE_MODEL.",
      });
    }

    const image = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    const saveResult = await saveImageToStory({
      user: req.user,
      storyId: req.body.storyId,
      image,
    });

    res.json({ image, ...saveResult });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
