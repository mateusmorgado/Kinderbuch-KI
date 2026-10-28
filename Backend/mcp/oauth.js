// The OAuth server that lets Claude, ChatGPT and other MCP apps act for a
// Kinderbuch user. The MCP SDK's mcpAuthRouter handles the protocol
// (metadata, client registration, PKCE, token requests); this file stores
// clients, codes and tokens in MongoDB and shows the login page.
const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  InvalidGrantError,
  InvalidTargetError,
  InvalidTokenError,
} = require("@modelcontextprotocol/sdk/server/auth/errors.js");
const User = require("../models/User");
const { OAuthClient, OAuthGrant } = require("../models/OAuth");
const { authLimiter } = require("../middleware/rateLimit");
const { logger } = require("../middleware/logging");

const SCOPE = "stories";
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const REFRESH_TOKEN_TTL_MS = 60 * 24 * 60 * 60 * 1000;
const CODE_TTL_MS = 5 * 60 * 1000;
const LOGIN_REQUEST_TTL = "15m";
const ACCESS_AUDIENCE_PREFIX = "mcp:";
const LOGIN_REQUEST_AUDIENCE = "oauth-login";

// MCP tokens use their own key, derived from the login secret, so they are
// never accepted by the website's API and the other way round.
const secret = () =>
  crypto.createHmac("sha256", process.env.ACCESS_TOKEN_SECRET).update("mcp-oauth").digest();
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const randomToken = () => crypto.randomBytes(32).toString("base64url");
const sameUrl = (a, b) => a.replace(/\/+$/, "") === b.replace(/\/+$/, "");

const clientsStore = {
  async getClient(clientId) {
    const client = await OAuthClient.findOne({ clientId }).lean();
    return client?.info;
  },
  async registerClient(info) {
    const full = {
      ...info,
      client_id: crypto.randomUUID(),
      client_id_issued_at: Math.floor(Date.now() / 1000),
    };
    await OAuthClient.create({ clientId: full.client_id, info: full });
    logger.info(`OAuth client registered: ${full.client_name || full.client_id}`);
    return full;
  },
};

// Issues a short-lived access token (a JWT the MCP endpoint can check
// without a database call) and a long-lived, rotating refresh token.
const issueTokens = async ({ clientId, userId, scopes, resource }) => {
  const user = await User.findById(userId).lean();
  if (!user) throw new InvalidGrantError("The account no longer exists");

  const accessToken = jwt.sign(
    { sub: userId, username: user.username, name: user.displayName, client_id: clientId, scope: scopes.join(" ") },
    secret(),
    { audience: ACCESS_AUDIENCE_PREFIX + resource, expiresIn: ACCESS_TOKEN_TTL_SECONDS },
  );

  const refreshToken = randomToken();
  await OAuthGrant.create({
    kind: "refresh",
    tokenHash: hash(refreshToken),
    clientId,
    userId,
    scopes,
    resource,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });

  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: scopes.join(" "),
  };
};

