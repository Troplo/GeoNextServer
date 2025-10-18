import { Injectable } from '@nestjs/common';
import { BaseRedisService } from './base.redis.service';
import { randomUUID } from 'node:crypto';
import { Session } from '../../classes/sessions/Session';

const DEFAULT_SESSION_EXPIRY = 259200;

@Injectable()
export class SessionRedisService extends BaseRedisService {
  /**
   *
   * @param expiry - in seconds (default 3 days)
   * @returns {Promise<void>}
   */
  async create({
    expiry = DEFAULT_SESSION_EXPIRY,
  }: {
    expiry?: number | null;
  } = {}): Promise<string> {
    const redis = this.getRedis();
    const token = randomUUID();
    const sessionId = `sessions:${token}`;

    const playerId = randomUUID();

    const sessionData = JSON.stringify({
      createdAt: new Date().toISOString(),
      playerId,
    });

    if (expiry) {
      await redis.set(sessionId, sessionData, 'EX', expiry);
    } else {
      await redis.set(sessionId, sessionData);
    }

    return token;
  }

  async renew({
    expiry = DEFAULT_SESSION_EXPIRY,
    token,
  }: {
    expiry?: number | null;
    token: string;
  }): Promise<boolean> {
    const key = `sessions:${token}`;
    const redis = this.getRedis();
    const exists = await redis.exists(key);

    if (!exists) {
      return false;
    }

    if (expiry && expiry > 0) {
      const result = await redis.expire(key, expiry);
      return result === 1;
    }

    const result = await redis.persist(key);
    return result === 1;
  }

  async lookup({ token }: { token: string }): Promise<Session | null> {
    const key = `sessions:${token}`;
    const redis = this.getRedis();
    const result = await redis.get(key);

    if (result) {
      return JSON.parse(result) as Session;
    }

    return null;
  }
}
