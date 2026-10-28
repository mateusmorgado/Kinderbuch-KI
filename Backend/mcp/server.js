// The MCP tools that Claude, ChatGPT and other MCP apps can call. Every call
// runs for the user who connected the app (see mcp/oauth.js).
const mongoose = require("mongoose");
const { z } = require("zod");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const Story = require("../models/Story");
const Prompt = require("../models/Prompt");
const gemini = require("../services/gemini");
const { createStory, saveImageToStory } = require("../services/stories");
const { logger } = require("../middleware/logging");
const { version } = require("../package.json");

const HOUR = 60 * 60 * 1000;
const MAX_IDEA_LENGTH = 2000;

const frontendUrl = () =>
  (process.env.FRONTEND_URL || "https://kinderbuch-ki.vercel.app").replace(/\/+$/, "");
const storyUrl = (story) => `${frontendUrl()}/story/${story._id}`;

// Gemini costs money per call, so each account gets an hourly budget, like
// the website's limits in middleware/rateLimit.js.
const createQuota = (limit) => {
  const uses = new Map();
  return (userId) => {
    const now = Date.now();
    const recent = (uses.get(userId) || []).filter((time) => now - time < HOUR);
    if (recent.length >= limit) return false;
    recent.push(now);
    uses.set(userId, recent);
    return true;
  };
};
const takeStoryQuota = createQuota(20);
const takeImageQuota = createQuota(10);

const textResult = (text, structuredContent) => ({
  content: [{ type: "text", text }],
  ...(structuredContent && { structuredContent }),
});
const errorResult = (text) => ({ content: [{ type: "text", text }], isError: true });

const storyText = (story) => story.content.map((scene) => scene.text).join("\n\n");

const findOwnedStory = async (storyId, userId) => {
  if (!mongoose.isValidObjectId(storyId)) return null;
  return Story.findOne({ _id: storyId, userId });
};

// Turns failures the user can act on into a tool error the assistant can
// read; anything else is a real server error.
const withErrors = (handler) => async (args, extra) => {
  try {
    return await handler(args, extra);
  } catch (error) {
    if (error instanceof gemini.GeminiError) return errorResult(error.message);
    logger.error(`MCP tool failed: ${error.stack}`);
    throw error;
  }
};

