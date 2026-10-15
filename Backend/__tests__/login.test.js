const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const request = require("supertest");

process.env.ACCESS_TOKEN_SECRET = "test-secret";

jest.mock("../models/User", () => ({ findOne: jest.fn() }));
jest.mock("../config/db", () => ({ getDbStatus: () => ({ state: "connected" }) }));

const User = require("../models/User");
const routes = require("../routes/index");

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use("/", routes);

const user = {
  _id: "64b000000000000000000001",
  username: "mia",
  displayName: "Mia",
  passwordHash: bcrypt.hashSync("geheim123", 4),
};

beforeEach(() => {
  User.findOne.mockReturnValue({ lean: async () => user });
});

describe("POST /login", () => {
  it("returns an access token that lasts 7 days and sets no cookies", async () => {
    const res = await request(app)
      .post("/login")
      .set("X-Forwarded-For", "198.51.100.1")
      .send({ username: "Mia", password: "geheim123" })
      .expect(200);

    const payload = jwt.verify(res.body.accessToken, process.env.ACCESS_TOKEN_SECRET);
    expect(payload).toMatchObject({ id: user._id, username: "mia", name: "Mia" });
    expect(payload.exp - payload.iat).toBe(7 * 24 * 60 * 60);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("blocks an IP after 10 failed logins", async () => {
    for (let i = 0; i < 10; i += 1) {
      await request(app)
        .post("/login")
        .set("X-Forwarded-For", "198.51.100.2")
        .send({ username: "mia", password: "falsch" })
        .expect(401);
    }

    await request(app)
      .post("/login")
      .set("X-Forwarded-For", "198.51.100.2")
      .send({ username: "mia", password: "geheim123" })
      .expect(429);
  });

  it("no longer offers the broken refresh and logout routes", async () => {
    await request(app).post("/refresh-token").expect(404);
    await request(app).post("/logout").expect(404);
  });
});
