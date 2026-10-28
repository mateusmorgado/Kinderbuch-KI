// Mounts the MCP server at /mcp, together with the OAuth endpoints that
// Claude and ChatGPT use to log in (/authorize, /token, /register and the
// /.well-known metadata).
const express = require("express");
const { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } = require("@modelcontextprotocol/sdk/server/auth/router.js");
const { requireBearerAuth } = require("@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { createOAuthProvider, loginRouter, SCOPE } = require("./oauth");
const { createMcpServer } = require("./server");
const { getPublicBaseUrl } = require("../services/storage");
const { logger } = require("../middleware/logging");

const handleMcpRequest = async (req, res) => {
  const server = createMcpServer();
  // Stateless: no session ids, each POST is answered on its own.
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    logger.error(`MCP request failed: ${error.stack}`);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
};

const methodNotAllowed = (req, res) => {
  res.status(405).set("Allow", "POST").json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
};

// Everything that depends on the server's public URL (the OAuth issuer and
// the URL tokens are bound to).
// The routers are built on the first request for a host (see below), which
// express-rate-limit would otherwise warn about.
const sdkRateLimit = { rateLimit: { validate: { creationStack: false } } };

const buildRouter = (baseUrl) => {
  const mcpUrl = new URL("/mcp", baseUrl);
  const provider = createOAuthProvider(mcpUrl);
  const router = express.Router();

  router.use(
    mcpAuthRouter({
      provider,
      issuerUrl: new URL(baseUrl),
      resourceServerUrl: mcpUrl,
      resourceName: "Kinderbuch KI",
      scopesSupported: [SCOPE],
      serviceDocumentationUrl: new URL("https://github.com/mateusmorgado/Kinderbuch-KI#mit-claude-oder-chatgpt-verbinden"),
      authorizationOptions: sdkRateLimit,
      clientRegistrationOptions: sdkRateLimit,
      tokenOptions: sdkRateLimit,
      revocationOptions: sdkRateLimit,
    }),
  );
  router.use(loginRouter);

  const auth = requireBearerAuth({
    verifier: provider,
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpUrl),
  });
  router.post("/mcp", express.json({ limit: "1mb" }), auth, handleMcpRequest);
  router.all("/mcp", methodNotAllowed);

  return router;
};

// Without PUBLIC_API_URL the public URL comes from the request (Cloud Run
// sets the host). A handful of hosts are kept so a stream of made-up Host
// headers can't fill the memory.
const MAX_CACHED_HOSTS = 5;
const routers = new Map();

const MCP_PATHS = /^\/(mcp|authorize|token|register|revoke|oauth\/|\.well-known\/oauth-)/;

const mcpRouter = (req, res, next) => {
  if (!MCP_PATHS.test(req.path)) return next();
  const baseUrl = getPublicBaseUrl(req);
  let router = routers.get(baseUrl);
  if (!router) {
    router = buildRouter(baseUrl);
    if (routers.size < MAX_CACHED_HOSTS) routers.set(baseUrl, router);
  }
  router(req, res, next);
};

module.exports = mcpRouter;
