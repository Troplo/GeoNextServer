import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from '../../services/app.service';
import { AuthService } from '../../services/auth.service';
import {
  AuthRenewSessionV1Response,
  AuthStartSessionV1Response,
} from '../../classes/api/v1/auth/sessions';

@Controller('/api/v1/auth')
export class AuthControllerV1 {
  constructor(private readonly authService: AuthService) {}

  @Post('/startSession')
  async startSession(): Promise<AuthStartSessionV1Response> {
    const result = await this.authService.startSession();
    const lookup = await this.authService.getSessionInfo(result);

    return {
      success: true,
      token: result,
      playerId: lookup!.playerId,
    };
  }

  @Post('/renewSession')
  async renewSession(
    @Body() body: { token: string },
  ): Promise<AuthRenewSessionV1Response> {
    const result = await this.authService.renewSession(body.token);
    if (!result) {
      return {
        success: false,
      };
    }
    const lookup = await this.authService.getSessionInfo(body.token);

    return {
      success: result,
      token: body.token,
      playerId: lookup!.playerId,
    };
  }
}
