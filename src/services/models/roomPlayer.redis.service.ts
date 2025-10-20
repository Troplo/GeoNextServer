import { Injectable } from '@nestjs/common';
import { BaseRedisService } from './base.redis.service';
import { RoomPlayer } from '../../classes/rooms/RoomPlayer';

@Injectable()
export class RoomPlayerRedisService extends BaseRedisService<RoomPlayer> {
  protected baseKey = 'unused';
  protected ctor = RoomPlayer;

  key(id: string) {
    return `room:${id}:players`;
  }

  async lookup({
    roomName,
    playerId,
  }: {
    roomName: string | null;
    playerId: string | null;
  }): Promise<RoomPlayer | null> {
    if (!roomName || !playerId) return null;

    const key = this.key(roomName);

    const roomPlayers = await this.getRedis().get(key);
    if (roomPlayers) {
      try {
        const playersParsed = JSON.parse(roomPlayers) as RoomPlayer[];
        for (const player of playersParsed) {
          console.log(player.playerId, playerId);
          if (player.playerId === playerId) {
            return new RoomPlayer(player);
          }
        }
      } catch (e) {
        console.log(e);
      }
    }

    return null;
  }

  async lookupAll({
    roomName,
  }: {
    roomName: string | null;
  }): Promise<RoomPlayer[]> {
    if (!roomName) return [];

    const key = this.key(roomName);

    const roomPlayers = await this.getRedis().get(key);
    if (roomPlayers) {
      try {
        const playersParsed = JSON.parse(roomPlayers) as RoomPlayer[];
        const players: RoomPlayer[] = [];
        for (const player of playersParsed) {
          players.push(new RoomPlayer(player));
        }

        return players;
      } catch (e) {
        console.log(e);
        return [];
      }
    }

    return [];
  }

  async create({
    roomName,
    playerId,
  }: {
    roomName: string | null;
    playerId: string | null;
  }): Promise<RoomPlayer | null> {
    if (
      !roomName ||
      !playerId ||
      (await this.lookup({
        roomName,
        playerId,
      }))
    )
      return null;

    console.log('here');

    const key = this.key(roomName);

    const roomPlayers = await this.getRedis().get(key);

    const newPlayer = new RoomPlayer({
      playerId,
      roomName,
    });

    console.log(newPlayer);

    try {
      const playersParsed = JSON.parse(roomPlayers || '[]') as RoomPlayer[];
      console.log(playersParsed, roomPlayers);
      playersParsed.push(newPlayer);
      await this.getRedis().set(key, JSON.stringify(playersParsed));
      return newPlayer;
    } catch {
      return null;
    }
  }

  async update({
    update,
    where,
  }: {
    update: Partial<RoomPlayer>;
    where: {
      playerId: string;
      roomName: string;
    };
  }): Promise<RoomPlayer[] | false> {
    const players = await this.lookupAll({
      roomName: where.roomName,
    });

    console.log(`PLAYERS`, players);

    if (!players) return false;

    const key = this.key(where.roomName);

    try {
      const playerIndex = players.findIndex(
        (p) => p.playerId === where.playerId,
      );
      if (playerIndex === -1) return false;

      const player = players[playerIndex];
      if (!player) return false;

      for (const [key, value] of Object.entries(update)) {
        (player as any)[key] = value;
      }

      await this.getRedis().set(key, JSON.stringify(players));
    } catch (e) {
      console.log('EXCEPTION', e);
      return false;
    }

    return players;
  }
}
