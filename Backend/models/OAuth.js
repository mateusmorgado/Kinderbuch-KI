const mongoose = require('mongoose');

// Apps like Claude and ChatGPT that registered themselves to connect to the
// MCP server (OAuth dynamic client registration). `info` is the client
// metadata exactly as returned to the app.
const oauthClientSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      required: true,
      unique: true,
    },
    info: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true }
);

// A one-time authorization code or a refresh token. Only a SHA-256 hash of
// the value is stored. MongoDB removes the document once it expires.
const oauthGrantSchema = new mongoose.Schema({
  kind: {
    type: String,
    enum: ['code', 'refresh'],
    required: true,
  },
  tokenHash: {
    type: String,
    required: true,
    unique: true,
  },
  clientId: {
    type: String,
    required: true,
  },
  userId: {
    type: String,
    required: true,
    ref: 'User',
  },
  scopes: {
    type: [String],
    default: [],
  },
  resource: {
    type: String,
    default: '',
  },
  // Only for codes: the PKCE challenge and the redirect URI they were issued for.
  codeChallenge: String,
  redirectUri: String,
  expiresAt: {
    type: Date,
    required: true,
    expires: 0,
  },
});

module.exports = {
  OAuthClient: mongoose.model('OAuthClient', oauthClientSchema),
  OAuthGrant: mongoose.model('OAuthGrant', oauthGrantSchema),
};
