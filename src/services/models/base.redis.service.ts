import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { randomUUID } from 'node:crypto';

@Injectable()
export abstract class BaseRedisService<T> {
  constructor(protected readonly redisService: RedisService) {}

  protected abstract baseKey: string;
  protected abstract ctor: new (data: any) => T;
  idKey = 'id';

  getRedis() {
    return this.redisService.getInstance();
  }

  key(id: string) {
    return `${this.baseKey}:${id}`;
  }

  async lookupInternal<T>(id: string | null): Promise<T | null> {
    if (!id) return null;

    const data = await this.getRedis().get(this.key(id));

    if (!data) return null;

    try {
      const parsed: T = JSON.parse(data) as T;
      console.log(parsed, 'parsed');
      return new this.ctor(parsed) as T | null;
    } catch {
      return null;
    }
  }

  async createInternal<T>(
    entity: Omit<T, 'id' | 'version' | 'lastRoom'>,
  ): Promise<T | null> {
    const id = randomUUID();

    const newEntity = new this.ctor({ ...entity, [this.idKey]: id });

    try {
      await this.getRedis().set(this.key(id), JSON.stringify(newEntity));
      return newEntity as T | null;
    } catch {
      return null;
    }
  }

  async updateInternal<T>(id: string, update: Partial<T>): Promise<false | T> {
    const existing = await this.lookupInternal(id);
    if (!existing) return false;

    const updated = new this.ctor({ ...existing, ...update, [this.idKey]: id });

    await this.getRedis().set(this.key(id), JSON.stringify(updated));

    return updated as T | false;
  }
}
