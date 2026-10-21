import { env } from './config/env.js';

import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.get('/health', async () => ({ status: 'ok' }));

await app.listen({ port: env.PORT, host: env.HOST });
