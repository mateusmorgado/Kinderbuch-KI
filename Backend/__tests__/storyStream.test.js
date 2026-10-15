const express = require("express");
const request = require("supertest");

process.env.GEMINI_API_KEY = "test-key";

const contentRoutes = require("../routes/api/contents");

const app = express();
app.use(express.json());
app.use("/api/contents", contentRoutes);

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

// A fake Gemini streaming response made of server-sent events.
const geminiStream = (events, { split = 7 } = {}) => {
  const body = events.map((event) => `data: ${JSON.stringify(event)}\r\n\r\n`).join("");
  const bytes = new TextEncoder().encode(body);
  // Deliver in small pieces so events are split across chunks.
  const chunks = [];
  for (let i = 0; i < bytes.length; i += split) chunks.push(bytes.slice(i, i + split));
  return {
    ok: true,
    body: (async function* stream() {
      yield* chunks;
    })(),
  };
};

const chunk = (text, finishReason) => ({
  candidates: [{ content: { parts: [{ text }] }, ...(finishReason && { finishReason }) }],
});

const readEvents = (res) =>
  res.text
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

describe("POST /api/contents/generate-stream", () => {
  it("streams the story text as it arrives", async () => {
    global.fetch = jest.fn(async () =>
      geminiStream([chunk("Es war einmal "), chunk("ein Fuchs."), chunk("", "STOP")]),
    );

    const res = await request(app)
      .post("/api/contents/generate-stream")
      .send({ prompt: "Ein Fuchs" })
      .expect(200)
      .expect("Content-Type", /application\/x-ndjson/);

    expect(readEvents(res)).toEqual([
      { type: "text", text: "Es war einmal " },
      { type: "text", text: "ein Fuchs." },
      { type: "done" },
    ]);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toMatch(/:streamGenerateContent\?alt=sse$/);
    expect(options.headers["x-goog-api-key"]).toBe("test-key");
  });

  it("skips thought parts", async () => {
    global.fetch = jest.fn(async () =>
      geminiStream([
        { candidates: [{ content: { parts: [{ text: "planning...", thought: true }] } }] },
        chunk("Ende.", "STOP"),
      ]),
    );

    const res = await request(app)
      .post("/api/contents/generate-stream")
      .send({ prompt: "Ein Fuchs" })
      .expect(200);

    expect(readEvents(res)).toEqual([
      { type: "text", text: "Ende." },
      { type: "done" },
    ]);
  });

  it("reports a story that was cut off", async () => {
    global.fetch = jest.fn(async () =>
      geminiStream([chunk("Es war einmal", "MAX_TOKENS")]),
    );

    const res = await request(app)
      .post("/api/contents/generate-stream")
      .send({ prompt: "Ein Fuchs" })
      .expect(200);

    expect(readEvents(res).at(-1)).toEqual({
      type: "error",
      error: expect.stringContaining("abgeschnitten"),
    });
  });

  it("returns a normal error when Gemini rejects the request", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, text: async () => "quota" }));
    jest.spyOn(console, "error").mockImplementation(() => {});

    const res = await request(app)
      .post("/api/contents/generate-stream")
      .send({ prompt: "Ein Fuchs" })
      .expect(502);
    expect(res.body.error).toEqual(expect.any(String));
  });

  it("requires a prompt", async () => {
    await request(app).post("/api/contents/generate-stream").send({ prompt: " " }).expect(400);
  });
});
