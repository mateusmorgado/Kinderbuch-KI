const nextJest = require("next/jest");

// next/jest compiles tests with Next's own SWC setup and loads .env files.
const createJestConfig = nextJest({ dir: "./" });

module.exports = createJestConfig({
  testEnvironment: "jsdom",
});
