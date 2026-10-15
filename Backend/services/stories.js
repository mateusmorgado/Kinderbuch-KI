const Story = require("../models/Story");
const storage = require("./storage");
const { logger } = require("../middleware/logging");

// Deletes a story together with its stored images. A failed image delete is
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

  await Story.findByIdAndDelete(story._id);
};

module.exports = { deleteStoryWithImages };
