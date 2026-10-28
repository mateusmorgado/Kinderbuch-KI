/**
 * @jest-environment node
 */
import { fetchNarration } from "../app/utils/stories";

afterEach(() => {
  delete global.fetch;
});

describe("fetchNarration", () => {
  it("asks for the chosen voice and resolves with the audio", async () => {
    const blob = { size: 3 };
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, blob: async () => blob }));

    await expect(fetchNarration({ storyId: "abc", voice: "male" })).resolves.toBe(blob);
    expect(global.fetch.mock.calls[0][0]).toMatch(/\/api\/stories\/abc\/narration\?voice=male$/);
  });

  it("sends a guest's unsaved story in the request body", async () => {
    const blob = { size: 3 };
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, blob: async () => blob }));

    await fetchNarration({ title: "Gast", text: "Es war einmal.", voice: "female" });
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/api\/contents\/narrate$/);
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({
      title: "Gast",
      text: "Es war einmal.",
      voice: "female",
    });
  });

  it("rejects with the server's message", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ error: "Vorlesen ist auf diesem Server nicht eingerichtet." }),
    }));

    await expect(fetchNarration({ storyId: "abc", voice: "female" })).rejects.toThrow(
      "Vorlesen ist auf diesem Server nicht eingerichtet.",
    );
  });
});
