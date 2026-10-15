const express = require("express");
const cors = require("cors");
const request = require("supertest");
const { buildCorsOptions, parseOrigins, DEFAULT_ORIGINS } = require("../config/cors");

const appFor = (origins) => {
  const app = express();
  app.use(cors(buildCorsOptions(origins)));
  app.get("/", (req, res) => res.json({ ok: true }));
  return app;
};

describe("CORS", () => {
  it("uses the defaults when CORS_ORIGINS is empty", () => {
    expect(parseOrigins("")).toEqual(DEFAULT_ORIGINS);
    expect(parseOrigins(undefined)).toEqual(DEFAULT_ORIGINS);
  });

  it("parses a comma-separated list and drops trailing slashes", () => {
    expect(parseOrigins(" https://a.example/, http://localhost:3000 ")).toEqual([
      "https://a.example",
      "http://localhost:3000",
    ]);
  });

  it("allows the frontend origin", async () => {
    const res = await request(appFor(["https://kinderbuch-ki.vercel.app"]))
      .get("/")
      .set("Origin", "https://kinderbuch-ki.vercel.app");

    expect(res.headers["access-control-allow-origin"]).toBe(
      "https://kinderbuch-ki.vercel.app",
    );
    expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
  });

  it("does not allow other origins", async () => {
    const res = await request(appFor(["https://kinderbuch-ki.vercel.app"]))
      .get("/")
      .set("Origin", "https://evil.example");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("lets requests without an Origin header through", async () => {
    await request(appFor(["https://kinderbuch-ki.vercel.app"])).get("/").expect(200);
  });
});
