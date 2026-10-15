const express = require("express");
const jwt = require("jsonwebtoken");
const request = require("supertest");

process.env.ACCESS_TOKEN_SECRET = "test-secret";

const optionalAuth = require("../middleware/optionalAuth");
const { imageLimiter } = require("../middleware/rateLimit");

const app = express();
app.set("trust proxy", 1);
app.post("/generate-image", optionalAuth, imageLimiter, (req, res) =>
  res.json({ ok: true }),
);

const tokenFor = (id) => jwt.sign({ id }, process.env.ACCESS_TOKEN_SECRET);

describe("generation rate limit", () => {
  it("blocks an IP after 10 images per hour with a JSON error", async () => {
    for (let i = 0; i < 10; i += 1) {
      await request(app)
        .post("/generate-image")
        .set("X-Forwarded-For", "203.0.113.1")
        .expect(200);
    }

    const res = await request(app)
      .post("/generate-image")
      .set("X-Forwarded-For", "203.0.113.1")
      .expect(429);
    expect(res.body.error).toEqual(expect.any(String));

    // Another visitor is not affected.
    await request(app)
      .post("/generate-image")
      .set("X-Forwarded-For", "203.0.113.2")
      .expect(200);
  });

  it("counts logged-in users per account, not per IP", async () => {
    const auth = { Authorization: `Bearer ${tokenFor("user-a")}` };
    for (let i = 0; i < 10; i += 1) {
      await request(app)
        .post("/generate-image")
        .set(auth)
        .set("X-Forwarded-For", "203.0.113.10")
        .expect(200);
    }
    await request(app)
      .post("/generate-image")
      .set(auth)
      .set("X-Forwarded-For", "203.0.113.11")
      .expect(429);

    await request(app)
      .post("/generate-image")
      .set({ Authorization: `Bearer ${tokenFor("user-b")}` })
      .set("X-Forwarded-For", "203.0.113.10")
      .expect(200);
  });
});
