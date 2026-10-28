const mongoose = require("mongoose");

// A story read aloud by an ElevenLabs voice. Kept so the same story and voice
// is only generated (and billed) once. Like StoryImage it lives in its own
// collection so listing stories never loads the audio bytes.
const StoryAudioSchema = new mongoose.Schema(
  {
    storyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Story",
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    // ElevenLabs voice and model the audio was made with, plus a hash of the
    // narrated text. Changing any of them means a new recording.
    voiceId: {
      type: String,
      required: true,
    },
    modelId: {
      type: String,
      required: true,
    },
    textHash: {
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

StoryAudioSchema.index(
  { storyId: 1, voiceId: 1, modelId: 1, textHash: 1 },
  { unique: true },
);

module.exports = mongoose.model("StoryAudio", StoryAudioSchema);
