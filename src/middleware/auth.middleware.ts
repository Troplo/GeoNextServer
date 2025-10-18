import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { GeoError } from '../errors';
import { Request } from 'express';

export interface RequestWithAuth extends Request {
  auth?: {
    token: string;
    playerId: string;
  };
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: RequestWithAuth = context
      .switchToHttp()
      .getRequest<RequestWithAuth>();
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new GeoError('UNAUTHORIZED');
    }

    try {
      const auth = await this.authService.getSessionInfo(authHeader);

      if (!auth) {
        throw new GeoError('UNAUTHORIZED');
      }

      request.auth = {
        token: authHeader,
        playerId: auth.playerId,
      };

      return true;
    } catch (err) {
      throw new GeoError('UNAUTHORIZED');
    }
  }
}
