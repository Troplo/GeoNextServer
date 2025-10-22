import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { RoomRedisService } from './models/room.redis.service';
import { Room } from '../classes/rooms/Room';
import { RoomPlayerRedisService } from './models/roomPlayer.redis.service';
import { GeoError } from '../errors';
import { RoomPlayerRound } from '../classes/rooms/RoomPlayer';
import { GameGateway } from '../gateways/game.gateway';
import { GameSocketServerEvent } from '../types/socket/serverEvents';

@Injectable()
export class RoomPlayerService {
  constructor(
    private readonly roomRedisService: RoomRedisService,
    private readonly roomPlayerRedisService: RoomPlayerRedisService,
    @Inject(forwardRef(() => GameGateway))
    private readonly gateway: GameGateway,
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
    scoreDetails:
      | {
          longitude: number;
          latitude: number;
          distance: number;
          points: number;
          timePassed: number;
          guessed: boolean;
        }
      | {
          votedReRoll: boolean;
        };
  }): Promise<RoomPlayerRound | false> {
    const player = await this.roomPlayerRedisService.lookup({
      roomName,
      playerId,
    });

    if (!player) return false;

    const existingRound = player.getRound(round);
    if (
      !existingRound ||
      !existingRound?.guessed ||
      ('votedReRoll' in scoreDetails &&
        !('longitude' in scoreDetails) &&
        !('latitude' in scoreDetails))
    ) {
      const newRound = new RoomPlayerRound({
        ...(existingRound ?? {
          latitude: 0,
          longitude: 0,
          points: 0,
          distance: 0,
          timePassed: 0,
          guessed: false,
        }),
        ...scoreDetails,
        round,
      });

      player.insertOrUpdateRound(newRound);

      await this.roomPlayerRedisService.update({
        update: {
          rounds: player.rounds,
        },
        where: {
          playerId: player.playerId,
          roomName,
        },
      });
      this.gateway.emitToRoomName({
        event: GameSocketServerEvent.ROOM_PLAYER_SCORE_DETAILS_UPDATED,
        data: {
          playerId: playerId,
          round: newRound,
        },
        roomName,
      });
      return newRound;
    } else {
      this.gateway.emitToRoomName({
        event: GameSocketServerEvent.ROOM_PLAYER_SCORE_DETAILS_UPDATED,
        data: {
          playerId: playerId,
          round: existingRound,
        },
        roomName,
      });
      return existingRound;
    }
  }

  async setRoundCompleted({
    round,
    roomName,
    playerId,
  }: {
    round: number;
    roomName: string;
    playerId: string;
  }): Promise<RoomPlayerRound | false> {
    const player = await this.roomPlayerRedisService.lookup({
      roomName,
      playerId,
    });

    if (!player) return false;

    const oldRound = player.getRound(round);

    // setRoundScoreDetails MUST be called first!
    if (!oldRound) return false;

    oldRound.readyToContinue = true;

    player.insertOrUpdateRound(oldRound);

    await this.roomPlayerRedisService.update({
      update: {
        rounds: player.rounds,
      },
      where: {
        playerId: player.playerId,
        roomName,
      },
    });

    return player.getRound(round) || false;
  }
}
