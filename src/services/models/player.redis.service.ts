import { Injectable } from '@nestjs/common';
import { BaseRedisService } from './base.redis.service';
import { RoomPlayer } from '../../classes/rooms/RoomPlayer';
import { Player } from '../../classes/players/Player';

@Injectable()
export class PlayerRedisService extends BaseRedisService<Player> {
  protected baseKey = 'player';
  protected ctor = Player;

  async lookup({
    playerId,
  }: {
    playerId: string | null;
  }): Promise<Player | null> {
    return this.lookupInternal(playerId);
  }

  async create({
    player,
  }: {
    player: Omit<Player, 'id' | 'version' | 'lastRoom'>;
  }): Promise<Player | null> {
    return this.createInternal(player);
  }

  async update({
    update,
    where,
  }: {
    update: Partial<Player>;
    where: {
      playerId: string;
    };
  }): Promise<false | Player> {
    return this.updateInternal(where.playerId, update);
  }
}
