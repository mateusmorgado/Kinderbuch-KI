// Calls to Gemini for story text and illustrations. Used by the REST routes
// in routes/api/contents.js and by the MCP tools in mcp/server.js.
const { logger } = require("../middleware/logging");

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_STORY_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_IMAGE_MODEL = "gemini-nano-banana-2.1";
const STORY_TIMEOUT_MS = 30000;
const IMAGE_TIMEOUT_MS = 45000;
const MAX_PROMPT_CHARS = 1000;
const MAX_PARAGRAPH_CHARS = 1500;
const STORY_TIMEOUT_ERROR = "Gemini hat zu lange gebraucht. Bitte versuche es erneut.";
const STORY_FAILED_ERROR = "Gemini konnte die Geschichte nicht erstellen";
const EMPTY_STORY_ERROR = "Gemini hat keine Geschichte zurückgegeben";
const MAX_TOKENS_ERROR =
  "Gemini hat die Geschichte vor dem Ende abgeschnitten. Bitte versuche es erneut.";

const STORY_SYSTEM_INSTRUCTION =
  "Write a complete, child-friendly story in the exact same language as the user's idea " +
  "(e.g. German for German ideas, English for English ideas). Never translate or switch languages. " +
  "Use simple, vivid language and a warm, hopeful tone with a clear beginning, exciting middle, and happy ending. " +
  "Write 180–250 words, end with a complete sentence, and start directly with the story—no title or commentary.";

// A Gemini failure with the HTTP status and message to show the user.
class GeminiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
  }
}

const isConfigured = () => Boolean(process.env.GEMINI_API_KEY);

// The API key goes in a header so it never shows up in a logged URL.
const geminiHeaders = () => ({
  "Content-Type": "application/json",
  "x-goog-api-key": process.env.GEMINI_API_KEY,
});

const storyModel = () => process.env.GEMINI_MODEL || DEFAULT_STORY_MODEL;
const imageModel = () => process.env.GEMINI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;

// Picks the lowest thinking setting supported by the active story model so
// invisible reasoning tokens don't inflate output cost.
const storyThinkingConfig = (model) => {
  if (process.env.GEMINI_THINKING_LEVEL) {
    return { thinkingLevel: process.env.GEMINI_THINKING_LEVEL };
  }
  if (/^gemini-2\.5-/i.test(model)) {
    return { thinkingBudget: 0 };
  }
  if (/flash-lite|^gemini-3-flash/i.test(model)) {
    return { thinkingLevel: "minimal" };
  }
  return { thinkingLevel: "low" };
};

// The request body for writing a story; shared by the plain and streaming routes.
const buildStoryRequest = (prompt, model = storyModel()) => {
  const thinkingConfig = storyThinkingConfig(model);
  const minimalThinking =
    thinkingConfig.thinkingLevel === "minimal" || thinkingConfig.thinkingBudget === 0;

  return {
    systemInstruction: {
      parts: [{ text: STORY_SYSTEM_INSTRUCTION }],
    },
    contents: [{ role: "user", parts: [{ text: prompt.trim() }] }],
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: minimalThinking ? 1024 : 1536,
      thinkingConfig,
    },
  };
};

// The request body for illustrating a story scene. Pins 1K 4:3 output (matching
// the UI aspect ratio and storage resize ceiling) and minimal thinking on models
// whose default thinking level is higher (e.g. Nano Banana 2.1 defaults to medium).
const buildImageRequest = (paragraph, model = imageModel()) => {
  const instruction =
    "Warm, colorful children's book illustration of this story scene. " +
    "Wholesome, imaginative, child-friendly, no text, letters, logos, or watermarks.\n\n" +
    paragraph.trim();

  const generationConfig = {
    responseModalities: ["IMAGE"],
    imageConfig: {
      aspectRatio: "4:3",
      ...(!/^gemini-2\.5-/i.test(model) && { imageSize: "1K" }),
    },
  };

  if (/nano-banana-2\.1|3\.1-flash-image/i.test(model)) {
    generationConfig.thinkingConfig = {
      thinkingLevel: process.env.GEMINI_IMAGE_THINKING_LEVEL || "minimal",
    };
  }

  return {
    contents: [{ role: "user", parts: [{ text: instruction }] }],
    generationConfig,
  };
};

