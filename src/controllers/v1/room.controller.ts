import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { RoomService } from '../../services/room.service';
import { Room } from '../../classes/rooms/Room';
import { AuthGuard, RequestWithAuth } from '../../middleware/auth.middleware';
import { GeoError } from '../../errors';

@Controller('/api/v1/rooms')
export class RoomControllerV1 {
  constructor(private readonly roomService: RoomService) {}

  @Post('/joinOrCreate')
  @UseGuards(AuthGuard)
  async startSession(
    @Body() body: { name },
    @Req() req: RequestWithAuth,
  ): Promise<Room> {
    const room =
      (await this.roomService.lookup({ name: body.name })) ||
      (await this.roomService.create({
        name: body.name,
        ownerPlayerId: req.auth!.playerId,
      }));

    if (!room || room.started) throw new GeoError('ROOM_NAME_UNAVAILABLE');

    return room;
  }
}
