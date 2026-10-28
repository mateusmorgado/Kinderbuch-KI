const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.ACCESS_TOKEN_SECRET = "test-secret";
process.env.ELEVENLABS_API_KEY = "test-eleven-key";
delete process.env.ELEVENLABS_VOICE_FEMALE;
delete process.env.ELEVENLABS_VOICE_MALE;
delete process.env.ELEVENLABS_MODEL;

const storyRoutes = require("../routes/api/stories");
const StoryAudio = require("../models/StoryAudio");
const User = require("../models/User");
const { splitText, buildNarrationText } = require("../services/narration");

const app = express();
app.use(express.json());
app.use("/api/stories", storyRoutes);

let mongoServer;
let token;
let otherToken;
const realFetch = global.fetch;
const fakeMp3 = Buffer.from("ID3-fake-mp3-bytes");

// Collects a binary response body into a Buffer.
const binaryParser = (res, callback) => {
  const chunks = [];
  res.on("data", (chunk) => chunks.push(chunk));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
};

const mp3Response = () => ({
  ok: true,
  status: 200,
  arrayBuffer: async () =>
    fakeMp3.buffer.slice(fakeMp3.byteOffset, fakeMp3.byteOffset + fakeMp3.length),
});

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: "narration" });
  await StoryAudio.init();

  const user = await User.create({ username: "lea", passwordHash: "x" });
  const other = await User.create({ username: "tom", passwordHash: "x" });
  token = jwt.sign({ id: user._id.toString() }, process.env.ACCESS_TOKEN_SECRET);
  otherToken = jwt.sign({ id: other._id.toString() }, process.env.ACCESS_TOKEN_SECRET);
});

beforeEach(() => {
  global.fetch = jest.fn(async () => mp3Response());
});

afterAll(async () => {
  global.fetch = realFetch;
  await mongoose.disconnect();
  await mongoServer.stop();
});

const auth = (t = token) => ({ Authorization: `Bearer ${t}` });

const createStory = async (text = "Es war einmal ein kleiner Fuchs.") => {
  const res = await request(app)
    .post("/api/stories")
    .set(auth())
    .send({ title: "Der Fuchs", text })
    .expect(201);
  return res.body._id;
};

describe("story narration", () => {
  it("records the story once with ElevenLabs and then serves it from the cache", async () => {
    const id = await createStory();

    const first = await request(app)
      .get(`/api/stories/${id}/narration?voice=female`)
      .set(auth())
      .buffer(true)
      .parse(binaryParser)
      .expect(200)
      .expect("Content-Type", "audio/mpeg");
    expect(first.body.equals(fakeMp3)).toBe(true);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain("/v1/text-to-speech/hSzY2zmYNQPukJaIll7k");
    expect(options.headers["xi-api-key"]).toBe("test-eleven-key");
    const body = JSON.parse(options.body);
    expect(body.model_id).toBe("eleven_multilingual_v2");
    expect(body.text).toBe("Der Fuchs\n\nEs war einmal ein kleiner Fuchs.");

    await request(app)
      .get(`/api/stories/${id}/narration?voice=female`)
      .set(auth())
      .expect(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // The other voice is a new recording.
    await request(app)
      .get(`/api/stories/${id}/narration?voice=male`)
      .set(auth())
      .expect(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[1][0]).toContain("yYTemNXovAWXGGqLADJf");
    expect(await StoryAudio.countDocuments({ storyId: id })).toBe(2);
  });

  it("records only once when play is pressed twice at the same time", async () => {
    const id = await createStory("Zwei Klicks auf einmal.");

    await Promise.all([
      request(app).get(`/api/stories/${id}/narration?voice=male`).set(auth()).expect(200),
      request(app).get(`/api/stories/${id}/narration?voice=male`).set(auth()).expect(200),
    ]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("only lets the owner listen", async () => {
    const id = await createStory();

    await request(app).get(`/api/stories/${id}/narration?voice=female`).expect(401);
    await request(app)
      .get(`/api/stories/${id}/narration?voice=female`)
      .set(auth(otherToken))
      .expect(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects unknown voices", async () => {
    const id = await createStory();
    const res = await request(app)
      .get(`/api/stories/${id}/narration?voice=robot`)
      .set(auth())
      .expect(400);
    expect(res.body.error).toEqual(expect.any(String));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("turns an exhausted ElevenLabs quota into a readable error", async () => {
    const id = await createStory("Kein Guthaben mehr.");
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ detail: { status: "quota_exceeded", message: "..." } }),
    }));

    const res = await request(app)
      .get(`/api/stories/${id}/narration?voice=female`)
      .set(auth())
      .expect(503);
    expect(res.body.error).toMatch(/Kontingent/);
    expect(await StoryAudio.countDocuments({ storyId: id })).toBe(0);
  });

  it("answers 503 when no ElevenLabs key is configured", async () => {
    const id = await createStory("Ohne Schlüssel.");
    const key = process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;
    try {
      await request(app)
        .get(`/api/stories/${id}/narration?voice=female`)
        .set(auth())
        .expect(503);
    } finally {
      process.env.ELEVENLABS_API_KEY = key;
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("deletes the recordings together with the story", async () => {
    const id = await createStory("Bald gelöscht.");
    await request(app)
      .get(`/api/stories/${id}/narration?voice=female`)
      .set(auth())
      .expect(200);
    expect(await StoryAudio.countDocuments({ storyId: id })).toBe(1);

    await request(app).delete(`/api/stories/${id}`).set(auth()).expect(200);
    expect(await StoryAudio.countDocuments({ storyId: id })).toBe(0);
  });
});

describe("narration text", () => {
  it("reads the title and every section without Markdown", () => {
    expect(
      buildNarrationText({
        title: "**Der Mond**",
        content: [{ text: "# Teil eins\nDer Mond *lacht*." }, { text: "Ende." }],
      }),
    ).toBe("Der Mond\n\nTeil eins\n\nDer Mond lacht.\n\nEnde.");
  });

  it("splits long text at paragraphs and sentences within the limit", () => {
    const chunks = splitText(`${"a".repeat(20)}\n\n${"Satz eins. Satz zwei! ".repeat(3)}`, 30);
    expect(chunks.every((chunk) => chunk.length <= 30)).toBe(true);
    expect(chunks[0]).toBe("a".repeat(20));
    expect(chunks.join(" ")).toContain("Satz zwei!");
  });
});
