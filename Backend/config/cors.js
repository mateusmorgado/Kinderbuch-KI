// Browser origins allowed to call this API. CORS_ORIGINS overrides the
// defaults with a comma-separated list, e.g. to allow a Vercel preview URL.
const DEFAULT_ORIGINS = [
  "https://kinderbuch-ki.vercel.app",
  "http://localhost:3000",
];

const parseOrigins = (value) => {
  const origins = String(value || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return origins.length ? origins : DEFAULT_ORIGINS;
};

// Options for the `cors` middleware. Requests without an Origin header
// (curl, health checks, server-to-server) are not browser requests and pass.
// Logins use a Bearer token, not cookies, so credentials stay disabled.
const buildCorsOptions = (allowedOrigins = parseOrigins(process.env.CORS_ORIGINS)) => ({
  origin: (origin, callback) => {
    callback(null, !origin || allowedOrigins.includes(origin));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
});

module.exports = { DEFAULT_ORIGINS, parseOrigins, buildCorsOptions };
