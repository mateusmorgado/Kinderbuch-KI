const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.ACCESS_TOKEN_SECRET = "test-secret";
process.env.ELEVENLABS_API_KEY = "test-eleven-key";
delete process.env.GCS_BUCKET_NAME;

const app = require("../app");
const User = require("../models/User");
const StoryAudio = require("../models/StoryAudio");
const { CONSENT_VERSION } = require("../services/voiceClone");

let mongoServer;
const realFetch = global.fetch;
const fakeMp3 = Buffer.from("ID3-fake-mp3-bytes");
// About 200 kB, more than express.json's default limit.
const recording = `data:audio/webm;codecs=opus;base64,${Buffer.alloc(150 * 1024, 7).toString("base64")}`;

let voiceCounter = 0;
const fakeElevenLabs = () =>
  jest.fn(async (url, options = {}) => {
    if (url.endsWith("/voices/add")) {
      voiceCounter += 1;
      return { ok: true, status: 200, json: async () => ({ voice_id: `cloned-${voiceCounter}` }) };
    }
    if (options.method === "DELETE") {
      return { ok: true, status: 200, json: async () => ({ status: "ok" }) };
    }
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () =>
        fakeMp3.buffer.slice(fakeMp3.byteOffset, fakeMp3.byteOffset + fakeMp3.length),
    };
  });

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: "voice" });
});

beforeEach(() => {
  global.fetch = fakeElevenLabs();
});

afterAll(async () => {
  global.fetch = realFetch;
  await mongoose.disconnect();
  await mongoServer.stop();
});

let userCounter = 0;
const newUser = async () => {
  userCounter += 1;
  const user = await User.create({ username: `parent${userCounter}`, passwordHash: "x" });
  const token = jwt.sign({ id: user._id.toString() }, process.env.ACCESS_TOKEN_SECRET);
  return { user, auth: { Authorization: `Bearer ${token}` } };
};

const clone = (auth, body = {}) =>
  request(app)
    .post("/api/voice")
    .set(auth)
    .send({
      name: "Papa",
      consent: true,
      consentVersion: CONSENT_VERSION,
      audio: recording,
      ...body,
    });

const callsTo = (pattern) =>
  global.fetch.mock.calls.filter(([url, options = {}]) => pattern(url, options));

