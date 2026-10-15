const crypto = require("crypto");
const { Storage } = require("@google-cloud/storage");
const StoryImage = require("../models/StoryImage");

require("dotenv").config();

// Story images are stored in MongoDB by default, so saving them needs no
// extra infrastructure. When GCS_BUCKET_NAME is set they go to that Google
// Cloud Storage bucket instead.
//
// A section's `imagePath` says where its image lives:
//   "db:<key>"           -> StoryImage document, served by GET /api/images/:key
//   anything else         -> object name inside the GCS bucket

const DB_PREFIX = "db:";
const SIGNED_URL_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_SIZE_PX = 1024;
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

const usesBucket = () => Boolean(process.env.GCS_BUCKET_NAME);

const getBackendName = () => (usesBucket() ? "gcs" : "mongodb");

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

// Gemini returns large PNGs; a WebP of at most 1024px is a fraction of the
// size and looks the same in the book. Falls back to the original image.
const compressImage = async ({ mimeType, buffer }) => {
  try {
    const sharp = require("sharp");
    const compressed = await sharp(buffer)
      .resize(MAX_IMAGE_SIZE_PX, MAX_IMAGE_SIZE_PX, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
    return { mimeType: "image/webp", buffer: compressed };
  } catch {
    return { mimeType, buffer };
  }
};

const randomKey = () => crypto.randomBytes(16).toString("hex");

// Stores an image for a story and returns the `imagePath` to keep on it.
const saveStoryImage = async ({ userId, storyId, mimeType, buffer }) => {
  const image = await compressImage({ mimeType, buffer });

  if (!usesBucket()) {
    const key = randomKey();
    await StoryImage.create({
      key,
      storyId,
      userId,
      mimeType: image.mimeType,
      data: image.buffer,
    });
    return `${DB_PREFIX}${key}`;
  }

  const extension = EXTENSIONS[image.mimeType] || "png";
  const objectName = `stories/${userId}/${storyId}-${randomKey()}.${extension}`;

  await getBucket().file(objectName).save(image.buffer, {
    contentType: image.mimeType,
    resumable: false,
    metadata: { cacheControl: "private, max-age=0" },
  });

  return objectName;
};

// Returns a URL the browser can load the image from. `baseUrl` is this
// backend's public origin, used for images stored in MongoDB.
const getImageUrl = async (imagePath, baseUrl = "") => {
  if (!imagePath) return "";

  if (imagePath.startsWith(DB_PREFIX)) {
    return `${baseUrl}/api/images/${imagePath.slice(DB_PREFIX.length)}`;
  }

  if (!usesBucket()) return "";

  const [url] = await getBucket()
    .file(imagePath)
    .getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + SIGNED_URL_TTL_MS,
    });
  return url;
};

const deleteImage = async (imagePath) => {
  if (!imagePath) return;

  if (imagePath.startsWith(DB_PREFIX)) {
    await StoryImage.deleteOne({ key: imagePath.slice(DB_PREFIX.length) });
    return;
  }

  if (!usesBucket()) return;
  await getBucket().file(imagePath).delete({ ignoreNotFound: true });
};

// This backend's public origin, e.g. https://kinderbuch.cloud.run.
// PUBLIC_API_URL overrides what is derived from the request.
const getPublicBaseUrl = (req) =>
  (process.env.PUBLIC_API_URL || `${req.protocol}://${req.get("host")}`).replace(
    /\/+$/,
    "",
  );

// Removes every MongoDB-stored image of a story.
const deleteStoryImages = (storyId) => StoryImage.deleteMany({ storyId });

// Loads a MongoDB-stored image by the key from its URL.
const findImageByKey = (key) => {
  if (!/^[a-f0-9]{32}$/.test(String(key))) return null;
  return StoryImage.findOne({ key }).lean();
};

module.exports = {
  getBackendName,
  parseDataUrl,
  saveStoryImage,
  getImageUrl,
  getPublicBaseUrl,
  deleteImage,
  deleteStoryImages,
  findImageByKey,
};
