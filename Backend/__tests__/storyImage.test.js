const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const sharp = require("sharp");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.ACCESS_TOKEN_SECRET = "test-secret";
process.env.GEMINI_API_KEY = "test-key";
delete process.env.GCS_BUCKET_NAME;

const storyRoutes = require("../routes/api/stories");
const contentRoutes = require("../routes/api/contents");
const imageRoutes = require("../routes/api/images");
const StoryImage = require("../models/StoryImage");
const User = require("../models/User");

const app = express();
app.use(express.json());
app.use("/api/stories", storyRoutes);
app.use("/api/contents", contentRoutes);
app.use("/api/images", imageRoutes);

let mongoServer;
let token;
let geminiPng;
const realFetch = global.fetch;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: "images" });

  const user = await User.create({ username: "mia", passwordHash: "x" });
  token = jwt.sign({ id: user._id.toString() }, process.env.ACCESS_TOKEN_SECRET);

  geminiPng = await sharp({
    create: { width: 1400, height: 1400, channels: 3, background: "#f0a050" },
  })
    .png()
    .toBuffer();

  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [
              { inlineData: { mimeType: "image/png", data: geminiPng.toString("base64") } },
            ],
          },
        },
      ],
    }),
  }));
});

afterAll(async () => {
  global.fetch = realFetch;
  await mongoose.disconnect();
  await mongoServer.stop();
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe("story images", () => {
  it("saves a generated image with the story and serves it back", async () => {
    const created = await request(app)
      .post("/api/stories")
      .set(auth())
      .send({ prompt: "Ein Fuchs", text: "Es war einmal.\nEnde gut, alles gut." })
      .expect(201);

    const generated = await request(app)
      .post("/api/contents/generate-image")
      .set(auth())
      .send({ paragraph: "Ende gut, alles gut.", storyId: created.body._id })
      .expect(200);

    expect(generated.body.saved).toBe(true);
    expect(generated.body.image).toMatch(/^data:image\/png;base64,/);

    const story = await request(app)
      .get(`/api/stories/${created.body._id}`)
      .set(auth())
      .expect(200);

    const { image, hasImage, imagePath } = story.body.content[0];
    expect(hasImage).toBe(true);
    expect(imagePath).toBeUndefined();
    expect(image).toMatch(/\/api\/images\/[a-f0-9]{32}$/);

    const served = await request(app)
      .get(new URL(image).pathname)
      .expect(200)
      .expect("Content-Type", "image/webp");

    const meta = await sharp(served.body).metadata();
    expect(meta.width).toBe(1024);
    expect(served.body.length).toBeLessThan(geminiPng.length);
  });

  it("replaces the old image when a new one is generated", async () => {
    const created = await request(app)
      .post("/api/stories")
      .set(auth())
      .send({ text: "Eine kurze Geschichte." })
      .expect(201);

    for (let i = 0; i < 2; i += 1) {
      await request(app)
        .post("/api/contents/generate-image")
        .set(auth())
        .send({ paragraph: "Eine kurze Geschichte.", storyId: created.body._id })
        .expect(200);
    }

    expect(await StoryImage.countDocuments({ storyId: created.body._id })).toBe(1);

    await request(app).delete(`/api/stories/${created.body._id}`).set(auth()).expect(200);
    expect(await StoryImage.countDocuments({ storyId: created.body._id })).toBe(0);
  });

  it("does not save images for anonymous users", async () => {
    const created = await request(app)
      .post("/api/stories")
      .set(auth())
      .send({ text: "Noch eine Geschichte." })
      .expect(201);

    const generated = await request(app)
      .post("/api/contents/generate-image")
      .send({ paragraph: "Noch eine Geschichte.", storyId: created.body._id })
      .expect(200);

    expect(generated.body.saved).toBe(false);
    expect(generated.body.saveError).toBe("not-logged-in");
  });

  it("returns 404 for unknown image keys", async () => {
    await request(app).get("/api/images/not-a-key").expect(404);
    await request(app).get(`/api/images/${"a".repeat(32)}`).expect(404);
  });
});
