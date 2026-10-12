require("dotenv").config();
const mongoose = require("mongoose");

const db = process.env.MONGO_URI;

mongoose.set("strictQuery", true);

const connectDB = async () => {
  if (!db || db.includes("<cluster>") || db.includes("<username>")) {
    console.warn("MONGO_URI is not configured; running without MongoDB.");
    return;
  }

  try {
    await mongoose.connect(db);
    console.log("MongoDB is Connected...");

    // Users used to sign up with an email address. That unique index would
    // reject every new user (all missing the field), so remove it if present.
    await mongoose.connection
      .collection("users")
      .dropIndex("email_1")
      .catch(() => {});
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
