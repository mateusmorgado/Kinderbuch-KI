const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const MINUTE = 60 * 1000;

// Logged-in users are counted per account, everyone else per IP address.
// Run after optionalAuth/authMiddleware so `req.user` is set.
const userOrIpKey = (req) =>
  req.user?.id ? `user:${req.user.id}` : `ip:${ipKeyGenerator(req.ip)}`;

const createLimiter = ({ windowMs, limit, message, ...options }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res, next, opts) => {
      res.status(opts.statusCode).json({ error: message });
    },
    ...options,
  });

// Story text generation calls Gemini, which costs money per request.
const storyLimiter = createLimiter({
  windowMs: 60 * MINUTE,
  limit: 20,
  keyGenerator: userOrIpKey,
  message:
    "Du hast in der letzten Stunde viele Geschichten erstellt. Bitte versuche es später erneut.",
});

// Images cost noticeably more than text, so the limit is lower.
const imageLimiter = createLimiter({
  windowMs: 60 * MINUTE,
  limit: 10,
  keyGenerator: userOrIpKey,
  message:
    "Du hast in der letzten Stunde viele Bilder erstellt. Bitte versuche es später erneut.",
});

// Reading a story aloud is billed per character by ElevenLabs. Only new
// recordings count; replaying a stored one is free.
const narrationLimiter = createLimiter({
  windowMs: 60 * MINUTE,
  limit: 10,
  keyGenerator: userOrIpKey,
  message:
    "Du hast in der letzten Stunde viele Geschichten vorlesen lassen. Bitte versuche es später erneut.",
});

// Guests can try reading aloud a few times without an account.
const guestNarrationLimiter = createLimiter({
  windowMs: 60 * MINUTE,
  limit: 3,
  keyGenerator: userOrIpKey,
  message:
    "Du hast Vorlesen schon ein paar Mal ausprobiert. Mit einem kostenlosen Konto geht es weiter.",
});

// Cloning a voice uses one of the ElevenLabs account's voice slots.
const voiceCloneLimiter = createLimiter({
  windowMs: 24 * 60 * MINUTE,
  limit: 5,
  keyGenerator: userOrIpKey,
  message: "Du hast heute schon einige Stimmen aufgenommen. Bitte versuche es morgen erneut.",
});

// Guests may hear their own voice once or twice a day without an account.
const voiceTrialLimiter = createLimiter({
  windowMs: 24 * 60 * MINUTE,
  limit: 2,
  keyGenerator: userOrIpKey,
  message:
    "Du hast deine Stimme heute schon ausprobiert. Mit einem kostenlosen Konto kannst du sie behalten.",
});

// Slows down password guessing. Successful logins do not count.
const authLimiter = createLimiter({
  windowMs: 15 * MINUTE,
  limit: 10,
  skipSuccessfulRequests: true,
  message: "Zu viele Versuche. Bitte warte ein paar Minuten.",
});

// Stops scripts from mass-creating accounts.
const registerLimiter = createLimiter({
  windowMs: 60 * MINUTE,
  limit: 5,
  message: "Zu viele neue Konten. Bitte versuche es später erneut.",
});

module.exports = {
  storyLimiter,
  imageLimiter,
  narrationLimiter,
  guestNarrationLimiter,
  voiceCloneLimiter,
  voiceTrialLimiter,
  authLimiter,
  registerLimiter,
  userOrIpKey,
};
