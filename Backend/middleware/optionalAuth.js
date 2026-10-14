const jwt = require("jsonwebtoken");
require("dotenv").config();

// Like authMiddleware, but never rejects: when a valid Bearer token is
// present `req.user` is set, otherwise the request continues anonymously.
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next();
  }

  jwt.verify(
    authHeader.substring("Bearer ".length),
    process.env.ACCESS_TOKEN_SECRET,
    (err, decoded) => {
      if (!err) req.user = decoded;
      next();
    },
  );
};

module.exports = optionalAuth;
