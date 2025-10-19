import { Injectable } from '@nestjs/common';
import { RoomRedisService } from './models/room.redis.service';
import { Room } from '../classes/rooms/Room';
import { RoomPlayerRedisService } from './models/roomPlayer.redis.service';
import { GeoError } from '../errors';
import { RoomPlayerRound } from '../classes/rooms/RoomPlayer';

@Injectable()
export class RoomPlayerService {
  constructor(
    private readonly roomRedisService: RoomRedisService,
    private readonly roomPlayerRedisService: RoomPlayerRedisService,
  ) {}

  async setRoundScoreDetails({
    round,
    roomName,
    playerId,
    scoreDetails,
  }: {
    round: number;
    roomName: string;
    playerId: string;
    scoreDetails: {
      longitude: number;
      latitude: number;
      distance: number;
      points: number;
      timePassed: number;
      guessed: boolean;
    };
  }): Promise<RoomPlayerRound | false> {
    const player = await this.roomPlayerRedisService.lookup({
      roomName,
      playerId,
    });

    console.log({ roomName, playerId, player }, 'DEBUG');

    if (!player) return false;

    const newRound = new RoomPlayerRound({
      ...scoreDetails,
      round,
    });

    player.insertOrUpdateRound(newRound);

    console.log(`Rounds New`, player.rounds);

    await this.roomPlayerRedisService.update({
      update: {
        rounds: player.rounds,
      },
      where: {
        playerId: player.playerId,
        roomName,
      },
    });

    return newRound;
  }
}
