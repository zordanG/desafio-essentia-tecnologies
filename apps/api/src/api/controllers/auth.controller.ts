import type { FastifyTypedInstance } from '../types.js';
import z from 'zod';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { AppError, ErrorDefaults } from '../utils/app-error.js';
import {
  CreateUserSchema,
  LoginSchema,
  AuthResponseSchema,
  UserRowSchema,
} from '../models/auth.model.js';
import { PoolController } from '../../config/db.js';
import { oneOrNone, runInTx } from '../../config/db.query.js';
import { createHash, randomBytes } from 'node:crypto';

function createRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export default async function route(app: FastifyTypedInstance) {
  app.post(
    '/register',
    {
      preHandler: app.rateLimiterPerIpHook,
      schema: {
        tags: ['Auth'],
        description: 'Register a new user',
        body: CreateUserSchema,
        response: {
          201: AuthResponseSchema,
          400: ErrorDefaults[400],
          409: ErrorDefaults[409],
          429: ErrorDefaults[429],
          500: ErrorDefaults[500],
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      const existing = await oneOrNone(
        UserRowSchema.pick({ id: true }),
        'SELECT id FROM users WHERE email = ?',
        [email],
      );
      if (existing) throw AppError.conflict('Email already registered');

      const passwordHash = await bcrypt.hash(password, 10);
      const userId = randomUUID();
      const refreshToken = createRefreshToken();
      const tokenHash = hashRefreshToken(refreshToken);

      await PoolController.transaction(async (client) => {
        await runInTx(client, 'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)', [
          userId,
          email,
          passwordHash,
        ]);

        await runInTx(
          client,
          `INSERT INTO refresh_sessions
            (token_hash, user_id, expires_at)
          VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY))`,
          [tokenHash, userId],
        );
      });

      await app.setAuthCookies(reply, userId, refreshToken);

      return reply.status(201).send({
        user: { id: userId, email },
      });
    },
  );

  app.post(
    '/login',
    {
      preHandler: app.rateLimiterPerIpHook,
      schema: {
        tags: ['Auth'],
        description: 'Authenticate user and return access token',
        body: LoginSchema,
        response: {
          200: AuthResponseSchema,
          400: ErrorDefaults[400],
          401: ErrorDefaults[401],
          429: ErrorDefaults[429],
          500: ErrorDefaults[500],
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      const user = await oneOrNone(
        UserRowSchema.pick({ id: true, email: true, password_hash: true }),
        'SELECT id, email, password_hash FROM users WHERE email = ?',
        [email],
      );
      if (!user) throw AppError.unauthorized('Invalid credentials');

      const passCompare = await bcrypt.compare(password, user.password_hash);
      if (!passCompare) throw AppError.unauthorized('Invalid credentials');

      const refreshToken = createRefreshToken();
      const tokenHash = hashRefreshToken(refreshToken);

      await PoolController.transaction(async (client) => {
        await runInTx(
          client,
          `INSERT INTO refresh_sessions
            (token_hash, user_id, expires_at)
          VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY))`,
          [tokenHash, user.id],
        );
      });

      await app.setAuthCookies(reply, user.id, refreshToken);

      return reply.send({
        user: { id: user.id, email: user.email },
      });
    },
  );

  app.post(
    '/logout',
    {
      schema: {
        tags: ['Auth'],
        description: 'Logout - clears auth cookies',
        response: {
          204: z.undefined(),
          500: ErrorDefaults[500],
        },
      },
    },
    async (request, reply) => {
      app.clearAuthCookies(reply);
      return reply.status(204).send();
    },
  );

  app.post(
    '/refresh',
    {
      schema: {
        tags: ['Auth'],
        description: 'Refresh access token using refresh token cookie',
        response: {
          200: AuthResponseSchema,
          401: ErrorDefaults[401],
          500: ErrorDefaults[500],
        },
      },
    },
    async (request, reply) => {
      const signedToken = request.cookies.refreshToken;

      if (!signedToken) {
        throw AppError.unauthorized('Refresh token not found');
      }

      const unsigned = request.unsignCookie(signedToken);

      if (!unsigned.valid || !unsigned.value) {
        throw AppError.unauthorized('Invalid refresh token');
      }

      const oldTokenHash = hashRefreshToken(unsigned.value);

      const session = await oneOrNone(
        z.object({
          user_id: z.string(),
        }),
        `SELECT user_id
          FROM refresh_sessions
          WHERE token_hash = ?
            AND expires_at > UTC_TIMESTAMP()`,
        [oldTokenHash],
      );

      if (!session) {
        throw AppError.unauthorized('Invalid or expired session');
      }

      const newRefreshToken = createRefreshToken();
      const newTokenHash = hashRefreshToken(newRefreshToken);

      await PoolController.transaction(async (client) => {
        await runInTx(client, 'DELETE FROM refresh_sessions WHERE token_hash = ?', [oldTokenHash]);

        await runInTx(
          client,
          `INSERT INTO refresh_sessions
            (token_hash, user_id, expires_at)
          VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY))`,
          [newTokenHash, session.user_id],
        );
      });

      const user = await oneOrNone(
        UserRowSchema.pick({ id: true, email: true }),
        'SELECT id, email FROM users WHERE id = ?',
        [session.user_id],
      );

      if (!user) {
        throw AppError.unauthorized();
      }

      await app.setAuthCookies(reply, session.user_id, newRefreshToken);

      return reply.send({ user });
    },
  );
}
