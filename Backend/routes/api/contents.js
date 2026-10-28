const express = require("express");
const router = express.Router();
const optionalAuth = require("../../middleware/optionalAuth");
const {
  storyLimiter,
  imageLimiter,
  guestNarrationLimiter,
} = require("../../middleware/rateLimit");
const { logger } = require("../../middleware/logging");
const { saveImageToStory } = require("../../services/stories");
const gemini = require("../../services/gemini");
const narration = require("../../services/narration");

require("dotenv").config();

// Test route
router.get("/", (req, res) => {
  res.send("Story generation is ready");
});

const STORY_STREAM_TIMEOUT_MS = 60000;

// Shared input checks; sends the error response and returns false on failure.
const checkStoryRequest = (req, res) => {
  const { prompt } = req.body;
  if (typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "A story prompt is required" });
    return false;
  }
  if (!gemini.isConfigured()) {
    res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
    return false;
  }
  return true;
};

// Generate one complete story from the user's prompt.
router.post("/generate", optionalAuth, storyLimiter, async (req, res, next) => {
  try {
    if (!checkStoryRequest(req, res)) return;

    const resultText = await gemini.writeStory(req.body.prompt);
    res.json({ response: resultText });
  } catch (error) {
    if (error instanceof gemini.GeminiError) {
      return res.status(error.status).json({ error: error.message });
    }
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
        `${gemini.GEMINI_BASE_URL}/${gemini.storyModel()}:streamGenerateContent?alt=sse`,
        {
          method: "POST",
          headers: gemini.geminiHeaders(),
          signal: controller.signal,
          body: JSON.stringify(gemini.buildStoryRequest(req.body.prompt)),
        },
      );
    } catch (error) {
      if (error.name === "AbortError") {
        return res.status(504).json({ error: gemini.STORY_TIMEOUT_ERROR });
      }
      throw error;
    }

    if (!response.ok) {
      console.error("Gemini API error:", await response.text().catch(() => ""));
      return res.status(502).json({ error: gemini.STORY_FAILED_ERROR });
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
        const text = gemini.candidateText(candidate);
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
            ? gemini.STORY_TIMEOUT_ERROR
            : gemini.STORY_FAILED_ERROR,
      });
      return res.end();
    }

    if (finishReason === "MAX_TOKENS") {
      send({ type: "error", error: gemini.MAX_TOKENS_ERROR });
    } else if (!wroteText) {
      send({ type: "error", error: gemini.EMPTY_STORY_ERROR });
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

    if (!gemini.isConfigured()) {
      return res
        .status(500)
        .json({ error: "GEMINI_API_KEY is not configured" });
    }

    const image = await gemini.drawIllustration(paragraph);
    const saveResult = await saveImageToStory({
      user: req.user,
      storyId: req.body.storyId,
      image,
    });

    res.json({ image, ...saveResult });
  } catch (error) {
    if (error instanceof gemini.GeminiError) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

// Only new recordings count against the guest limit.
const limitNewGuestNarrations = async (req, res, next) => {
  try {
    const { title, text, voice } = req.body || {};
    if (await narration.hasCachedNarration({ title, text, voice })) return next();
  } catch (error) {
    return next(error);
  }
  guestNarrationLimiter(req, res, next);
};

// Reads an unsaved story aloud, so guests can try it without an account.
// Body: { title, text, voice: "female" | "male" }. Saved stories use
// GET /api/stories/:id/narration instead.
router.post(
  "/narrate",
  optionalAuth,
  limitNewGuestNarrations,
  async (req, res, next) => {
    const { title, text, voice } = req.body || {};
    if (!narration.presetNames().includes(voice)) {
      return res.status(400).json({ error: "Unknown voice." });
    }

    try {
      const audio = await narration.getGuestNarration({ title, text, voice });
      const data = Buffer.isBuffer(audio.data) ? audio.data : Buffer.from(audio.data.buffer);
      logger.info(`Guest narration (${voice}) ${audio.cached ? "served from cache" : "recorded"}`);
      res.set({ "Content-Type": audio.mimeType, "Cache-Control": "private, no-store" });
      res.send(data);
    } catch (error) {
      if (error instanceof narration.NarrationError) {
        return res.status(error.status).json({ error: error.message });
      }
      next(error);
    }
  },
);

module.exports = router;
