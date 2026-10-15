const express = require("express");
const router = express.Router();
const storage = require("../../services/storage");

// Serves a story image stored in MongoDB. The key is random and only handed
// out to the story's owner, so the URL works in a plain <img> tag without a
// login header, like a signed URL. A new image always gets a new key, so the
// response can be cached for good.
router.get("/:key", async (req, res, next) => {
  try {
    const image = await storage.findImageByKey(req.params.key);
    if (!image) {
      return res.status(404).json({ error: "Image not found." });
    }

    res.set({
      "Content-Type": image.mimeType,
      "Cache-Control": "private, max-age=31536000, immutable",
    });
    res.send(image.data.buffer ? Buffer.from(image.data.buffer) : image.data);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