// Shrinks a generated illustration for the chat; the full size is saved.
const chatImage = async (dataUrl) => {
  const [, mimeType, data] = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  try {
    const sharp = require("sharp");
    const buffer = await sharp(Buffer.from(data, "base64"))
      .resize(768, 768, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    return { type: "image", mimeType: "image/jpeg", data: buffer.toString("base64") };
  } catch {
    return { type: "image", mimeType, data };
  }
};

const storyIdInput = z
  .string()
  .describe("The id of one of the user's stories, from list_my_stories or write_story.");

// A new server for each request: the endpoint is stateless and every
// request carries its own login.
const createMcpServer = () => {
  const server = new McpServer(
    { name: "kinderbuch-ki", title: "Kinderbuch KI", version },
    {
      instructions:
        "Kinderbuch KI writes short, illustrated children's stories (about 200 words) and keeps them " +
        "in the user's library at " + frontendUrl() + ". Stories are written in the language of the idea. " +
        "After write_story, offer to illustrate it with illustrate_story, and share the story link.",
    },
  );

  server.registerTool(
    "write_story",
    {
      title: "Write a story",
      description:
        "Writes a new, child-friendly story from an idea and saves it in the user's Kinderbuch library. " +
        "Returns the full story text and a link to read it in the app.",
      inputSchema: {
        idea: z
          .string()
          .min(1)
          .max(MAX_IDEA_LENGTH)
          .describe("What the story is about, e.g. 'a brave snail who wants to see the sea'. Any language."),
        title: z.string().max(120).optional().describe("Optional title. Defaults to the first sentence of the idea."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    withErrors(async ({ idea, title }, { authInfo }) => {
      const { userId } = authInfo.extra;
      if (!takeStoryQuota(userId)) {
        return errorResult("You wrote many stories in the last hour. Please try again later.");
      }

      const text = await gemini.writeStory(idea);
      const story = await createStory({ userId, title, prompt: idea, scenes: [{ text }] });
      logger.info(`MCP: story ${story._id} written for user ${userId}`);

      return textResult(`# ${story.title}\n\n${text}\n\nRead it in Kinderbuch KI: ${storyUrl(story)}`, {
        storyId: story._id.toString(),
        title: story.title,
        url: storyUrl(story),
        text,
      });
    }),
  );

  server.registerTool(
    "illustrate_story",
    {
      title: "Illustrate a story",
      description:
        "Draws a colorful picture-book illustration for the ending of one of the user's stories and saves it " +
        "with the story. Replaces an earlier illustration.",
      inputSchema: { storyId: storyIdInput },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    withErrors(async ({ storyId }, { authInfo }) => {
      const { userId } = authInfo.extra;
      const story = await findOwnedStory(storyId, userId);
      if (!story) return errorResult("No story with this id in the user's library.");
      if (!takeImageQuota(userId)) {
        return errorResult("You created many pictures in the last hour. Please try again later.");
      }

      const finalScene = story.content[story.content.length - 1].text;
      const image = await gemini.drawIllustration(finalScene);
      const saved = await saveImageToStory({ user: { id: userId }, storyId, image });

      return {
        content: [
          await chatImage(image),
          {
            type: "text",
            text: saved.saved
              ? `The illustration is saved with "${story.title}": ${storyUrl(story)}`
              : `The illustration was drawn but could not be saved (${saved.saveError}).`,
          },
        ],
      };
    }),
  );

  server.registerTool(
    "list_my_stories",
    {
      title: "List my stories",
      description: "Lists the stories in the user's Kinderbuch library, newest first.",
      inputSchema: {
        limit: z.number().int().min(1).max(50).optional().describe("How many stories to return (default 10)."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withErrors(async ({ limit = 10 }, { authInfo }) => {
      const stories = await Story.find({ userId: authInfo.extra.userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      if (!stories.length) {
        return textResult("The library is empty. Use write_story to write the first story.", { stories: [] });
      }

      const items = stories.map((story) => ({
        storyId: story._id.toString(),
        title: story.title,
        createdAt: story.createdAt.toISOString(),
        illustrated: story.content.some((scene) => scene.imagePath || scene.image),
        url: storyUrl(story),
      }));
      const lines = items.map(
        (item) => `- ${item.title} (id ${item.storyId}, ${item.createdAt.slice(0, 10)}${item.illustrated ? ", illustrated" : ""})`,
      );
      return textResult(lines.join("\n"), { stories: items });
    }),
  );

  server.registerTool(
    "read_story",
    {
      title: "Read a story",
      description: "Returns the full text of one of the user's stories.",
      inputSchema: { storyId: storyIdInput },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withErrors(async ({ storyId }, { authInfo }) => {
      const story = await findOwnedStory(storyId, authInfo.extra.userId);
      if (!story) return errorResult("No story with this id in the user's library.");
      return textResult(`# ${story.title}\n\n${storyText(story)}\n\n${storyUrl(story)}`, {
        storyId: story._id.toString(),
        title: story.title,
        url: storyUrl(story),
        text: storyText(story),
      });
    }),
  );

  server.registerTool(
    "get_story_ideas",
    {
      title: "Get story ideas",
      description: "Returns the app's hand-picked story ideas, for when the user doesn't know what to write about.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withErrors(async () => {
      const ideas = await Prompt.find().limit(20).lean();
      if (!ideas.length) return textResult("There are no saved ideas yet.", { ideas: [] });
      const items = ideas.map((idea) => ({ title: idea.title, idea: idea.prompt }));
      return textResult(items.map((item) => `- ${item.title}: ${item.idea}`).join("\n"), { ideas: items });
    }),
  );

  server.registerPrompt(
    "bedtime_story",
    {
      title: "Bedtime story",
      description: "Write and illustrate a calm bedtime story about a hero of your choice.",
      argsSchema: {
        hero: z.string().describe("Who the story is about, e.g. 'Mia and her toy dragon'."),
        place: z.string().optional().describe("Where it happens, e.g. 'on the moon'."),
      },
    },
    ({ hero, place }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Use Kinderbuch KI to write a calm, cozy bedtime story about ${hero}` +
              (place ? ` ${place}` : "") +
              ". Then illustrate it and show me the link.",
          },
        },
      ],
    }),
  );

  return server;
};

module.exports = { createMcpServer };
