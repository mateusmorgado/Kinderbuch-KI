// Calls to Gemini for story text and illustrations. Used by the REST routes
// in routes/api/contents.js and by the MCP tools in mcp/server.js.

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const STORY_TIMEOUT_MS = 30000;
const IMAGE_TIMEOUT_MS = 45000;
const STORY_TIMEOUT_ERROR = "Gemini hat zu lange gebraucht. Bitte versuche es erneut.";
const STORY_FAILED_ERROR = "Gemini konnte die Geschichte nicht erstellen";
const EMPTY_STORY_ERROR = "Gemini hat keine Geschichte zurückgegeben";
const MAX_TOKENS_ERROR =
  "Gemini hat die Geschichte vor dem Ende abgeschnitten. Bitte versuche es erneut.";

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

const storyModel = () => process.env.GEMINI_MODEL || "gemini-3.8-flash";
const imageModel = () => process.env.GEMINI_IMAGE_MODEL || "gemini-nano-banana-2.1";

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
const writeStory = async (prompt) => {
  const response = await callGemini(
    `${GEMINI_BASE_URL}/${storyModel()}:generateContent`,
    buildStoryRequest(prompt),
    { timeoutMs: STORY_TIMEOUT_MS, timeoutMessage: STORY_TIMEOUT_ERROR },
  );

  const responseData = await response.json();
  if (!response.ok) {
    console.error("Gemini API error:", responseData);
    throw new GeminiError(502, STORY_FAILED_ERROR);
  }

  const candidate = responseData.candidates?.[0];
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new GeminiError(502, MAX_TOKENS_ERROR);
  }

  const resultText = candidateText(candidate).trim();
  if (!resultText) throw new GeminiError(502, EMPTY_STORY_ERROR);
  return resultText;
};

// Draws an illustration of a story scene and returns it as a data URL.
const drawIllustration = async (paragraph) => {
  const instruction = `
      Create a warm, colorful children's book illustration based on this final story scene.
      Keep the image wholesome, imaginative, and suitable for young children.
      Do not add any text, letters, captions, logos, or watermarks.

      Final story scene:
      ${paragraph.trim()}
    `.trim();

  const response = await callGemini(
    `${GEMINI_BASE_URL}/${imageModel()}:generateContent`,
    {
      contents: [{ role: "user", parts: [{ text: instruction }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
      },
    },
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

  const imagePart = responseData.candidates?.[0]?.content?.parts?.find(
    (part) => part.inlineData?.data,
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
  STORY_TIMEOUT_ERROR,
  STORY_FAILED_ERROR,
  EMPTY_STORY_ERROR,
  MAX_TOKENS_ERROR,
  GeminiError,
  isConfigured,
  geminiHeaders,
  storyModel,
  buildStoryRequest,
  candidateText,
  writeStory,
  drawIllustration,
};
