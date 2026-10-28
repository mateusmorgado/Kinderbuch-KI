const mongoose = require('mongoose');

// Letters, digits, dot, underscore and dash; 3-30 characters.
const USERNAME_REGEX = /^[a-z0-9._-]{3,30}$/;

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        USERNAME_REGEX,
        'Der Benutzername muss 3-30 Zeichen lang sein (Buchstaben, Zahlen, . _ -).',
      ],
    },
    passwordHash: {
      type: String,
      required: true,
    },
    displayName: {
      type: String,
      default: '',
    },
    kidsNames: {
      type: [String],
      default: [],
    },
    // A voice cloned from the user's own recording with ElevenLabs, used to
    // read their stories aloud. Only stored after the user confirmed consent.
    clonedVoice: {
      type: new mongoose.Schema(
        {
          voiceId: { type: String, required: true },
          name: { type: String, default: '' },
          consentAt: { type: Date, required: true },
          consentVersion: { type: String, required: true },
        },
        { _id: false, timestamps: true }
      ),
      default: undefined,
    },
    createdStories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Story',
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', UserSchema);
module.exports.USERNAME_REGEX = USERNAME_REGEX;
