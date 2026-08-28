import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-firebase-auth"]',
      'headers.authorization',
      'imageBase64',
      'apiKey',
      'GEMINI_API_KEY',
      'GEOAPIFY_SERVER_KEY',
      'GEOAPIFY_API_KEY',
      'CLOUDINARY_API_SECRET',
    ],
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
