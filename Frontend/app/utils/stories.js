import { clearSession, getToken, isAuthError } from "./auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// Returns the Authorization header for the logged-in user (or nothing).
function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function isLoggedIn() {
  return Object.keys(authHeaders()).length > 0;
}

export async function generateStory({ prompt }) {
  const res = await fetch(`${API_BASE_URL}/api/contents/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.error || "Geschichte konnte nicht generiert werden!");
  return data;
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