// Creates the provider for one MCP endpoint URL. Tokens are bound to that
// URL, so a token for another server is never accepted here.
const createOAuthProvider = (mcpUrl) => {
  const defaultResource = mcpUrl.href;

  return {
    clientsStore,

    // Shows the login page. Its form carries the already validated request
    // as a signed token, so the login handler can trust it.
    async authorize(client, params, res) {
      if (params.resource && !sameUrl(params.resource.href, defaultResource)) {
        throw new InvalidTargetError("This server only issues tokens for its MCP endpoint");
      }
      const loginRequest = jwt.sign(
        {
          clientId: client.client_id,
          redirectUri: params.redirectUri,
          state: params.state,
          codeChallenge: params.codeChallenge,
          scopes: params.scopes?.length ? params.scopes : [SCOPE],
          resource: defaultResource,
        },
        secret(),
        { audience: LOGIN_REQUEST_AUDIENCE, expiresIn: LOGIN_REQUEST_TTL },
      );
      res.status(200).type("html").send(
        renderLoginPage({ clientName: client.client_name, loginRequest }),
      );
    },

    async challengeForAuthorizationCode(client, code) {
      const grant = await OAuthGrant.findOne({
        kind: "code",
        tokenHash: hash(code),
        clientId: client.client_id,
      }).lean();
      if (!grant || grant.expiresAt < new Date()) {
        throw new InvalidGrantError("Invalid or expired authorization code");
      }
      return grant.codeChallenge;
    },

    async exchangeAuthorizationCode(client, code, codeVerifier, redirectUri) {
      // Deleting while reading makes each code usable exactly once.
      const grant = await OAuthGrant.findOneAndDelete({
        kind: "code",
        tokenHash: hash(code),
        clientId: client.client_id,
      }).lean();
      if (!grant || grant.expiresAt < new Date()) {
        throw new InvalidGrantError("Invalid or expired authorization code");
      }
      if (redirectUri && redirectUri !== grant.redirectUri) {
        throw new InvalidGrantError("redirect_uri does not match the authorization request");
      }
      return issueTokens({
        clientId: client.client_id,
        userId: grant.userId,
        scopes: grant.scopes,
        resource: grant.resource,
      });
    },

    async exchangeRefreshToken(client, refreshToken) {
      const grant = await OAuthGrant.findOneAndDelete({
        kind: "refresh",
        tokenHash: hash(refreshToken),
        clientId: client.client_id,
      }).lean();
      if (!grant || grant.expiresAt < new Date()) {
        throw new InvalidGrantError("Invalid or expired refresh token");
      }
      return issueTokens({
        clientId: client.client_id,
        userId: grant.userId,
        scopes: grant.scopes,
        resource: grant.resource,
      });
    },

    async verifyAccessToken(token) {
      try {
        const payload = jwt.verify(token, secret(), {
          audience: ACCESS_AUDIENCE_PREFIX + defaultResource,
        });
        return {
          token,
          clientId: payload.client_id,
          scopes: payload.scope ? payload.scope.split(" ") : [],
          expiresAt: payload.exp,
          resource: new URL(defaultResource),
          extra: { userId: payload.sub, username: payload.username, name: payload.name },
        };
      } catch {
        throw new InvalidTokenError("Invalid or expired access token");
      }
    },

    // Access tokens expire within the hour; revoking removes the refresh token.
    async revokeToken(client, { token }) {
      await OAuthGrant.deleteOne({
        kind: "refresh",
        tokenHash: hash(token),
        clientId: client.client_id,
      });
    },
  };
};

const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );

const frontendUrl = () =>
  (process.env.FRONTEND_URL || "https://kinderbuch-ki.vercel.app").replace(/\/+$/, "");

