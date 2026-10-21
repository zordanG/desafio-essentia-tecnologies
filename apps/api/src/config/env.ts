import { createEnv } from '@repo/config-env';

import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(3001),
  HOST: z.string(),
});

export const env = createEnv(schema);
