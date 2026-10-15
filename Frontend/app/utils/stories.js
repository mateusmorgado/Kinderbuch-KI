import {
  clearSession,
  getToken,
  handleExpiredSession,
  isAuthError,
} from "./auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// Returns the Authorization header for the logged-in user (or nothing).
function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function isLoggedIn() {
  return Object.keys(authHeaders()).length > 0;
}

// Writes a story and calls onText with each new piece as Gemini writes it.
// Resolves with the whole story; rejects with a readable Error.
export async function streamStory({ prompt, onText, signal }) {
  const res = await fetch(`${API_BASE_URL}/api/contents/generate-stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ prompt }),
    signal,
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Geschichte konnte nicht generiert werden!");
  }

  // The answer is newline-delimited JSON: text pieces, then done or error.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let story = "";
  let finished = false;

  const handleLine = (line) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === "text") {
      story += event.text;
      onText?.(story);
    } else if (event.type === "error") {
      throw new Error(event.error);
    } else if (event.type === "done") {
      finished = true;
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    lines.forEach(handleLine);
  }
  handleLine(buffer + decoder.decode());

  if (!finished) {
    throw new Error("Die Verbindung wurde unterbrochen. Bitte versuche es erneut.");
  }
  return story.trim();
}

// Saves a generated story to the logged-in user's library.
export async function saveStory({ prompt, text }) {
  const res = await fetch(`${API_BASE_URL}/api/stories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ prompt, text }),
  });
  const data = await res.json();
  if (!res.ok) {
    // The login has expired: the story is still shown, just not saved.
    if (isAuthError(res.status)) clearSession();
    throw new Error(data.error || "Geschichte konnte nicht gespeichert werden!");
  }
  return data;
}

// When `storyId` is given and the user is logged in, the backend also stores
// the image in the cloud bucket and attaches it to that story.
export async function generateStoryImage({ paragraph, storyId }) {
  const res = await fetch(`${API_BASE_URL}/api/contents/generate-image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ paragraph, storyId }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Bild konnte nicht erstellt werden!");
  }
  return data;
}

// Deletes one of the user's stories. An expired login goes back to /login.
export async function deleteStory(storyId) {
  const res = await fetch(`${API_BASE_URL}/api/stories/${storyId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (isAuthError(res.status)) {
    handleExpiredSession();
    throw new Error("Sitzung abgelaufen, bitte erneut einloggen.");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Geschichte konnte nicht gelöscht werden!");
  }
}
