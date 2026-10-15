const jwt = require("jsonwebtoken");

// How long a login lasts. There is no refresh token: the frontend and the
// API live on different sites, so a cookie-based refresh can't work, and the
// user simply logs in again once this expires.
const SESSION_TTL = "7d";

const issueAccessToken = (user) =>
  jwt.sign(
    { id: user._id.toString(), name: user.displayName, username: user.username },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: SESSION_TTL },
  );

module.exports = { SESSION_TTL, issueAccessToken };
