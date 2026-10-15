const mongoose = require("mongoose");

// A generated story illustration stored directly in MongoDB. Kept in its own
// collection so listing stories never loads the image bytes.
const StoryImageSchema = new mongoose.Schema(
  {
    // Random, unguessable key used in the public image URL.
    key: {
      type: String,
      required: true,
      unique: true,
    },
    storyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Story",
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    data: {
      type: Buffer,
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("StoryImage", StoryImageSchema);
