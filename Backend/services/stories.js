const mongoose = require("mongoose");
const Story = require("../models/Story");
const User = require("../models/User");
const storage = require("./storage");
const narration = require("./narration");
const { logger } = require("../middleware/logging");

// Deletes a story together with its stored images and recordings. A failed image delete is
// logged but never keeps the story itself from being removed.
const deleteStoryWithImages = async (story) => {
  await Promise.all(
    story.content
      .filter((section) => section.imagePath)
      .map((section) =>
        storage.deleteImage(section.imagePath).catch((error) => {
          logger.error(`Could not delete image ${section.imagePath}: ${error.message}`);
        }),
      ),
  );
  await storage.deleteStoryImages(story._id).catch((error) => {
    logger.error(`Could not delete images of story ${story._id}: ${error.message}`);
  });

  await narration.deleteStoryAudio(story._id).catch((error) => {
    logger.error(`Could not delete audio of story ${story._id}: ${error.message}`);
  });

  await Story.findByIdAndDelete(story._id);
};

const MAX_TITLE_LENGTH = 120;

const buildTitle = (title, prompt) => {
  const candidate =
    (typeof title === "string" && title.trim()) ||
    (typeof prompt === "string" && prompt.trim().split(/[.!?\n]/)[0]) ||
    "Deine Geschichte";
  return candidate.slice(0, MAX_TITLE_LENGTH);
};

// Saves a new story for the user. `scenes` are already validated { text }.
const createStory = async ({ userId, title, prompt, scenes }) => {
  const story = await Story.create({
    userId,
    title: buildTitle(title, prompt),
    prompt: typeof prompt === "string" ? prompt.trim().slice(0, 2000) : "",
    content: scenes.map((scene, index) => ({ id: index + 1, text: scene.text })),
  });

  await User.findByIdAndUpdate(userId, {
    $push: { createdStories: story._id },
  });
  return story;
};

// Stores a generated image for the user's story. Never throws: the image is
// still returned to the client when saving fails.
const saveImageToStory = async ({ user, storyId, image }) => {
  if (!storyId) return { saved: false };
  if (!user) return { saved: false, saveError: "not-logged-in" };

  try {
    if (!mongoose.isValidObjectId(storyId)) {
      return { saved: false, saveError: "story-not-found" };
    }

    const story = await Story.findOne({ _id: storyId, userId: user.id });
    if (!story) return { saved: false, saveError: "story-not-found" };

    const parsed = storage.parseDataUrl(image);
    if (!parsed) return { saved: false, saveError: "invalid-image" };

    const imagePath = await storage.saveStoryImage({
      userId: user.id,
      storyId: story._id.toString(),
      ...parsed,
    });

    // The illustration belongs to the final scene of the story.
    const section = story.content[story.content.length - 1];
    const previousImagePath = section.imagePath;
    section.imagePath = imagePath;
    section.image = "";
    await story.save();

    // Awaited so the old image is gone when the response is sent; a failed
    // delete is only logged.
    if (previousImagePath) {
      await storage.deleteImage(previousImagePath).catch((error) => {
        logger.error(`Could not delete old image ${previousImagePath}: ${error.message}`);
      });
    }

    logger.info(`Image saved for story ${story._id}: ${imagePath}`);
    return { saved: true, storyId: story._id.toString() };
  } catch (error) {
    logger.error(`Saving image failed: ${error.message}`);
    return { saved: false, saveError: "storage-failed" };
  }
};

module.exports = { MAX_TITLE_LENGTH, buildTitle, createStory, deleteStoryWithImages, saveImageToStory };
