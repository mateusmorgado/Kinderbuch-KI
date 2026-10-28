const crypto = require("crypto");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.ACCESS_TOKEN_SECRET = "test-secret";
process.env.GEMINI_API_KEY = "test-key";
delete process.env.GCS_BUCKET_NAME;
delete process.env.PUBLIC_API_URL;

const app = require("../app");
const Story = require("../models/Story");

let mongoServer;
const realFetch = global.fetch;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: "mcp" });
});

afterEach(() => {
  global.fetch = realFetch;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// supertest talks to 127.0.0.1, so that is the server's public URL here.
const HOST = "127.0.0.1:8082";
const BASE_URL = `http://${HOST}`;
const MCP_URL = `${BASE_URL}/mcp`;
const REDIRECT_URI = "https://claude.ai/api/mcp/auth_callback";

// Every call gets its own client IP so the rate limits never interfere.
let ipCounter = 0;
const api = () => {
  ipCounter += 1;
  const ip = `198.51.100.${ipCounter}`;
  const agent = request(app);
  return {
    get: (url) => agent.get(url).set("Host", HOST).set("X-Forwarded-For", ip),
    post: (url) => agent.post(url).set("Host", HOST).set("X-Forwarded-For", ip),
  };
};

const register = async (username, password = "geheim123") => {
  const res = await api().post("/api/users").send({ username, password }).expect(201);
  return { token: res.body.accessToken, id: res.body.user.id };
};

const registerClient = async () => {
  const res = await api()
    .post("/register")
    .send({
      client_name: "Claude",
      redirect_uris: [REDIRECT_URI],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    })
    .expect(201);
  return res.body;
};

const pkce = () => {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
};

// Opens the login page and returns the signed request from its form.
const startAuthorization = async (client, challenge) => {
  const res = await api()
    .get("/authorize")
    .query({
      response_type: "code",
      client_id: client.client_id,
      redirect_uri: REDIRECT_URI,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state: "xyz",
      resource: MCP_URL,
    })
    .expect(200);
  expect(res.text).toContain("Claude");
  return /name="request" value="([^"]+)"/.exec(res.text)[1];
};

// Runs the whole login a user does when connecting Claude, and returns the tokens.
const connect = async (username) => {
  const client = await registerClient();
  const { verifier, challenge } = pkce();
  const loginRequest = await startAuthorization(client, challenge);

  const login = await api()
    .post("/oauth/login")
    .type("form")
    .send({ request: loginRequest, username, password: "geheim123", decision: "allow" })
    .expect(302);
  const redirect = new URL(login.headers.location);
  expect(redirect.origin + redirect.pathname).toBe(REDIRECT_URI);
  expect(redirect.searchParams.get("state")).toBe("xyz");

  const tokenRes = await api()
    .post("/token")
    .type("form")
    .send({
      grant_type: "authorization_code",
      client_id: client.client_id,
      code: redirect.searchParams.get("code"),
      code_verifier: verifier,
      redirect_uri: REDIRECT_URI,
      resource: MCP_URL,
    })
    .expect(200);
  return { client, tokens: tokenRes.body, code: redirect.searchParams.get("code"), verifier };
};

let rpcId = 0;
const rpc = (token, method, params = {}) => {
  rpcId += 1;
  const req = api()
    .post("/mcp")
    .set("Accept", "application/json, text/event-stream")
    .send({ jsonrpc: "2.0", id: rpcId, method, params });
  return token ? req.set("Authorization", `Bearer ${token}`) : req;
};
const callTool = async (token, name, args = {}) => {
  const res = await rpc(token, "tools/call", { name, arguments: args }).expect(200);
  return res.body.result;
};

const mockGeminiStory = (text) => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      candidates: [{ finishReason: "STOP", content: { parts: [{ text }] } }],
    }),
  }));
};

