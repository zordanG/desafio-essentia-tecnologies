import z from 'zod';

const Uuid = z.uuid();
const Email = z.email();
const Password = z.string().min(8).max(128);

export { Uuid, Email, Password };
