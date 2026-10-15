const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const optionalAuth = require("../../middleware/optionalAuth");
const { storyLimiter, imageLimiter } = require("../../middleware/rateLimit");
const { logger } = require("../../middleware/logging");
const Story = require("../../models/Story");
const storage = require("../../services/storage");

require("dotenv").config();

// Stores a generated image for the user's story. Never throws: the image is
// still returned to the client when saving fails.
const saveImageToStory = async ({ user, storyId, image }) => {
  if (!storyId) return { saved: false };
  if (!user) return { saved: false, saveError: "not-logged-in" };

  try {
    if (!mongoose.isValidObjectId(storyId)) {
      return { saved: false, saveError: "story-not-found" };
    }

    const story = await Story.findOne({ _id: storyId, userId: user.id });
    if (!story) return { saved: false, saveError: "story-not-found" };

    const parsed = storage.parseDataUrl(image);
    if (!parsed) return { saved: false, saveError: "invalid-image" };

    const imagePath = await storage.saveStoryImage({
      userId: user.id,
      storyId: story._id.toString(),
      ...parsed,
    });

    // The illustration belongs to the final scene of the story.
    const section = story.content[story.content.length - 1];
    const previousImagePath = section.imagePath;
    section.imagePath = imagePath;
    section.image = "";
    await story.save();

    if (previousImagePath) {
      storage.deleteImage(previousImagePath).catch((error) => {
        logger.error(`Could not delete old image ${previousImagePath}: ${error.message}`);
      });
    }

    logger.info(`Image saved for story ${story._id}: ${imagePath}`);
    return { saved: true, storyId: story._id.toString() };
  } catch (error) {
    logger.error(`Saving image failed: ${error.message}`);
    return { saved: false, saveError: "storage-failed" };
  }
};

// The API key goes in a header so it never shows up in a logged URL.
const geminiHeaders = () => ({
  "Content-Type": "application/json",
  "x-goog-api-key": process.env.GEMINI_API_KEY,
});

// Test route
router.get("/", (req, res) => {
  res.send("Story generation is ready");
});

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const STORY_TIMEOUT_MS = 30000;
const STORY_STREAM_TIMEOUT_MS = 60000;
const MAX_TOKENS_ERROR =
  "Gemini hat die Geschichte vor dem Ende abgeschnitten. Bitte versuche es erneut.";

const storyModel = () => process.env.GEMINI_MODEL || "gemini-3.8-flash";

// The request body for writing a story; shared by the plain and streaming routes.
const buildStoryRequest = (prompt) => {
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

  return {
    contents: [{ role: "user", parts: [{ text: instruction }] }],
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 4096,
      thinkingConfig: {
        thinkingLevel: "low",
      },
    },
  };
};

// The story text of one Gemini response (or stream chunk), without thoughts.
const candidateText = (candidate) =>
  (candidate?.content?.parts || [])
    .filter((part) => part.text && !part.thought)
    .map((part) => part.text)
    .join("");

// Shared input checks; sends the error response and returns false on failure.
const checkStoryRequest = (req, res) => {
  const { prompt } = req.body;
  if (typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "A story prompt is required" });
    return false;
  }
  if (!process.env.GEMINI_API_KEY) {
    res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
    return false;
  }
  return true;
};

// Generate one complete story from the user's prompt.
router.post("/generate", optionalAuth, storyLimiter, async (req, res, next) => {
  try {
    if (!checkStoryRequest(req, res)) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), STORY_TIMEOUT_MS);
    let response;

    try {
      response = await fetch(`${GEMINI_BASE_URL}/${storyModel()}:generateContent`, {
        method: "POST",
        headers: geminiHeaders(),
        signal: controller.signal,
        body: JSON.stringify(buildStoryRequest(req.body.prompt)),
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
      return res.status(502).json({ error: MAX_TOKENS_ERROR });
    }

    const resultText = candidateText(candidate).trim();
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

// Reads Gemini's server-sent events and calls onEvent with each parsed JSON.
const readGeminiEvents = async (body, onEvent) => {
  const decoder = new TextDecoder();
  let buffer = "";

  const handleLine = (line) => {
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (data) onEvent(JSON.parse(data));
  };

  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop();
    lines.forEach(handleLine);
  }
  buffer += decoder.decode();
  handleLine(buffer);
};

// Same as /generate, but sends the story while Gemini writes it, as
// newline-delimited JSON: {"type":"text","text":"..."} for each piece, then
// {"type":"done"} or {"type":"error","error":"..."}. Errors before the
// first piece are normal JSON error responses with a status code.
router.post("/generate-stream", optionalAuth, storyLimiter, async (req, res, next) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STORY_STREAM_TIMEOUT_MS);
  // Stop asking Gemini when the reader leaves the page.
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    if (!checkStoryRequest(req, res)) return;

    let response;
    try {
      response = await fetch(
        `${GEMINI_BASE_URL}/${storyModel()}:streamGenerateContent?alt=sse`,
        {
          method: "POST",
          headers: geminiHeaders(),
          signal: controller.signal,
          body: JSON.stringify(buildStoryRequest(req.body.prompt)),
        },
      );
    } catch (error) {
      if (error.name === "AbortError") {
        return res.status(504).json({
          error: "Gemini hat zu lange gebraucht. Bitte versuche es erneut.",
        });
      }
      throw error;
    }

    if (!response.ok) {
      console.error("Gemini API error:", await response.text().catch(() => ""));
      return res
        .status(502)
        .json({ error: "Gemini konnte die Geschichte nicht erstellen" });
    }

    res.status(200).set({
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    const send = (event) => res.write(`${JSON.stringify(event)}\n`);

    let wroteText = false;
    let finishReason = null;
    try {
      await readGeminiEvents(response.body, (event) => {
        const candidate = event.candidates?.[0];
        const text = candidateText(candidate);
        if (text) {
          wroteText = true;
          send({ type: "text", text });
        }
        if (candidate?.finishReason) finishReason = candidate.finishReason;
      });
    } catch (error) {
      if (res.destroyed) return;
      logger.error(`Story stream failed: ${error.message}`);
      send({
        type: "error",
        error:
          error.name === "AbortError"
            ? "Gemini hat zu lange gebraucht. Bitte versuche es erneut."
            : "Gemini konnte die Geschichte nicht erstellen",
      });
      return res.end();
    }

    if (finishReason === "MAX_TOKENS") {
      send({ type: "error", error: MAX_TOKENS_ERROR });
    } else if (!wroteText) {
      send({ type: "error", error: "Gemini hat keine Geschichte zurückgegeben" });
    } else {
      send({ type: "done" });
    }
    res.end();
  } catch (error) {
    if (res.headersSent) {
      logger.error(`Story stream failed: ${error.message}`);
      return res.end();
    }
    next(error);
  } finally {
    clearTimeout(timeout);
  }
});

// Generate an illustration for the final story paragraph.
// With a valid login and a `storyId`, the image is also stored (MongoDB, or
// the Google Cloud Storage bucket when configured) and attached to that story.
router.post("/generate-image", optionalAuth, imageLimiter, async (req, res, next) => {
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
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
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
        headers: geminiHeaders(),
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
