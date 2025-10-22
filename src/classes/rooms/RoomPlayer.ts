import { Player } from '../players/Player';
import { Inject } from '@nestjs/common';
import { PlayerRedisService } from '../../services/models/player.redis.service';
import { redisDirect } from '../../services/redis.service';
import { Round } from './Room';

export class RoomPlayerRound {
  constructor(options: Partial<RoomPlayerRound> | undefined | null) {
    if (options) {
      for (const key in options) {
        if (options[key] !== undefined) {
          this[key] = options[key];
        }
      }
    }
  }

  version: number = 1;
  guessed: boolean = false;
  latitude: number = 0;
  longitude: number = 0;
  distance: number = 0;
  points: number = 0;
  timePassed: number = 0;
  round: number;
  readyToContinue: boolean = false;
  votedReRoll: boolean = false;

  reset() {
    this.guessed = false;
    this.latitude = 0;
    this.longitude = 0;
    this.votedReRoll = false;
    this.points = 0;
    this.timePassed = 0;
    this.distance = 0;
    this.readyToContinue = false;
  }
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
  connected: boolean = true;
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
  roomName: string;

  async getPlayer(): Promise<Player | null> {
    if (!redisDirect) return null;
    const player = await redisDirect?.get(`player:${this.playerId}`);

    if (!player) return null;

    return new Player(JSON.parse(player));
  }

  insertOrUpdateRound(round: RoomPlayerRound): boolean {
    console.trace(round);
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

  async dispose(): Promise<boolean> {
    if (!redisDirect) return false;

    const key = `room:${this.roomName}:players`;
    const players = await redisDirect?.get(key);
    if (!players) return false;
    console.log('players', players);
    try {
      let parsed = JSON.parse(players) as RoomPlayer[];
      parsed = parsed.filter((plyr) => plyr.playerId !== this.playerId);
      await redisDirect.set(key, JSON.stringify(parsed));
      return true;
    } catch {
      return false;
    }
  }

  getRound(round: number) {
    return this.rounds.find((rnd) => rnd.round === round);
  }
}
