import { cloneVoice, deleteVoice } from "../app/utils/voice";

afterEach(() => {
  delete global.fetch;
});

describe("voice utils", () => {
  it("sends the recording with consent and resolves with the voice", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({ voice: { name: "Papa" } }),
    }));

    const recording = new Blob(["abc"], { type: "audio/webm" });
    await expect(
      cloneVoice({ name: "Papa", recording, consentVersion: "v1" }),
    ).resolves.toEqual({ name: "Papa" });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/api\/voice$/);
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({
      name: "Papa",
      consent: true,
      consentVersion: "v1",
      audio: "data:audio/webm;base64,YWJj",
    });
  });

  it("rejects with the server's message", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ error: "Stimmen-Klonen ist nicht freigeschaltet." }),
    }));
    await expect(deleteVoice()).rejects.toThrow("Stimmen-Klonen ist nicht freigeschaltet.");
  });
});
