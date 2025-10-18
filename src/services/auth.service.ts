import { Injectable } from '@nestjs/common';
import { SessionRedisService } from './models/session.redis.service';
import { Session } from '../classes/sessions/Session';

@Injectable()
export class AuthService {
  constructor(private readonly sessionService: SessionRedisService) {}
  async startSession(): Promise<string> {
    // Currently auth isn't really a thing.
    return await this.sessionService.create();
  }

  async renewSession(token: string): Promise<boolean> {
    return await this.sessionService.renew({
      token,
    });
  }

  async getSessionInfo(token: string | null): Promise<Session | null> {
    if (!token) return null;
    return await this.sessionService.lookup({
      token,
    });
  }
}
