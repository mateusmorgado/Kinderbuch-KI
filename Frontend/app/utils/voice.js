import { getToken, handleExpiredSession, isAuthError } from "./auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

const authHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const request = async (path, options = {}) => {
  const res = await fetch(`${API_BASE_URL}/api/voice${path}`, {
    ...options,
    headers: { ...authHeaders(), ...options.headers },
  });
  if (isAuthError(res.status)) {
    handleExpiredSession();
    throw new Error("Sitzung abgelaufen, bitte erneut einloggen.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Das hat leider nicht geklappt.");
  return data;
};

const toDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

// Resolves with { voice, consentVersion }; voice is null when there is none.
export const getVoice = () => request("");

// Sends the recording to be cloned. Resolves with the new voice.
export async function cloneVoice({ name, recording, consentVersion }) {
  const audio = await toDataUrl(recording);
  const data = await request("", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, consent: true, consentVersion, audio }),
  });
  return data.voice;
}

export async function deleteVoice() {
  await request("", { method: "DELETE" });
}

// Guests: clones the voice for one story and resolves with that story read
// aloud as an MP3 Blob. The voice is deleted again right after.
export async function tryVoice({ recording, consentVersion, title, text }) {
  const audio = await toDataUrl(recording);
  const res = await fetch(`${API_BASE_URL}/api/voice/trial`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ consent: true, consentVersion, audio, title, text }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Das hat leider nicht geklappt.");
  }
  return res.blob();
}
