const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/authMiddleware");
const optionalAuth = require("../../middleware/optionalAuth");
const { voiceCloneLimiter, voiceTrialLimiter } = require("../../middleware/rateLimit");
const { logger } = require("../../middleware/logging");
const User = require("../../models/User");
const { NarrationError } = require("../../services/narration");
const voiceClone = require("../../services/voiceClone");

const MAX_NAME_LENGTH = 40;

const loadUser = async (req, res) => {
  const user = await User.findById(req.user.id).lean();
  if (!user) res.status(404).json({ error: "User not found." });
  return user;
};

const sendNarrationError = (error, res, next) => {
  if (error instanceof NarrationError) {
    return res.status(error.status).json({ error: error.message });
  }
  next(error);
};

// The logged-in user's cloned voice, or null. Guests get null too, plus the
// consent version they need for the trial.
router.get("/", optionalAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.json({ voice: null, consentVersion: voiceClone.CONSENT_VERSION });
    }
    const user = await loadUser(req, res);
    if (!user) return;
    res.json({
      voice: voiceClone.serializeVoice(user),
      consentVersion: voiceClone.CONSENT_VERSION,
    });
  } catch (error) {
    next(error);
  }
});

// Checks consent and the recording shared by both POST routes; answers
// with 400 and returns null when something is missing.
const parseCloneRequest = (req, res) => {
  const { consent, consentVersion, audio } = req.body || {};

  if (consent !== true || consentVersion !== voiceClone.CONSENT_VERSION) {
    res.status(400).json({ error: "Bitte bestätige, dass du die Stimme klonen darfst." });
    return null;
  }

  const parsed = voiceClone.parseAudioDataUrl(audio);
  if (!parsed) {
    res.status(400).json({
      error: "Die Aufnahme fehlt, ist zu kurz oder zu groß (höchstens 10 MB).",
    });
    return null;
  }
  return parsed;
};

// One-time trial without an account: clones the voice, reads the story with
// it, deletes the voice again and answers with the MP3. Body:
// { consent: true, consentVersion, audio, title, text }
router.post("/trial", optionalAuth, voiceTrialLimiter, async (req, res, next) => {
  try {
    const audio = parseCloneRequest(req, res);
    if (!audio) return;

    const { title, text } = req.body;
    const data = await voiceClone.trialNarration({ audio, title, text });
    logger.info("Guest voice trial recorded; the voice was deleted again");
    res.set({ "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store" });
    res.send(data);
  } catch (error) {
    if (error instanceof NarrationError) {
      logger.warn(`Guest voice trial failed: ${error.message}`);
    }
    sendNarrationError(error, res, next);
  }
});

// Clones the user's voice from one recording. Body:
// { name, consent: true, consentVersion, audio: "data:audio/...;base64,..." }
router.post("/", authMiddleware, voiceCloneLimiter, async (req, res, next) => {
  try {
    const parsed = parseCloneRequest(req, res);
    if (!parsed) return;
    const { name } = req.body;

    const user = await loadUser(req, res);
    if (!user) return;

    const voiceName =
      (typeof name === "string" && name.trim().slice(0, MAX_NAME_LENGTH)) ||
      "Meine Stimme";

    const updated = await voiceClone.cloneVoice({ user, name: voiceName, audio: parsed });
    res.status(201).json({ voice: voiceClone.serializeVoice(updated) });
  } catch (error) {
    if (error instanceof NarrationError) {
      logger.warn(`Voice cloning for user ${req.user.id} failed: ${error.message}`);
    }
    sendNarrationError(error, res, next);
  }
});

// Deletes the cloned voice at ElevenLabs and every recording made with it.
router.delete("/", authMiddleware, async (req, res, next) => {
  try {
    const user = await loadUser(req, res);
    if (!user) return;
    await voiceClone.deleteClonedVoice(user);
    res.json({ voice: null });
  } catch (error) {
    sendNarrationError(error, res, next);
  }
});

module.exports = router;
