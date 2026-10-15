/**
 * @jest-environment node
 */
import { streamStory } from "../app/utils/stories";

// A fetch response whose body delivers the given text in small pieces.
const streamingResponse = (text, { ok = true, pieceSize = 5 } = {}) => {
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  return {
    ok,
    body: {
      getReader: () => ({
        read: async () => {
          if (offset >= bytes.length) return { done: true };
          const value = bytes.slice(offset, offset + pieceSize);
          offset += pieceSize;
          return { done: false, value };
        },
      }),
    },
  };
};

const lines = (...events) => events.map((event) => `${JSON.stringify(event)}\n`).join("");

afterEach(() => {
  delete global.fetch;
});

describe("streamStory", () => {
  it("reports the growing story and resolves with all of it", async () => {
    global.fetch = jest.fn(async () =>
      streamingResponse(
        lines(
          { type: "text", text: "Es war einmal " },
          { type: "text", text: "ein Fuchs. " },
          { type: "done" },
        ),
      ),
    );
    const onText = jest.fn();

    const story = await streamStory({ prompt: "Fuchs", onText });

    expect(story).toBe("Es war einmal ein Fuchs.");
    expect(onText.mock.calls).toEqual([["Es war einmal "], ["Es war einmal ein Fuchs. "]]);
  });

  it("rejects with the error the server sends mid-stream", async () => {
    global.fetch = jest.fn(async () =>
      streamingResponse(
        lines({ type: "text", text: "Es war" }, { type: "error", error: "abgeschnitten" }),
      ),
    );

    await expect(streamStory({ prompt: "Fuchs" })).rejects.toThrow("abgeschnitten");
  });

  it("rejects when the stream ends without finishing", async () => {
    global.fetch = jest.fn(async () => streamingResponse(lines({ type: "text", text: "Es" })));

    await expect(streamStory({ prompt: "Fuchs" })).rejects.toThrow(/unterbrochen/);
  });

  it("rejects with the server's error before streaming starts", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      json: async () => ({ error: "Zu viele Anfragen" }),
    }));

    await expect(streamStory({ prompt: "Fuchs" })).rejects.toThrow("Zu viele Anfragen");
  });
});