const renderLoginPage = ({ clientName, loginRequest, error = "", username = "" }) => `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Mit Kinderbuch KI verbinden</title>
<style>
  :root { color-scheme: light dark; --bg: #fff8ec; --card: #ffffff; --text: #3b2a1a; --muted: #7a6450; --accent: #f28c28; --border: #f1dcc0; --error: #b42318; }
  @media (prefers-color-scheme: dark) { :root { --bg: #1d1712; --card: #2a221b; --text: #f7ead9; --muted: #c4ae96; --border: #4a3b2e; --error: #ff8a80; } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; background: var(--bg); color: var(--text); font-family: ui-rounded, "Nunito", system-ui, sans-serif; }
  main { width: 100%; max-width: 380px; background: var(--card); border: 2px solid var(--border); border-radius: 24px; padding: 28px; }
  h1 { font-size: 1.4rem; margin: 0 0 8px; }
  p { color: var(--muted); line-height: 1.45; margin: 0 0 20px; }
  label { display: block; font-weight: 700; margin: 14px 0 6px; }
  input { width: 100%; padding: 12px 14px; border-radius: 12px; border: 2px solid var(--border); background: transparent; color: inherit; font: inherit; }
  input:focus { outline: none; border-color: var(--accent); }
  .actions { display: flex; flex-direction: row-reverse; gap: 10px; margin-top: 22px; }
  button { flex: 1; padding: 12px; border-radius: 999px; border: 2px solid var(--accent); font: inherit; font-weight: 800; cursor: pointer; }
  .primary { background: var(--accent); color: #fff; }
  .secondary { background: transparent; color: var(--text); border-color: var(--border); }
  .error { color: var(--error); font-weight: 700; margin: 0 0 12px; }
  .small { font-size: 0.9rem; margin: 18px 0 0; }
  a { color: var(--accent); }
</style>
</head>
<body>
<main>
  <h1>✨ Mit Kinderbuch KI verbinden</h1>
  <p><strong>${escapeHtml(clientName || "Eine App")}</strong> möchte für dich Geschichten schreiben, illustrieren und in deinem Konto speichern.</p>
  ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}
  <form method="post" action="/oauth/login">
    <input type="hidden" name="request" value="${escapeHtml(loginRequest)}">
    <label for="username">Benutzername</label>
    <input id="username" name="username" autocomplete="username" required value="${escapeHtml(username)}">
    <label for="password">Passwort</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required>
    <div class="actions">
      <!-- "Erlauben" comes first so the Enter key picks it. -->
      <button class="primary" type="submit" name="decision" value="allow">Erlauben</button>
      <button class="secondary" type="submit" name="decision" value="deny" formnovalidate>Abbrechen</button>
    </div>
  </form>
  <p class="small">Noch kein Konto? <a href="${escapeHtml(frontendUrl())}/register" target="_blank" rel="noopener">Hier registrieren</a> und danach erneut verbinden.</p>
</main>
</body>
</html>`;

const redirectWith = (res, redirectUri, params) => {
  const url = new URL(redirectUri);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  res.redirect(302, url.href);
};

// Handles the login form: checks the password and sends the app back to its
// redirect URI with a one-time authorization code.
const loginRouter = express.Router();
loginRouter.post(
  "/oauth/login",
  express.urlencoded({ extended: false }),
  authLimiter,
  async (req, res, next) => {
    try {
      let request;
      try {
        request = jwt.verify(String(req.body.request || ""), secret(), {
          audience: LOGIN_REQUEST_AUDIENCE,
        });
      } catch {
        return res
          .status(400)
          .type("html")
          .send("<p>Diese Anmeldung ist abgelaufen. Bitte starte die Verbindung erneut.</p>");
      }

      if (req.body.decision === "deny") {
        return redirectWith(res, request.redirectUri, {
          error: "access_denied",
          error_description: "The user denied the request",
          state: request.state,
        });
      }

      const username = String(req.body.username || "").trim().toLowerCase();
      const user = username ? await User.findOne({ username }).lean() : null;
      const valid =
        user && (await bcrypt.compare(String(req.body.password || ""), user.passwordHash));
      if (!valid) {
        const client = await clientsStore.getClient(request.clientId);
        return res.status(401).type("html").send(
          renderLoginPage({
            clientName: client?.client_name,
            loginRequest: req.body.request,
            error: "Benutzername oder Passwort ist falsch.",
            username,
          }),
        );
      }

      const code = randomToken();
      await OAuthGrant.create({
        kind: "code",
        tokenHash: hash(code),
        clientId: request.clientId,
        userId: user._id.toString(),
        scopes: request.scopes,
        resource: request.resource,
        codeChallenge: request.codeChallenge,
        redirectUri: request.redirectUri,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      });

      logger.info(`User ${user.username} connected OAuth client ${request.clientId}`);
      redirectWith(res, request.redirectUri, { code, state: request.state });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = { SCOPE, createOAuthProvider, loginRouter };
