const crypto = require("crypto");
const { Storage } = require("@google-cloud/storage");

require("dotenv").config();

const SIGNED_URL_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const EXTENSIONS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

let storage = null;

// Credentials come from either GCS_CREDENTIALS_JSON (the service account key
// as JSON, handy for hosted environments) or the standard
// GOOGLE_APPLICATION_CREDENTIALS key file path.
const getStorage = () => {
  if (storage) return storage;

  const options = {};
  if (process.env.GCS_PROJECT_ID) options.projectId = process.env.GCS_PROJECT_ID;
  if (process.env.GCS_CREDENTIALS_JSON) {
    options.credentials = JSON.parse(process.env.GCS_CREDENTIALS_JSON);
  }

  storage = new Storage(options);
  return storage;
};

const isConfigured = () => Boolean(process.env.GCS_BUCKET_NAME);

const getBucket = () => getStorage().bucket(process.env.GCS_BUCKET_NAME);

// Parses a "data:image/png;base64,..." string.
const parseDataUrl = (dataUrl) => {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(
    String(dataUrl || ""),
  );
  if (!match) return null;

  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) return null;

  return { mimeType: match[1], buffer };
};

// Uploads an image for a story and returns its object name in the bucket.
const uploadStoryImage = async ({ userId, storyId, mimeType, buffer }) => {
  const extension = EXTENSIONS[mimeType] || "png";
  const objectName = `stories/${userId}/${storyId}-${crypto
    .randomBytes(6)
    .toString("hex")}.${extension}`;

  await getBucket().file(objectName).save(buffer, {
    contentType: mimeType,
    resumable: false,
    metadata: { cacheControl: "private, max-age=0" },
  });

  return objectName;
};

const getSignedUrl = async (objectName) => {
  if (!isConfigured() || !objectName) return "";

  const [url] = await getBucket()
    .file(objectName)
    .getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + SIGNED_URL_TTL_MS,
    });
  return url;
};

const deleteObject = async (objectName) => {
  if (!isConfigured() || !objectName) return;

  await getBucket().file(objectName).delete({ ignoreNotFound: true });
};

module.exports = {
  isConfigured,
  parseDataUrl,
  uploadStoryImage,
  getSignedUrl,
  deleteObject,
};
