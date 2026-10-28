/**
 * @jest-environment node
 */
import { illustrateSavedStory, lastParagraphOf } from "../app/utils/stories";
import { handleExpiredSession } from "../app/utils/auth";

jest.mock("../app/utils/auth", () => ({
  ...jest.requireActual("../app/utils/auth"),
  getToken: () => "token",
  handleExpiredSession: jest.fn(),
}));

const story = {
  _id: "story-1",
  content: [
    { id: 1, text: "Es war einmal ein Fuchs.\n\nEr fand einen Stern." },
    { id: 2, text: "Er flog zum Mond.\nUnd schlief glücklich ein." },
  ],
};

afterEach(() => {
  delete global.fetch;
  jest.clearAllMocks();
});

describe("lastParagraphOf", () => {
  it("picks the last paragraph of the last part", () => {
    expect(lastParagraphOf(story)).toBe("Und schlief glücklich ein.");
  });

  it("is empty for a story without text", () => {
    expect(lastParagraphOf({ content: [] })).toBe("");
  });
});

describe("illustrateSavedStory", () => {
  it("draws the last scene and attaches it to the saved story", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ image: "data:image/png;base64,AA==", saved: true }),
    }));

    await expect(illustrateSavedStory(story)).resolves.toEqual({
      image: "data:image/png;base64,AA==",
      saved: true,
    });
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/api\/contents\/generate-image$/);
    expect(options.headers.Authorization).toBe("Bearer token");
    expect(JSON.parse(options.body)).toEqual({
      paragraph: "Und schlief glücklich ein.",
      storyId: "story-1",
    });
  });

  it("sends an expired login back to the login page", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ image: "data:image/png;base64,AA==", saved: false, saveError: "not-logged-in" }),
    }));

    await expect(illustrateSavedStory(story)).rejects.toThrow(/Sitzung abgelaufen/);
    expect(handleExpiredSession).toHaveBeenCalled();
  });

  it("rejects with the server's message, e.g. the rate limit", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: "Du hast in der letzten Stunde viele Bilder erstellt." }),
    }));

    await expect(illustrateSavedStory(story)).rejects.toThrow(/viele Bilder/);
  });
});
