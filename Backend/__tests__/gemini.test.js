process.env.GEMINI_API_KEY = "test-key";

const gemini = require("../services/gemini");
const { logger } = require("../middleware/logging");

const realFetch = global.fetch;

afterEach(() => {
  global.fetch = realFetch;
  delete process.env.GEMINI_MODEL;
  delete process.env.GEMINI_IMAGE_MODEL;
  delete process.env.GEMINI_THINKING_LEVEL;
  delete process.env.GEMINI_IMAGE_THINKING_LEVEL;
  jest.restoreAllMocks();
});

describe("gemini service", () => {
  it("defaults to Flash-Lite with minimal thinking, systemInstruction, and tighter maxOutputTokens", () => {
    expect(gemini.storyModel()).toBe("gemini-3.5-flash-lite");

    const req = gemini.buildStoryRequest("  Ein kleiner Fuchs im Wald  ");
    expect(req.systemInstruction.parts[0].text).toContain("180–250 words");
    expect(req.contents).toEqual([
      { role: "user", parts: [{ text: "Ein kleiner Fuchs im Wald" }] },
    ]);
    expect(req.generationConfig).toEqual({
      temperature: 0.8,
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingLevel: "minimal" },
    });
  });

  it("adapts thinkingConfig and maxOutputTokens per story model", () => {
    const flash38 = gemini.buildStoryRequest("Fuchs", "gemini-3.8-flash");
    expect(flash38.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "low" });
    expect(flash38.generationConfig.maxOutputTokens).toBe(1536);

    const flash25 = gemini.buildStoryRequest("Fuchs", "gemini-2.5-flash");
    expect(flash25.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(flash25.generationConfig.maxOutputTokens).toBe(1024);

    process.env.GEMINI_THINKING_LEVEL = "medium";
    const override = gemini.buildStoryRequest("Fuchs", "gemini-3.5-flash-lite");
    expect(override.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "medium" });
    expect(override.generationConfig.maxOutputTokens).toBe(1536);
  });

  it("configures 4:3 1K output and minimal thinking for Nano Banana 2.1 images", () => {
    const req = gemini.buildImageRequest("  Der Fuchs schaut in die Sterne.  ");
    expect(req.contents[0].parts[0].text).toContain("Der Fuchs schaut in die Sterne.");
    expect(req.generationConfig).toEqual({
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: "4:3", imageSize: "1K" },
      thinkingConfig: { thinkingLevel: "minimal" },
    });

    const legacy = gemini.buildImageRequest("Szene", "gemini-2.5-flash-image");
    expect(legacy.generationConfig).toEqual({
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: "4:3" },
    });
  });

  it("logs usageMetadata on writeStory and drawIllustration", async () => {
    const infoSpy = jest.spyOn(logger, "info").mockImplementation(() => logger);

    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ finishReason: "STOP", content: { parts: [{ text: "Es war einmal." }] } }],
        usageMetadata: {
          promptTokenCount: 95,
          candidatesTokenCount: 380,
          thoughtsTokenCount: 12,
          cachedContentTokenCount: 0,
          totalTokenCount: 487,
        },
      }),
    }));

    const story = await gemini.writeStory("Ein Fuchs", { source: "web", authenticated: true });
    expect(story).toBe("Es war einmal.");
    expect(infoSpy).toHaveBeenCalledWith(
      "Gemini story usage",
      expect.objectContaining({
        event: "gemini_usage",
        operation: "story",
        source: "web",
        authenticated: true,
        model: "gemini-3.5-flash-lite",
        finishReason: "STOP",
        promptTokens: 95,
        outputTokens: 380,
        thoughtTokens: 12,
        totalTokens: 487,
      }),
    );

    infoSpy.mockClear();
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [
                { inlineData: { mimeType: "image/png", data: "dGhvdWdodA==" }, thought: true },
                { inlineData: { mimeType: "image/png", data: "ZmluYWw=" } },
              ],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 60,
          candidatesTokenCount: 1120,
          thoughtsTokenCount: 0,
          totalTokenCount: 1180,
        },
      }),
    }));

    const image = await gemini.drawIllustration("Ende.", { source: "mcp", authenticated: true });
    expect(image).toBe("data:image/png;base64,ZmluYWw=");
    expect(infoSpy).toHaveBeenCalledWith(
      "Gemini image usage",
      expect.objectContaining({
        event: "gemini_usage",
        operation: "image",
        source: "mcp",
        authenticated: true,
        model: "gemini-nano-banana-2.1",
        promptTokens: 60,
        outputTokens: 1120,
        thoughtTokens: 0,
        totalTokens: 1180,
      }),
    );
  });
});