const extractUsage = (usageMetadata) => {
  if (!usageMetadata) return null;
  return {
    promptTokens: usageMetadata.promptTokenCount ?? 0,
    outputTokens: usageMetadata.candidatesTokenCount ?? 0,
    thoughtTokens: usageMetadata.thoughtsTokenCount ?? 0,
    cachedTokens: usageMetadata.cachedContentTokenCount ?? 0,
    totalTokens: usageMetadata.totalTokenCount ?? 0,
  };
};

// Records Gemini token counts in structured logs so input, output and hidden
// thinking costs can be tracked per route, model and caller type.
const logUsage = ({
  operation,
  model,
  usageMetadata,
  finishReason = null,
  source = "web",
  authenticated = false,
}) => {
  const usage = extractUsage(usageMetadata);
  if (!usage) return null;

  logger.info(`Gemini ${operation} usage`, {
    event: "gemini_usage",
    operation,
    source,
    authenticated: Boolean(authenticated),
    model,
    finishReason,
    ...usage,
  });
  return usage;
};

// The story text of one Gemini response (or stream chunk), without thoughts.
const candidateText = (candidate) =>
  (candidate?.content?.parts || [])
    .filter((part) => part.text && !part.thought)
    .map((part) => part.text)
    .join("");

// POSTs to a Gemini model and aborts after timeoutMs. A timeout becomes a
// GeminiError with status 504 and the given message.
const callGemini = async (url, body, { timeoutMs, timeoutMessage }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: "POST",
      headers: geminiHeaders(),
      signal: controller.signal,
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (error.name === "AbortError") throw new GeminiError(504, timeoutMessage);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

// Writes one complete story from the user's idea and returns its text.
const writeStory = async (prompt, context = {}) => {
  const model = storyModel();
  const response = await callGemini(
    `${GEMINI_BASE_URL}/${model}:generateContent`,
    buildStoryRequest(prompt, model),
    { timeoutMs: STORY_TIMEOUT_MS, timeoutMessage: STORY_TIMEOUT_ERROR },
  );

  const responseData = await response.json();
  if (!response.ok) {
    console.error("Gemini API error:", responseData);
    throw new GeminiError(502, STORY_FAILED_ERROR);
  }

  const candidate = responseData.candidates?.[0];
  logUsage({
    operation: "story",
    model,
    usageMetadata: responseData.usageMetadata,
    finishReason: candidate?.finishReason,
    ...context,
  });

  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new GeminiError(502, MAX_TOKENS_ERROR);
  }

  const resultText = candidateText(candidate).trim();
  if (!resultText) throw new GeminiError(502, EMPTY_STORY_ERROR);
  return resultText;
};

// Draws an illustration of a story scene and returns it as a data URL.
const drawIllustration = async (paragraph, context = {}) => {
  const model = imageModel();
  const response = await callGemini(
    `${GEMINI_BASE_URL}/${model}:generateContent`,
    buildImageRequest(paragraph, model),
    {
      timeoutMs: IMAGE_TIMEOUT_MS,
      timeoutMessage: "Gemini hat zu lange gebraucht, um das Bild zu erstellen.",
    },
  );

  const responseData = await response.json();
  if (!response.ok) {
    console.error("Gemini image API error:", responseData);
    throw new GeminiError(502, "Gemini konnte das Bild nicht erstellen");
  }

  const candidate = responseData.candidates?.[0];
  logUsage({
    operation: "image",
    model,
    usageMetadata: responseData.usageMetadata,
    finishReason: candidate?.finishReason,
    ...context,
  });

  const imagePart = candidate?.content?.parts?.find(
    (part) => part.inlineData?.data && !part.thought,
  );
  if (!imagePart) {
    throw new GeminiError(
      502,
      "Gemini hat kein Bild zurückgegeben. Prüfe GEMINI_IMAGE_MODEL.",
    );
  }

  return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
};

module.exports = {
  GEMINI_BASE_URL,
  DEFAULT_STORY_MODEL,
  DEFAULT_IMAGE_MODEL,
  MAX_PROMPT_CHARS,
  MAX_PARAGRAPH_CHARS,
  STORY_TIMEOUT_ERROR,
  STORY_FAILED_ERROR,
  EMPTY_STORY_ERROR,
  MAX_TOKENS_ERROR,
  GeminiError,
  isConfigured,
  geminiHeaders,
  storyModel,
  imageModel,
  storyThinkingConfig,
  buildStoryRequest,
  buildImageRequest,
  extractUsage,
  logUsage,
  candidateText,
  writeStory,
  drawIllustration,
};