describe("voice cloning", () => {
  it("refuses to clone without consent", async () => {
    const { auth } = await newUser();
    await clone(auth, { consent: false }).expect(400);
    await clone(auth, { consentVersion: "old" }).expect(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("refuses a missing or too short recording", async () => {
    const { auth } = await newUser();
    await clone(auth, { audio: undefined }).expect(400);
    await clone(auth, { audio: "data:audio/webm;base64,AAAA" }).expect(400);
    await clone(auth, { audio: "data:image/png;base64,AAAA" }).expect(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("clones the voice, stores consent and reads stories with it", async () => {
    const { user, auth } = await newUser();

    const res = await clone(auth).expect(201);
    expect(res.body.voice).toEqual({
      name: "Papa",
      createdAt: expect.any(String),
      consentAt: expect.any(String),
    });

    const [[url, options]] = callsTo((u) => u.endsWith("/voices/add"));
    expect(url).toBe("https://api.elevenlabs.io/v1/voices/add");
    expect(options.headers["xi-api-key"]).toBe("test-eleven-key");
    expect(options.body.get("files")).toBeInstanceOf(Blob);

    const stored = await User.findById(user._id).lean();
    expect(stored.clonedVoice.consentVersion).toBe(CONSENT_VERSION);
    const voiceId = stored.clonedVoice.voiceId;

    const current = await request(app).get("/api/voice").set(auth).expect(200);
    expect(current.body.voice.name).toBe("Papa");
    expect(JSON.stringify(current.body)).not.toContain(voiceId);

    const story = await request(app)
      .post("/api/stories")
      .set(auth)
      .send({ title: "Gute Nacht", text: "Schlaf gut, kleiner Bär." })
      .expect(201);
    await request(app)
      .get(`/api/stories/${story.body._id}/narration?voice=mine`)
      .set(auth)
      .expect(200);
    expect(callsTo((u) => u.includes(`/text-to-speech/${voiceId}`))).toHaveLength(1);
  });

  it("replaces the old voice when a new one is recorded", async () => {
    const { user, auth } = await newUser();
    await clone(auth).expect(201);
    const first = (await User.findById(user._id).lean()).clonedVoice.voiceId;

    await clone(auth, { name: "Papa 2" }).expect(201);
    const second = (await User.findById(user._id).lean()).clonedVoice.voiceId;
    expect(second).not.toBe(first);

    await new Promise((resolve) => setImmediate(resolve));
    expect(callsTo((u, o) => o.method === "DELETE" && u.endsWith(`/voices/${first}`))).toHaveLength(1);
  });

  it("deletes the voice at ElevenLabs together with its recordings", async () => {
    const { user, auth } = await newUser();
    await clone(auth).expect(201);
    const voiceId = (await User.findById(user._id).lean()).clonedVoice.voiceId;

    const story = await request(app)
      .post("/api/stories")
      .set(auth)
      .send({ text: "Eine Geschichte für heute Nacht." })
      .expect(201);
    await request(app)
      .get(`/api/stories/${story.body._id}/narration?voice=mine`)
      .set(auth)
      .expect(200);
    expect(await StoryAudio.countDocuments({ voiceId })).toBe(1);

    await request(app).delete("/api/voice").set(auth).expect(200);

    expect(callsTo((u, o) => o.method === "DELETE" && u.endsWith(`/voices/${voiceId}`))).toHaveLength(1);
    expect(await StoryAudio.countDocuments({ voiceId })).toBe(0);
    expect((await User.findById(user._id).lean()).clonedVoice).toBeUndefined();

    const current = await request(app).get("/api/voice").set(auth).expect(200);
    expect(current.body.voice).toBeNull();
    await request(app)
      .get(`/api/stories/${story.body._id}/narration?voice=mine`)
      .set(auth)
      .expect(404);
  });

  it("explains when the ElevenLabs plan cannot clone voices", async () => {
    const { auth } = await newUser();
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ detail: { status: "can_not_use_instant_voice_cloning" } }),
    }));

    const res = await clone(auth).expect(503);
    expect(res.body.error).toMatch(/nicht freigeschaltet/);
  });

  it("deletes the cloned voice with the account", async () => {
    const { user, auth } = await newUser();
    await clone(auth).expect(201);
    const voiceId = (await User.findById(user._id).lean()).clonedVoice.voiceId;

    await request(app).delete(`/api/users/${user._id}`).set(auth).expect(200);
    expect(callsTo((u, o) => o.method === "DELETE" && u.endsWith(`/voices/${voiceId}`))).toHaveLength(1);
  });

  it("lets guests hear one story in their voice and deletes the voice right after", async () => {
    const res = await request(app)
      .post("/api/voice/trial")
      .set("X-Forwarded-For", "203.0.113.50")
      .send({
        consent: true,
        consentVersion: CONSENT_VERSION,
        audio: recording,
        title: "Probe",
        text: "Gute Nacht, kleiner Mond.",
      })
      .buffer(true)
      .parse((response, callback) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200)
      .expect("Content-Type", "audio/mpeg");
    expect(res.body.equals(fakeMp3)).toBe(true);

    const [[, addOptions]] = callsTo((u) => u.endsWith("/voices/add"));
    expect(addOptions.body.get("name")).toMatch(/^kinderbuch-trial-/);
    const [[ttsUrl]] = callsTo((u) => u.includes("/text-to-speech/"));
    const voiceId = ttsUrl.match(/text-to-speech\/([^?]+)/)[1];
    expect(callsTo((u, o) => o.method === "DELETE" && u.endsWith(`/voices/${voiceId}`))).toHaveLength(1);
    expect(await StoryAudio.countDocuments({ voiceId })).toBe(0);
  });

  it("deletes the trial voice even when reading fails", async () => {
    const fake = fakeElevenLabs();
    global.fetch = jest.fn(async (url, options) =>
      url.includes("/text-to-speech/")
        ? { ok: false, status: 500, json: async () => ({}) }
        : fake(url, options),
    );

    await request(app)
      .post("/api/voice/trial")
      .set("X-Forwarded-For", "203.0.113.51")
      .send({ consent: true, consentVersion: CONSENT_VERSION, audio: recording, text: "Hallo." })
      .expect(502);
    expect(callsTo((u, o) => o.method === "DELETE")).toHaveLength(1);
  });

  it("refuses the guest trial without consent", async () => {
    await request(app)
      .post("/api/voice/trial")
      .set("X-Forwarded-For", "203.0.113.52")
      .send({ consent: false, audio: recording, text: "Hallo." })
      .expect(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("tells guests the consent version without a login", async () => {
    const res = await request(app).get("/api/voice").expect(200);
    expect(res.body).toEqual({ voice: null, consentVersion: CONSENT_VERSION });
  });
});
