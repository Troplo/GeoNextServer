import { Injectable } from '@nestjs/common';
import { BaseRedisService } from './base.redis.service';
import { Room } from '../../classes/rooms/Room';

@Injectable()
export class RoomRedisService extends BaseRedisService<Room> {
  protected baseKey = 'room';
  protected ctor = Room;
  idKey = 'name';

  async lookup({ name }: { name: string | null }): Promise<Room | null> {
    return this.lookupInternal(name);
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

  async update({
    update,
    where,
  }: {
    update: Partial<Room>;
    where: {
      roomName: string;
    };
  }): Promise<false | Room> {
    return this.updateInternal(where.roomName, update);
  }
}
