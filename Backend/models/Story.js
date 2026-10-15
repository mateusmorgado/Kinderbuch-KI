const mongoose = require('mongoose');

const StorySchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      ref: 'User',
    },
    title: {
      type: String,
      required: true,
    },
    // The idea the user typed in to generate the story.
    prompt: {
      type: String,
      default: '',
    },
    content: [
      {
        id: {
          type: Number,
          required: true,
        },
        text: {
          type: String,
          required: true,
        },
        // Legacy/external image URL. Images stored in Google Cloud Storage
        // use `imagePath` instead and are exposed as a signed URL in `image`.
        image: {
          type: String,
          default: '',
        },
        // Object name inside the Google Cloud Storage bucket.
        imagePath: {
          type: String,
          default: '',
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Story', StorySchema);
