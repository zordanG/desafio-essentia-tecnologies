import z from 'zod';
import { Uuid, Email, Password } from './primitives.js';

const UserSchema = z.object({
  id: Uuid,
  email: Email,
  password_hash: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
});

const UserRowSchema = UserSchema;

const CreateUserSchema = z.object({
  email: Email,
  password: Password,
});

const LoginSchema = z.object({
  email: Email,
  password: z.string().min(1),
});

const AuthResponseSchema = z.object({
  user: z.object({
    id: Uuid,
    email: Email,
  }),
});

export { UserSchema, UserRowSchema, CreateUserSchema, LoginSchema, AuthResponseSchema };
