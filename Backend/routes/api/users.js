const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../../models/User");
const Story = require("../../models/Story");
const { deleteStoryWithImages } = require("../../services/stories");
const { deleteClonedVoice } = require("../../services/voiceClone");
const { USERNAME_REGEX } = User;
const authMiddleware = require("../../middleware/authMiddleware");
const { logger } = require("../../middleware/logging");
const { registerLimiter } = require("../../middleware/rateLimit");
const { issueAccessToken } = require("../../services/tokens");

const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 72; // bcrypt ignores everything after 72 bytes

// Users may only read or change their own account.
const ownAccountOnly = (req, res, next) => {
    if (req.params.id !== req.user.id) {
        return res.status(403).json({ error: "Not allowed to access this user." });
    }
    next();
};

// Get the logged-in user
router.get("/", authMiddleware, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select("-passwordHash");
        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }
        res.status(200).json([user]);
    } catch (error) {
        next(error);
    }
});

// Get user by ID (own account only)
router.get("/:id", authMiddleware, ownAccountOnly, async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(404).json({ error: "User not found." });
        }

        const user = await User.findById(req.params.id)
            .select("-passwordHash")
            .populate("createdStories");

        if (!user) {
            logger.warn(`User with ID ${req.params.id} not found`);
            return res.status(404).json({ error: "User not found." });
        }

        logger.info(`Fetched user ${req.params.id} - ${user.username}`);
        res.status(200).json(user);
    } catch (error) {
        next(error);
    }
});

// Create a new user (username + password)
router.post("/", registerLimiter, async (req, res, next) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            logger.warn("User creation failed - Missing fields");
            return res.status(400).json({ error: "Username and password are required." });
        }

        const sanitizedUsername = String(username).trim().toLowerCase();

        if (!USERNAME_REGEX.test(sanitizedUsername)) {
            logger.warn(`User creation failed - Invalid username: ${sanitizedUsername}`);
            return res.status(400).json({
                error: "Username must be 3-30 characters (letters, numbers, . _ -).",
            });
        }

        const passwordText = String(password);
        if (passwordText.length < MIN_PASSWORD_LENGTH || passwordText.length > MAX_PASSWORD_LENGTH) {
            return res.status(400).json({
                error: `Password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters long.`,
            });
        }

        const existingUser = await User.findOne({ username: sanitizedUsername }).lean();
        if (existingUser) {
            logger.warn(`User creation failed - Username already exists: ${sanitizedUsername}`);
            return res.status(400).json({ error: "Username is already taken." });
        }

        // Hash the password before saving it to the database
        const hashedPassword = await bcrypt.hash(passwordText, 10);

        const newUser = new User({
            username: sanitizedUsername,
            passwordHash: hashedPassword,
            displayName: sanitizedUsername,
        });

        await newUser.save();

        logger.info(`New user created: ${sanitizedUsername}`);

        const accessToken = issueAccessToken(newUser);

        res.status(201).json({
            message: "User registered successfully",
            accessToken,
            user: {
                id: newUser._id,
                displayName: newUser.displayName,
                username: newUser.username,
            },
        });
    } catch (error) {
        logger.error(`User creation error: ${error.message}`);
        next(error);
    }
});


// Update the display name / kids' names of your own account
router.put("/:id", authMiddleware, ownAccountOnly, async (req, res, next) => {
    try {
        const updates = {};
        if (typeof req.body.displayName === "string") {
            updates.displayName = req.body.displayName.trim().slice(0, 60);
        }
        if (Array.isArray(req.body.kidsNames)) {
            updates.kidsNames = req.body.kidsNames
                .filter((name) => typeof name === "string")
                .map((name) => name.trim().slice(0, 60));
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true }
        ).select("-passwordHash");

        if (!updatedUser) {
            logger.warn(`User update failed - ID ${req.params.id} not found`);
            return res.status(404).json({ error: "User not found." });
        }

        logger.info(`User updated: ${req.params.id}`);
        res.status(200).json(updatedUser);
    } catch (error) {
        next(error);
    }
});

// Delete your own account, with all of its stories, images and cloned voice
router.delete("/:id", authMiddleware, ownAccountOnly, async (req, res, next) => {
    try {
        const stories = await Story.find({ userId: req.params.id });
        for (const story of stories) {
            await deleteStoryWithImages(story);
        }

        const user = await User.findById(req.params.id).lean();
        await deleteClonedVoice(user).catch((error) => {
            logger.error(`Could not delete cloned voice of user ${req.params.id}: ${error.message}`);
        });

        const deletedUser = await User.findByIdAndDelete(req.params.id);

        if (!deletedUser) {
            logger.warn(`User deletion failed - ID ${req.params.id} not found`);
            return res.status(404).json({ error: "User not found." });
        }

        logger.info(`User deleted: ${req.params.id}`);
        res.status(200).json({ message: "User deleted successfully." });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
