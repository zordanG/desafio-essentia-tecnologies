import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../utils/app-error.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    setAuthCookies: (reply: FastifyReply, userId: string, refreshToken?: string) => Promise<void>;
    clearAuthCookies: (reply: FastifyReply) => void;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      userId: string;
    };
    user: {
      userId: string;
      iat: number;
      exp: number;
    };
  }
}

export default fp(async function (app: FastifyInstance) {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET not defined in environment');
  }

  await app.register(fastifyCookie, {
    secret: env.COOKIE_SECRET ?? env.JWT_SECRET,
    hook: 'onRequest',
    parseOptions: {},
  });

  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: '15m',
    },
    cookie: {
      cookieName: 'accessToken',
      signed: true,
    },
  });

  app.decorate('authenticate', async function (request: FastifyRequest) {
    try {
      await request.jwtVerify();
    } catch (err) {
      logger.warn('JWT verification failed', { err, requestId: request.id });
      throw AppError.unauthorized('Invalid or expired token');
    }
  });

  app.decorate(
    'setAuthCookies',
    async function (reply: FastifyReply, userId: string, refreshToken?: string) {
      const accessToken = await reply.jwtSign({ userId });

      reply.setCookie('accessToken', accessToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        signed: true,
        maxAge: 15 * 60,
      });

      if (refreshToken) {
        reply.setCookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/auth',
          signed: true,
          maxAge: 30 * 24 * 60 * 60,
        });
      }
    },
  );

  app.decorate('clearAuthCookies', function (reply: FastifyReply) {
    reply.clearCookie('accessToken', { path: '/', signed: true });
    reply.clearCookie('refreshToken', { path: '/auth', signed: true });
  });
});
