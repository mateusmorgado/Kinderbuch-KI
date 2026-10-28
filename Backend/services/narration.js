const crypto = require("crypto");
const StoryAudio = require("../models/StoryAudio");

require("dotenv").config();

// Reads stories aloud with ElevenLabs text to speech. The API key stays on
// the server; the browser only ever gets the finished MP3.

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";
const OUTPUT_FORMAT = "mp3_44100_96";
const MIME_TYPE = "audio/mpeg";
const REQUEST_TIMEOUT_MS = 120000;

// Multilingual v2 accepts 10,000 characters per request; stay below that and
// split longer stories at paragraph breaks.
const MAX_CHUNK_CHARS = 9000;
// Longer stories are refused so one click can never burn through the quota.
// 12,000 characters is about 15 minutes of audio.
const MAX_NARRATION_CHARS = 12000;

// Both voices come from the ElevenLabs voice library and were picked for
// children's stories in German and English. Either can be swapped with an
// env var without a code change.
const PRESET_VOICES = {
  female: {
    envVar: "ELEVENLABS_VOICE_FEMALE",
    defaultId: "hSzY2zmYNQPukJaIll7k", // Carlotta - Children's Stories
  },
  male: {
    envVar: "ELEVENLABS_VOICE_MALE",
    defaultId: "yYTemNXovAWXGGqLADJf", // Finn Fable - Children's Stories DE/EN
  },
};

// Calm and a little slower than normal speech, which suits bedtime.
const VOICE_SETTINGS = {
  stability: 0.55,
  similarity_boost: 0.75,
  style: 0.25,
  use_speaker_boost: true,
  speed: 0.92,
};

class NarrationError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

const isEnabled = () => Boolean(process.env.ELEVENLABS_API_KEY);

const modelId = () => process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";

const presetNames = () => Object.keys(PRESET_VOICES);

const resolveVoiceId = (voice) => {
  const preset = PRESET_VOICES[voice];
  if (!preset) return null;
  return process.env[preset.envVar] || preset.defaultId;
};

