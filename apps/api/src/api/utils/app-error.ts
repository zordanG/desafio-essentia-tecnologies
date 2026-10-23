import z from 'zod';
import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { logger } from '../../config/logger.js';

const ErrorCodeEnum = z.enum([
  'AUTH_EMAIL_ALREADY_EXISTS',
  'AUTH_INVALID_CREDENTIALS',
  'AUTH_TOKEN_EXPIRED',
  'AUTH_TOKEN_INVALID',
  'BAD_REQUEST',
  'CONFLICT',
  'FORBIDDEN',
  'INTERNAL_ERROR',
  'PAYLOAD_TOO_LARGE',
  'RESOURCE_NOT_FOUND',
  'SERVICE_UNAVAILABLE',
  'UNAUTHORIZED',
  'UNSUPPORTED_MEDIA_TYPE',
  'VALIDATION_ERROR',
  'TOO_MANY_REQUESTS',
]);

const AppErrorSchema = z.object({
  code: ErrorCodeEnum,
  message: z.string(),
  status: z.number(),
});

type AppErrorParams = z.infer<typeof AppErrorSchema>;

class AppError extends Error {
  code: z.infer<typeof ErrorCodeEnum>;
  status: number;

  constructor({ code, message, status }: AppErrorParams) {
    super(message);
    this.code = code;
    this.status = status;
  }

  static badRequest(message = 'Invalid data') {
    return new AppError({ status: 400, code: 'BAD_REQUEST', message });
  }

  static unauthorized(message = 'Invalid or expired token') {
    return new AppError({ status: 401, code: 'UNAUTHORIZED', message });
  }

  static forbidden(message = 'Forbidden') {
    return new AppError({ status: 403, code: 'FORBIDDEN', message });
  }

  static tooManyRequests(message = 'Too many requests') {
    return new AppError({ status: 429, code: 'TOO_MANY_REQUESTS', message });
  }

  static notFound(message = 'Resource not found') {
    return new AppError({ status: 404, code: 'RESOURCE_NOT_FOUND', message });
  }

  static emailExists(message = 'Email already in use') {
    return new AppError({ status: 409, code: 'AUTH_EMAIL_ALREADY_EXISTS', message });
  }

  static invalidCredentials(message = 'Invalid credentials') {
    return new AppError({ status: 401, code: 'AUTH_INVALID_CREDENTIALS', message });
  }

  static internal(message = 'Something went wrong') {
    return new AppError({ status: 500, code: 'INTERNAL_ERROR', message });
  }

  static conflict(message = 'Resource conflict') {
    return new AppError({ status: 409, code: 'CONFLICT', message });
  }

  static payloadTooLarge(message = 'Payload too large') {
    return new AppError({ status: 413, code: 'PAYLOAD_TOO_LARGE', message });
  }

  static unsupportedMediaType(message = 'Unsupported media type') {
    return new AppError({ status: 415, code: 'UNSUPPORTED_MEDIA_TYPE', message });
  }

  static serviceUnavailable(message = 'Service unavailable') {
    return new AppError({ status: 503, code: 'SERVICE_UNAVAILABLE', message });
  }
}

type ErrorCode = z.infer<typeof ErrorCodeEnum>;

/** Fastify's own 4xx errors keep their status; the code follows the status when we know it. */
const codesByStatus: Partial<Record<number, ErrorCode>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'RESOURCE_NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  429: 'TOO_MANY_REQUESTS',
};

function defineErrorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof AppError)
    return reply.status(error.status).send({
      code: error.code,
      message: error.message,
      status: error.status,
    });

  if (hasZodFastifySchemaValidationErrors(error))
    return reply.status(400).send({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      status: 400,
    });

  // Errors raised by Fastify itself (invalid JSON, payload too large, ...) are
  // the client's fault and must keep their 4xx status.
  if (error.statusCode && error.statusCode < 500)
    return reply.status(error.statusCode).send({
      code: codesByStatus[error.statusCode] ?? 'BAD_REQUEST',
      message: error.message,
      status: error.statusCode,
    });

  logger.error('Unhandled request error', { err: error, requestId: request.id });

  return reply.status(500).send({
    code: 'INTERNAL_ERROR',
    message: 'Something went wrong',
    status: 500,
  });
}

const ErrorDefaults = {
  400: AppErrorSchema.extend({
    code: z.enum(['BAD_REQUEST', 'VALIDATION_ERROR']),
    message: z.string().default('Invalid request data'),
    status: z.literal(400).default(400),
  }),
  401: AppErrorSchema.extend({
    code: z.enum(['UNAUTHORIZED', 'AUTH_INVALID_CREDENTIALS']),
    message: z.string().default('Invalid or expired token'),
    status: z.literal(401).default(401),
  }),
  403: AppErrorSchema.extend({
    code: z.literal('FORBIDDEN'),
    message: z.string().default('Insufficient Permissions'),
    status: z.literal(403).default(403),
  }),
  404: AppErrorSchema.extend({
    code: z.literal('RESOURCE_NOT_FOUND'),
    message: z.string().default('Resource not found'),
    status: z.literal(404).default(404),
  }),
  409: AppErrorSchema.extend({
    code: z.enum(['AUTH_EMAIL_ALREADY_EXISTS', 'CONFLICT']),
    message: z.string().default('Resource conflict'),
    status: z.literal(409).default(409),
  }),
  413: AppErrorSchema.extend({
    code: z.literal('PAYLOAD_TOO_LARGE'),
    message: z.string().default('Payload too large'),
    status: z.literal(413).default(413),
  }),
  415: AppErrorSchema.extend({
    code: z.literal('UNSUPPORTED_MEDIA_TYPE'),
    message: z.string().default('Unsupported media type'),
    status: z.literal(415).default(415),
  }),
  429: AppErrorSchema.extend({
    code: z.literal('TOO_MANY_REQUESTS'),
    message: z.string().default('Too many requests'),
    status: z.literal(429).default(429),
  }),
  500: AppErrorSchema.extend({
    code: z.literal('INTERNAL_ERROR'),
    message: z.string().default('Something went wrong'),
    status: z.literal(500).default(500),
  }),
  503: AppErrorSchema.extend({
    code: z.literal('SERVICE_UNAVAILABLE'),
    message: z.string().default('Service unavailable'),
    status: z.literal(503).default(503),
  }),
};

export { defineErrorHandler, AppError, type AppErrorParams, AppErrorSchema, ErrorDefaults };
