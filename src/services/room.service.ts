import { Injectable } from '@nestjs/common';
import { RoomRedisService } from './models/room.redis.service';
import { Room } from '../classes/rooms/Room';

@Injectable()
export class RoomService {
  constructor(private readonly roomRedisService: RoomRedisService) {}

  async lookup({ name }: { name: string | null }): Promise<Room | null> {
    return this.roomRedisService.lookup({ name });
  }

  async create({
    name,
    ownerPlayerId,
  }: {
    name: string;
    ownerPlayerId: string;
  }): Promise<Room | false> {
    return this.roomRedisService.create({ name, ownerPlayerId });
  }
}
