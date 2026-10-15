require("dotenv").config();
const mongoose = require("mongoose");

const db = process.env.MONGO_URI;

mongoose.set("strictQuery", true);

// Last connection problem, reported by the public health endpoint so a
// misconfigured deployment can be diagnosed without reading server logs.
let lastError = null;

const getDbStatus = () => ({
  state: ["disconnected", "connected", "connecting", "disconnecting"][
    mongoose.connection.readyState
  ] || "unknown",
  error: lastError,
});

const connectDB = async () => {
  if (!db || db.includes("<cluster>") || db.includes("<username>")) {
    lastError = "MONGO_URI is not configured";
    console.warn("MONGO_URI is not configured; running without MongoDB.");
    return;
  }

  try {
    await mongoose.connect(db);
    lastError = null;
    console.log("MongoDB is Connected...");

    // Users used to sign up with an email address. That unique index would
    // reject every new user (all missing the field), so remove it if present.
    await mongoose.connection
      .collection("users")
      .dropIndex("email_1")
      .catch(() => {});
  } catch (err) {
    lastError = err.message;
    console.error(err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
module.exports.getDbStatus = getDbStatus;