describe("OAuth for MCP apps", () => {
  it("publishes the metadata Claude and ChatGPT look for", async () => {
    const resource = await api().get("/.well-known/oauth-protected-resource/mcp").expect(200);
    expect(resource.body.resource).toBe(MCP_URL);
    expect(resource.body.authorization_servers).toEqual([`${BASE_URL}/`]);

    const server = await api().get("/.well-known/oauth-authorization-server").expect(200);
    expect(server.body).toMatchObject({
      authorization_endpoint: `${BASE_URL}/authorize`,
      token_endpoint: `${BASE_URL}/token`,
      registration_endpoint: `${BASE_URL}/register`,
      code_challenge_methods_supported: ["S256"],
    });
  });

  it("asks for a login with a link to the MCP metadata", async () => {
    const res = await rpc(null, "tools/list").expect(401);
    expect(res.headers["www-authenticate"]).toContain(
      `${BASE_URL}/.well-known/oauth-protected-resource/mcp`,
    );
  });

  it("issues tokens after a login and refreshes them", async () => {
    await register("oauth.user");
    const { client, tokens } = await connect("oauth.user");
    expect(tokens).toMatchObject({ token_type: "Bearer", scope: "stories" });

    const refreshed = await api()
      .post("/token")
      .type("form")
      .send({ grant_type: "refresh_token", client_id: client.client_id, refresh_token: tokens.refresh_token })
      .expect(200);
    expect(refreshed.body.access_token).toEqual(expect.any(String));

    // Refresh tokens rotate: the old one is used up.
    await api()
      .post("/token")
      .type("form")
      .send({ grant_type: "refresh_token", client_id: client.client_id, refresh_token: tokens.refresh_token })
      .expect(400);
  });

  it("uses each code only once and checks the PKCE verifier", async () => {
    await register("pkce.user");
    const { client, code, verifier } = await connect("pkce.user");

    await api()
      .post("/token")
      .type("form")
      .send({ grant_type: "authorization_code", client_id: client.client_id, code, code_verifier: verifier })
      .expect(400);

    const { challenge } = pkce();
    const loginRequest = await startAuthorization(client, challenge);
    const login = await api()
      .post("/oauth/login")
      .type("form")
      .send({ request: loginRequest, username: "pkce.user", password: "geheim123", decision: "allow" })
      .expect(302);
    await api()
      .post("/token")
      .type("form")
      .send({
        grant_type: "authorization_code",
        client_id: client.client_id,
        code: new URL(login.headers.location).searchParams.get("code"),
        code_verifier: pkce().verifier,
      })
      .expect(400);
  });

  it("shows the form again after a wrong password and lets the user cancel", async () => {
    await register("careful.user");
    const client = await registerClient();
    const loginRequest = await startAuthorization(client, pkce().challenge);

    const wrong = await api()
      .post("/oauth/login")
      .type("form")
      .send({ request: loginRequest, username: "careful.user", password: "falsch!!", decision: "allow" })
      .expect(401);
    expect(wrong.text).toContain("falsch");

    const cancel = await api()
      .post("/oauth/login")
      .type("form")
      .send({ request: loginRequest, decision: "deny" })
      .expect(302);
    expect(new URL(cancel.headers.location).searchParams.get("error")).toBe("access_denied");
  });

  it("rejects a forged login request and tokens for other servers", async () => {
    await api()
      .post("/oauth/login")
      .type("form")
      .send({ request: "forged", username: "x", password: "y" })
      .expect(400);

    const client = await registerClient();
    const res = await api()
      .get("/authorize")
      .query({
        response_type: "code",
        client_id: client.client_id,
        redirect_uri: REDIRECT_URI,
        code_challenge: pkce().challenge,
        code_challenge_method: "S256",
        resource: "https://evil.example/mcp",
      })
      .expect(302);
    expect(new URL(res.headers.location).searchParams.get("error")).toBe("invalid_target");
  });

  it("does not accept a website login at the MCP endpoint", async () => {
    const { token } = await register("website.user");
    await rpc(token, "tools/list").expect(401);
  });
});

describe("MCP tools", () => {
  let accessToken;
  let userId;

  beforeAll(async () => {
    ({ id: userId } = await register("mcp.reader"));
    ({ tokens: { access_token: accessToken } } = await connect("mcp.reader"));
  });

  it("lists the tools", async () => {
    const res = await rpc(accessToken, "tools/list").expect(200);
    expect(res.body.result.tools.map((tool) => tool.name).sort()).toEqual([
      "get_story_ideas",
      "illustrate_story",
      "list_my_stories",
      "read_story",
      "write_story",
    ]);
  });

  it("writes a story into the user's library and reads it back", async () => {
    mockGeminiStory("Es war einmal eine mutige Schnecke.");

    const written = await callTool(accessToken, "write_story", {
      idea: "Eine mutige Schnecke. Sie will ans Meer.",
    });
    expect(written.isError).toBeFalsy();
    expect(written.structuredContent).toMatchObject({
      title: "Eine mutige Schnecke",
      text: "Es war einmal eine mutige Schnecke.",
    });

    const story = await Story.findById(written.structuredContent.storyId).lean();
    expect(story.userId).toBe(userId);

    const listed = await callTool(accessToken, "list_my_stories");
    expect(listed.structuredContent.stories[0].storyId).toBe(written.structuredContent.storyId);

    const read = await callTool(accessToken, "read_story", { storyId: written.structuredContent.storyId });
    expect(read.content[0].text).toContain("mutige Schnecke");
  });

  it("does not read stories of other users", async () => {
    const { id: otherId } = await register("someone.else");
    const story = await Story.create({ userId: otherId, title: "Geheim", content: [{ id: 1, text: "Psst" }] });

    const read = await callTool(accessToken, "read_story", { storyId: story._id.toString() });
    expect(read.isError).toBe(true);
  });

  it("illustrates a story and saves the picture with it", async () => {
    const sharp = require("sharp");
    const png = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#f28c28" },
    }).png().toBuffer();
    mockGeminiStory("Der Drache schlief ein.");
    const written = await callTool(accessToken, "write_story", { idea: "Ein müder Drache" });

    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: png.toString("base64") } }] } }],
      }),
    }));
    const result = await callTool(accessToken, "illustrate_story", {
      storyId: written.structuredContent.storyId,
    });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]).toMatchObject({ type: "image", mimeType: "image/jpeg" });
    expect(result.content[1].text).toContain("saved");
  });

  it("answers the MCP handshake and offers the bedtime prompt", async () => {
    const init = await rpc(accessToken, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    }).expect(200);
    expect(init.body.result.serverInfo.name).toBe("kinderbuch-ki");

    const prompts = await rpc(accessToken, "prompts/list").expect(200);
    expect(prompts.body.result.prompts.map((prompt) => prompt.name)).toEqual(["bedtime_story"]);
  });

  it("reports Gemini failures as a tool error", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({ error: "quota" }) }));

    const result = await callTool(accessToken, "write_story", { idea: "Ein Drache" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Gemini konnte die Geschichte nicht erstellen");
  });
});
