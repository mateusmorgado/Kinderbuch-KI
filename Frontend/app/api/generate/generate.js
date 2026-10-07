const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

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

export async function generateStoryImage({ paragraph }) {
  const res = await fetch(`${API_BASE_URL}/api/contents/generate-image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paragraph }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Bild konnte nicht erstellt werden!");
  }
  return data;
}
