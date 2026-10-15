const express = require("express");
const helmet = require("helmet");
const connectDB = require("./config/db");
const cors = require("cors");
const { buildCorsOptions } = require("./config/cors");

require("dotenv").config();

// Import middleware
const {
  requestLogger,
  errorLogger,
  errorHandler,
  logger,
} = require("./middleware/logging");

// Import general routes
const generalRoutes = require("./routes/index");

// Import API routes
const userRoutes = require("./routes/api/users");
const storyRoutes = require("./routes/api/stories");
const contentRoutes = require("./routes/api/contents");
const promptRoutes = require("./routes/api/prompts");
const imageRoutes = require("./routes/api/images");

const app = express();

// Cloud Run sits behind one proxy; trust it so req.ip is the client's
// address (used by the rate limits) and req.protocol is "https" when
// building public image URLs.
app.set("trust proxy", 1);

// Use Helmet for security
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Only the frontend may call the API from a browser (see config/cors.js).
app.use(cors(buildCorsOptions()));

// Express internal parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Use logging middleware
app.use(requestLogger);

// Use routes
app.use("/", generalRoutes);
app.use("/api/users", userRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/contents", contentRoutes);
app.use("/api/prompts", promptRoutes);
app.use("/api/images", imageRoutes);

// Use error logging/handling middleware
app.use(errorLogger); // Log errors
app.use(errorHandler); // Handle errors

// Start the server only when run directly (`node app.js`), so tests can
// import the app without a database or an open port.
if (require.main === module) {
  connectDB();
  const port = process.env.PORT || 8082;
  app.listen(port, () => logger.info(`Server running on port ${port}`));
}

module.exports = app;