// Story text may contain a little Markdown from Gemini; it should not be read
// out as "Sternchen".
const cleanText = (text = "") =>
  String(text)
    .replace(/[*_#`>~]+/g, "")
    .replace(/[ \t]+/g, " ")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n\n");

// The text that is read aloud: the title, then every section.
const buildNarrationText = (story) =>
  [story.title, ...(story.content || []).map((section) => section.text)]
    .map(cleanText)
    .filter(Boolean)
    .join("\n\n");

// Splits text into pieces of at most `maxChars`, preferring paragraph breaks,
// then sentence ends, and only cutting mid-sentence as a last resort.
const splitText = (text, maxChars = MAX_CHUNK_CHARS) => {
  const chunks = [];
  let current = "";

  const push = (piece) => {
    if (!current) {
      current = piece;
    } else if (current.length + 2 + piece.length <= maxChars) {
      current += `\n\n${piece}`;
    } else {
      chunks.push(current);
      current = piece;
    }
  };

  for (const paragraph of text.split(/\n{2,}/)) {
    if (paragraph.length <= maxChars) {
      push(paragraph);
      continue;
    }
    const sentences = paragraph.match(/[^.!?…]+[.!?…]*\s*/g) || [paragraph];
    for (const sentence of sentences) {
      for (let i = 0; i < sentence.length; i += maxChars) {
        const piece = sentence.slice(i, i + maxChars).trim();
        if (!piece) continue;
        if (current && current.length + 1 + piece.length <= maxChars) {
          current += ` ${piece}`;
        } else {
          if (current) chunks.push(current);
          current = piece;
        }
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
};

const hashText = (text) => crypto.createHash("sha256").update(text).digest("hex");

const elevenLabsError = async (response) => {
  let detail = "";
  try {
    const body = await response.json();
    detail = body?.detail?.status || body?.detail?.message || "";
  } catch {
    // Not JSON; the status code is enough.
  }

  // ElevenLabs reports an empty quota as a 401, so check that first.
  if (detail === "quota_exceeded" || response.status === 402) {
    return new NarrationError(
      "Das Vorlese-Kontingent ist für diesen Monat aufgebraucht.",
      503,
    );
  }
  if (response.status === 401) {
    return new NarrationError("Der ElevenLabs-Schlüssel wurde abgelehnt.", 502);
  }
  if (response.status === 429) {
    return new NarrationError(
      "Gerade lesen sehr viele vor. Bitte versuche es gleich noch einmal.",
      503,
    );
  }
  return new NarrationError(
    `Die Geschichte konnte nicht vorgelesen werden (ElevenLabs ${response.status}${
      detail ? `: ${detail}` : ""
    }).`,
    502,
  );
};

// Calls ElevenLabs once per chunk and joins the MP3s. The neighbouring text
// is passed along so the voice keeps its flow across chunk borders.
const synthesize = async ({ voiceId, text }) => {
  const chunks = splitText(text);
  const buffers = [];

  for (let i = 0; i < chunks.length; i += 1) {
    const response = await fetch(
      `${ELEVENLABS_BASE_URL}/text-to-speech/${encodeURIComponent(
        voiceId,
      )}?output_format=${OUTPUT_FORMAT}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: MIME_TYPE,
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: chunks[i],
          model_id: modelId(),
          voice_settings: VOICE_SETTINGS,
          previous_text: chunks[i - 1]?.slice(-500),
          next_text: chunks[i + 1]?.slice(0, 500),
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );

    if (!response.ok) throw await elevenLabsError(response);
    buffers.push(Buffer.from(await response.arrayBuffer()));
  }

  return Buffer.concat(buffers);
};

// Two clicks on "play" for the same story must not pay twice; the second
// request waits for the first one's recording.
const inFlight = new Map();

// Returns { mimeType, data } for the story read by `voice` ("female" or
// "male"), from the cache when it was made before.
const getNarration = async ({ story, voice }) => {
  const voiceId = resolveVoiceId(voice);
  if (!voiceId) throw new NarrationError("Unbekannte Stimme.", 400);

  const text = buildNarrationText(story);
  if (!text) throw new NarrationError("Diese Geschichte hat keinen Text.", 400);
  if (text.length > MAX_NARRATION_CHARS) {
    throw new NarrationError("Diese Geschichte ist zu lang zum Vorlesen.", 413);
  }

  const key = {
    storyId: story._id,
    voiceId,
    modelId: modelId(),
    textHash: hashText(text),
  };

  const cached = await StoryAudio.findOne(key).lean();
  if (cached) return { mimeType: cached.mimeType, data: cached.data, cached: true };

  if (!isEnabled()) {
    throw new NarrationError("Vorlesen ist auf diesem Server nicht eingerichtet.", 503);
  }

  const flightKey = `${story._id}:${voiceId}:${key.modelId}:${key.textHash}`;
  if (!inFlight.has(flightKey)) {
    const job = (async () => {
      const data = await synthesize({ voiceId, text });
      // Older recordings of this story with this voice are outdated now.
      await StoryAudio.deleteMany({ storyId: story._id, voiceId });
      try {
        await StoryAudio.create({
          ...key,
          userId: String(story.userId),
          mimeType: MIME_TYPE,
          data,
        });
      } catch (error) {
        // Another server instance stored the same recording first.
        if (error.code !== 11000) throw error;
      }
      return { mimeType: MIME_TYPE, data, cached: false };
    })().finally(() => inFlight.delete(flightKey));
    inFlight.set(flightKey, job);
  }
  return inFlight.get(flightKey);
};

// True when the recording is already stored, so serving it costs nothing.
const hasCachedNarration = async ({ story, voice }) => {
  const voiceId = resolveVoiceId(voice);
  if (!voiceId) return false;
  const text = buildNarrationText(story);
  return Boolean(
    await StoryAudio.exists({
      storyId: story._id,
      voiceId,
      modelId: modelId(),
      textHash: hashText(text),
    }),
  );
};

const deleteStoryAudio = (storyId) => StoryAudio.deleteMany({ storyId });

module.exports = {
  NarrationError,
  MAX_NARRATION_CHARS,
  isEnabled,
  presetNames,
  resolveVoiceId,
  buildNarrationText,
  splitText,
  getNarration,
  hasCachedNarration,
  deleteStoryAudio,
};
