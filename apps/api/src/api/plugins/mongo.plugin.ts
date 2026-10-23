import { MongoInstance } from '../../config/mongo.js';
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import type { Db } from 'mongodb';

declare module 'fastify' {
  interface FastifyInstance {
    mongo: Db;
  }
}

const mongoDb = await MongoInstance.getInstance();

export default fp(function (app: FastifyInstance) {
  app.decorate('mongo', mongoDb);
});
