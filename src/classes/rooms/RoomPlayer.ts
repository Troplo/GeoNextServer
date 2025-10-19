import { Player } from '../players/Player';
import { Inject } from '@nestjs/common';
import { PlayerRedisService } from '../../services/models/player.redis.service';
import { redisDirect } from '../../services/redis.service';
import { Round } from './Room';

export class RoomPlayerRound {
  constructor(options: Partial<RoomPlayerRound> | undefined | null) {
    if (options) Object.assign(this, options);
  }

  version: number = 1;
  guessed: boolean = false;
  latitude: number = 0;
  longitude: number = 0;
  distance: number = 0;
  points: number = 0;
  timePassed: number = 0;
  round: number;
}
export class RoomPlayer {
  constructor(options: Partial<RoomPlayer> | undefined | null) {
    if (options) Object.assign(this, options);
    if (options?.rounds?.length) {
      this.rounds = [];
      for (const round of options.rounds) {
        this.rounds.push(new RoomPlayerRound(round));
      }
    }
  }

  playerId: string;
  connected: boolean = false;
  /**
   * If the player has been disconnected for a long time, they will be kicked by the server.
   * @type {number | null}
   */
  kickAt: number | null = null;
  socketId: string | null;
  version: number = 1;
  player?: Player | null;
  rounds: RoomPlayerRound[] = [];
  readyToLeave: boolean = false;

  async getPlayer(): Promise<Player | null> {
    if (!redisDirect) return null;
    const player = await redisDirect?.get(`player:${this.playerId}`);

    if (!player) return null;

    return new Player(JSON.parse(player));
  }

  insertOrUpdateRound(round: RoomPlayerRound): boolean {
    const existingIndex = this.rounds.findIndex(
      (rnd) => rnd.round === round.round,
    );

    if (existingIndex !== -1) {
      for (const [key, value] of Object.entries(round)) {
        this.rounds[existingIndex][key] = value;
      }
    } else {
      this.rounds.push(new RoomPlayerRound(round));
    }

    return true;
  }

  canLeave(nbRound: number): boolean {
    const rounds = this.rounds.filter((rnd) => rnd.guessed);
    return rounds.length + 1 >= nbRound;
  }
}
