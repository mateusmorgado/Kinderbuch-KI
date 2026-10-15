const winston = require("winston");
const expressWinston = require("express-winston");
const DailyRotateFile = require("winston-daily-rotate-file");

// Setup
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// Rotating log files only help on a machine that keeps its disk. Cloud Run
// (K_SERVICE is set there) collects console output, and tests need no files.
if (!process.env.K_SERVICE && process.env.NODE_ENV !== "test") {
  logger.add(
    new DailyRotateFile({
      filename: "logs/api-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d", // how many daily logs are stored
      zippedArchive: true, // old logs will be compressed
    }),
  );
}

const requestLogger = expressWinston.logger({
  winstonInstance: logger,
  meta: true,
  msg: "HTTP {{req.method}} {{req.url}} {{res.statusCode}}",
  expressFormat: true,
  colorize: false,
  requestFilter: (req, propName) => {
    if (propName === "headers" && req.headers.authorization) {
      req.headers.authorization = "[REDACTED]";
    }
    return req[propName];
  },
  responseFilter: (res, propName) => {
    if (propName === "body" && res.body?.token) {
      const sanitizedBody = { ...res.body, token: "[REDACTED]" };
      return sanitizedBody;
    }
    return res[propName];
  },
});

const errorLogger = expressWinston.errorLogger({
  winstonInstance: logger,
});

const errorHandler = (err, req, res, next) => {
  logger.error(`Error: ${err.message}`, { stack: err.stack });

  // Client errors (e.g. malformed JSON) keep their message; server errors
  // get a generic one so internals never reach the browser.
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: status < 500 && err.expose ? err.message : "Internal Server Error",
  });
};

module.exports = { requestLogger, errorLogger, logger, errorHandler };
