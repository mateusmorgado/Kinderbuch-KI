const crypto = require("crypto");
const User = require("../models/User");
const narration = require("./narration");
const { logger } = require("../middleware/logging");

require("dotenv").config();

// Clones a user's voice with ElevenLabs Instant Voice Cloning from one
// recording, so their stories can be read in their own voice. One voice per
// user; a new recording replaces the old voice.

// Bump when the consent text in the frontend changes in substance.
const CONSENT_VERSION = "2026-10-28";
const MIN_AUDIO_BYTES = 20 * 1024;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 120000;
const EXTENSIONS = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

// Parses "data:audio/webm;codecs=opus;base64,..." from the browser.
const parseAudioDataUrl = (dataUrl) => {
  const match = /^data:(audio\/[\w.+-]+)(?:;[^,;]+=[^,;]+)*;base64,([A-Za-z0-9+/=]+)$/.exec(
    String(dataUrl || ""),
  );
  if (!match || !EXTENSIONS[match[1]]) return null;

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length < MIN_AUDIO_BYTES || buffer.length > MAX_AUDIO_BYTES) return null;

  return { mimeType: match[1], buffer };
};

const apiHeaders = () => ({ "xi-api-key": process.env.ELEVENLABS_API_KEY });

const removeFromElevenLabs = async (voiceId) => {
  const response = await fetch(
    `${narration.ELEVENLABS_BASE_URL}/voices/${encodeURIComponent(voiceId)}`,
    {
      method: "DELETE",
      headers: apiHeaders(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  // Already gone is fine.
  if (!response.ok && response.status !== 404) {
    throw await narration.elevenLabsError(response, "Die Stimme konnte nicht gelöscht werden");
  }
};

// Deletes the user's cloned voice at ElevenLabs, its recordings and the
// reference on the user. Safe to call when there is none.
const deleteClonedVoice = async (user) => {
  const voiceId = user?.clonedVoice?.voiceId;
  if (!voiceId) return false;

  await removeFromElevenLabs(voiceId);
  await narration.deleteVoiceAudio(voiceId);
  await User.updateOne({ _id: user._id }, { $unset: { clonedVoice: 1 } });
  logger.info(`Cloned voice ${voiceId} of user ${user._id} deleted`);
  return true;
};

// Creates a voice at ElevenLabs from one recording and returns its id.
// `label` only identifies the voice in the ElevenLabs dashboard.
const createElevenLabsVoice = async ({ label, audio }) => {
  if (!narration.isEnabled()) {
    throw new narration.NarrationError(
      "Vorlesen ist auf diesem Server nicht eingerichtet.",
      503,
    );
  }

  const form = new FormData();
  form.append("name", label);
  form.append(
    "description",
    "Cloned in Kinderbuch KI by the speaker, with recorded consent.",
  );
  form.append("remove_background_noise", "true");
  form.append(
    "files",
    new Blob([audio.buffer], { type: audio.mimeType }),
    `sample.${EXTENSIONS[audio.mimeType]}`,
  );

  const response = await fetch(`${narration.ELEVENLABS_BASE_URL}/voices/add`, {
    method: "POST",
    headers: apiHeaders(),
    body: form,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw await narration.elevenLabsError(response, "Die Stimme konnte nicht geklont werden");
  }
  const { voice_id: voiceId } = await response.json();
  return voiceId;
};

// Creates the voice at ElevenLabs and stores it on the user. Any previous
// voice of the user is deleted afterwards. The user's chosen name stays in
// our database.
const cloneVoice = async ({ user, name, audio }) => {
  const voiceId = await createElevenLabsVoice({ label: `kinderbuch-${user._id}`, audio });

  const previous = user.clonedVoice?.voiceId;
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        clonedVoice: {
          voiceId,
          name,
          consentAt: new Date(),
          consentVersion: CONSENT_VERSION,
        },
      },
    },
  );
  logger.info(`User ${user._id} cloned voice ${voiceId}`);

  if (previous && previous !== voiceId) {
    removeFromElevenLabs(previous)
      .then(() => narration.deleteVoiceAudio(previous))
      .catch((error) => {
        logger.error(`Could not delete old voice ${previous}: ${error.message}`);
      });
  }

  return User.findById(user._id).lean();
};

// Guests can hear one story in their own voice without an account. The
// voice only lives for that one recording: it is deleted at ElevenLabs right
// afterwards, whether the recording worked or not, and nothing is stored.
const TRIAL_MAX_CHARS = 3000;

const trialNarration = async ({ audio, title, text }) => {
  const { text: narrationText } = narration.prepare({
    story: narration.guestStory({ title, text }),
    voice: "female", // only checked for validity; the cloned voice is used
    maxChars: TRIAL_MAX_CHARS,
  });

  const voiceId = await createElevenLabsVoice({
    label: `kinderbuch-trial-${crypto.randomBytes(4).toString("hex")}`,
    audio,
  });
  try {
    return await narration.synthesize({ voiceId, text: narrationText });
  } finally {
    await removeFromElevenLabs(voiceId).catch((error) => {
      logger.error(`Could not delete trial voice ${voiceId}: ${error.message}`);
    });
  }
};

// The API shape: never exposes the ElevenLabs voice id.
const serializeVoice = (user) =>
  user?.clonedVoice
    ? {
        name: user.clonedVoice.name,
        createdAt: user.clonedVoice.createdAt,
        consentAt: user.clonedVoice.consentAt,
      }
    : null;

module.exports = {
  CONSENT_VERSION,
  parseAudioDataUrl,
  cloneVoice,
  trialNarration,
  TRIAL_MAX_CHARS,
  deleteClonedVoice,
  serializeVoice,
};
