import { MongoClient, type Db } from 'mongodb';
import { env } from './env.js';
import { logger } from './logger.js';

class MongoInstance {
  private static client: MongoClient;
  private static db: Db;

  static async getInstance(): Promise<Db> {
    if (!this.client) {
      this.client = new MongoClient(env.MONGODB_URI);

      this.client.on('error', (err) => logger.error('MongoDB error', { err }));

      await this.client.connect();

      this.db = this.client.db();
    }

    return this.db;
  }

  static async closeInstance(): Promise<void> {
    if (this.client) {
      await this.client.close();
    }
  }
}

export { MongoInstance };
