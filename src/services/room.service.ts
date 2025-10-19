import { Injectable } from '@nestjs/common';
import { RoomRedisService } from './models/room.redis.service';
import { Room } from '../classes/rooms/Room';
import { RoomPlayerRedisService } from './models/roomPlayer.redis.service';
import { GeoError } from '../errors';

@Injectable()
export class RoomService {
  constructor(
    private readonly roomRedisService: RoomRedisService,
    private readonly roomPlayerRedisService: RoomPlayerRedisService,
  ) {}

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

  async join({
    roomName,
    playerId,
    socketId,
  }: {
    roomName: string;
    playerId: string;
    socketId: string;
  }): Promise<boolean> {
    const room = await this.lookup({ name: roomName });
    if (!room) return false;
    const joined = await this.roomPlayerRedisService.lookup({
      roomName,
      playerId,
    });

    console.log(room, joined, playerId);

    if (joined && joined.connected && joined.socketId) {
      return false;
    } else if (joined) {
      // If the user disconnected from the socket due to a network issue or refresh
      const success = await this.roomPlayerRedisService.update({
        update: {
          connected: true,
          socketId,
        },
        where: {
          roomName,
          playerId,
        },
      });
      return !!success;
    } else if (!room.started) {
      const success = await this.roomPlayerRedisService.create({
        roomName,
        playerId,
      });
      console.log(success);
      return !!success;
    }

    return false;
  }

  async reconnect({
    roomName,
    playerId,
    socketId,
  }: {
    roomName: string;
    playerId: string;
    socketId: string;
  }): Promise<boolean> {
    const success = await this.roomPlayerRedisService.update({
      update: {
        connected: true,
        socketId,
      },
      where: {
        roomName,
        playerId,
      },
    });
    return !!success;
  }

  async disconnect({
    roomName,
    playerId,
  }: {
    roomName: string;
    playerId: string;
  }): Promise<boolean> {
    const success = await this.roomPlayerRedisService.update({
      update: {
        connected: false,
        socketId: null,
      },
      where: {
        roomName,
        playerId,
      },
    });
    return !!success;
  }

  async checkIfOwned({
    roomName,
    playerId,
  }: {
    roomName?: string | null;
    playerId?: string | null;
  }): Promise<boolean> {
    if (!roomName || !playerId) return false;

    const room = await this.lookup({ name: roomName });

    if (!room) return false;

    return room.ownerPlayerId === playerId;
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
    return this.roomRedisService.update({ update, where });
  }

  async checkIfPlaying({
    roomName,
    playerId,
  }: {
    roomName?: string | null;
    playerId?: string | null;
  }): Promise<boolean> {
    if (!roomName || !playerId) return false;

    const room = await this.lookup({ name: roomName });

    if (!room) return false;

    const players = await room.getPlayers();

    return !!players.find((plyr) => plyr.playerId === playerId);
  }
}
