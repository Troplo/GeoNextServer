import { Injectable } from '@nestjs/common';
import { BaseRedisService } from './base.redis.service';
import { randomUUID } from 'node:crypto';
import { Room } from '../../classes/rooms/Room';

@Injectable()
export class RoomRedisService extends BaseRedisService {
  async lookup({ name }: { name: string | null }): Promise<Room | null> {
    if (!name) return null;

    const key = `room:${name}`;

    const room = await this.getRedis().get(key);
    if (room) {
      try {
        const roomParsed = JSON.parse(room) as Room;
        console.log(room, roomParsed, new Room(roomParsed));
        return new Room(roomParsed);
      } catch {
        return null;
      }
    }

    return null;
  }

  async create({
    name,
    ownerPlayerId,
  }: {
    name: string;
    ownerPlayerId: string;
  }): Promise<Room | false> {
    const key = `room:${name}`;

    if (await this.lookup({ name })) return false;

    const room = new Room({
      name,
      ownerPlayerId,
    });

    await this.getRedis().set(key, JSON.stringify(room));

    return room;
  }
}
