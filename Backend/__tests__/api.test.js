const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.ACCESS_TOKEN_SECRET = "test-secret";
delete process.env.GCS_BUCKET_NAME;

const app = require("../app");
const Story = require("../models/Story");

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: "api" });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Every call gets its own client IP so the rate limits never interfere.
let ipCounter = 0;
const api = () => {
  ipCounter += 1;
  const ip = `192.0.2.${ipCounter}`;
  const agent = request(app);
  return {
    get: (url) => agent.get(url).set("X-Forwarded-For", ip),
    post: (url) => agent.post(url).set("X-Forwarded-For", ip),
    put: (url) => agent.put(url).set("X-Forwarded-For", ip),
    delete: (url) => agent.delete(url).set("X-Forwarded-For", ip),
  };
};

const register = async (username, password = "geheim123") => {
  const res = await api()
    .post("/api/users")
    .send({ username, password })
    .expect(201);
  return { token: res.body.accessToken, id: res.body.user.id };
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe("accounts", () => {
  it("registers a user and logs them in", async () => {
    const { id } = await register("Lina.Fuchs");

    const res = await api()
      .post("/login")
      .send({ username: "lina.fuchs", password: "geheim123" })
      .expect(200);
    expect(res.body).toMatchObject({ id, username: "lina.fuchs" });
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it("rejects taken and invalid usernames and short passwords", async () => {
    await register("taken");
    await api().post("/api/users").send({ username: "TAKEN", password: "geheim123" }).expect(400);
    await api().post("/api/users").send({ username: "a b", password: "geheim123" }).expect(400);
    await api().post("/api/users").send({ username: "kurz", password: "123" }).expect(400);
  });

  it("rejects a wrong password", async () => {
    await register("mila");
    await api().post("/login").send({ username: "mila", password: "falsch!!" }).expect(401);
  });

  it("deletes the account together with its stories", async () => {
    const { token, id } = await register("weg");
    await api().post("/api/stories").set(auth(token)).send({ text: "Es war einmal." }).expect(201);

    await api().delete(`/api/users/${id}`).set(auth(token)).expect(200);
    expect(await Story.countDocuments({ userId: id })).toBe(0);
  });
});

describe("stories", () => {
  let owner;
  let other;
  let storyId;

  beforeAll(async () => {
    owner = await register("owner");
    other = await register("other");
    const res = await api()
      .post("/api/stories")
      .set(auth(owner.token))
      .send({ prompt: "Ein Fuchs findet eine Tür. Dahinter...", text: "Es war einmal ein Fuchs." })
      .expect(201);
    storyId = res.body._id;
    expect(res.body.title).toBe("Ein Fuchs findet eine Tür");
  });

  it("needs a login", async () => {
    await api().get(`/api/stories/${storyId}`).expect(401);
    await api().get(`/api/stories/${storyId}`).set(auth("not-a-token")).expect(403);
  });

  it("lets only the owner read, rename and delete a story", async () => {
    await api().get(`/api/stories/${storyId}`).set(auth(owner.token)).expect(200);
    await api().get(`/api/stories/${storyId}`).set(auth(other.token)).expect(403);
    await api().put(`/api/stories/${storyId}`).set(auth(other.token)).send({ title: "Meins" }).expect(403);
    await api().delete(`/api/stories/${storyId}`).set(auth(other.token)).expect(403);
    await api().get(`/api/stories/user/${owner.id}`).set(auth(other.token)).expect(403);

    const list = await api().get("/api/stories").set(auth(other.token)).expect(200);
    expect(list.body).toEqual([]);
  });

  it("validates story input", async () => {
    await api().post("/api/stories").set(auth(owner.token)).send({ text: "   " }).expect(400);
    await api().put(`/api/stories/${storyId}`).set(auth(owner.token)).send({ title: "" }).expect(400);
    await api().get("/api/stories/not-an-id").set(auth(owner.token)).expect(404);
  });
});

describe("errors", () => {
  it("returns client errors like malformed JSON with their message", async () => {
    const res = await api()
      .post("/login")
      .set("Content-Type", "application/json")
      .send("{not json")
      .expect(400);
    expect(res.body.error).toEqual(expect.any(String));
    expect(res.body.error).not.toBe("Internal Server Error");
  });

  it("hides the details of server errors", async () => {
    jest.spyOn(Story, "find").mockImplementationOnce(() => {
      throw new Error("secret database detail");
    });
    const { token } = await register("errors");

    const res = await api().get("/api/stories").set(auth(token)).expect(500);
    expect(res.body).toEqual({ error: "Internal Server Error" });
  });
});
