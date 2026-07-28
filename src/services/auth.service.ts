import { IncomingMessage } from 'node:http';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '@config/environment';
import { SessionRevokeReason } from '@appTypes';
import { SignUpDto, SignInDto } from '@dtos';
import { NotFoundException, UnauthorizedException } from '@exceptions';
import { SessionRepository, UserRepository } from '@repositories';
import { USER_CODE_LENGTH, LOGIN_KEY_LENGTH } from '@constants';
import {
  hashToken,
  generateRandomString,
  generateLoginKeyLookup,
  parseWebSocketCookies,
} from '@utils';

class AuthService {
  private async hashLoginKey(key: string) {
    return await bcrypt.hash(key, env.SALT_ROUNDS);
  }

  private async compareLoginKey(key: string, encryptedKey: string) {
    return await bcrypt.compare(key, encryptedKey);
  }

  async signup(dto: SignUpDto, userAgent: string, ipAddress: string) {
    const { username, role } = dto;
    const userCode = generateRandomString(USER_CODE_LENGTH);
    const loginKey = generateRandomString(LOGIN_KEY_LENGTH);
    const loginKeyHash = await this.hashLoginKey(loginKey);
    const loginKeyLookup = generateLoginKeyLookup(loginKey);
    const newUser = UserRepository.create({
      username,
      userCode,
      loginKeyHash,
      loginKeyLookup,
      role,
    });

    const savedUser = await UserRepository.save(newUser);
    const { accessToken, refreshToken } = await SessionRepository.createSession({
      user: savedUser,
      roles: [role],
      userAgent,
      ipAddress,
    });

    return { user: savedUser, loginKey, accessToken, refreshToken };
  }

  async signin(dto: SignInDto, userAgent: string, ipAddress: string) {
    const { loginKey } = dto;
    const loginKeyLookup = generateLoginKeyLookup(loginKey);
    const user = await UserRepository.findByLoginKeyLookup(loginKeyLookup);

    if (!user) {
      throw new NotFoundException('USER_NOT_FOUND');
    }

    const isValidLoginKey = await this.compareLoginKey(loginKey, user.loginKeyHash);

    if (!isValidLoginKey) {
      throw new UnauthorizedException('INVALID_LOGIN_KEY');
    }

    const { accessToken, refreshToken } = await SessionRepository.createSession({
      user,
      userAgent,
      ipAddress,
      roles: [user.role],
    });

    return { user, accessToken, refreshToken };
  }

  async logout(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);

    const session = await SessionRepository.findOne({
      where: { refreshTokenHash: tokenHash },
    });

    if (!session || session.isRevoked) {
      return;
    }

    await SessionRepository.revokeSession(session.id, SessionRevokeReason.LOGOUT);
  }

  async authenticateWsConnection(req: IncomingMessage) {
    const cookies = await parseWebSocketCookies(req);
    const accessToken = cookies.accessToken;
    let payload: jwt.JwtPayload;

    try {
      payload = jwt.verify(accessToken, env.JWT_SECRET) as jwt.JwtPayload;
    } catch {
      throw new UnauthorizedException('WS_AUTH:INVALID_ACCESS_TOKEN');
    }

    const sessionId = payload.sid as string | undefined;

    if (!sessionId) {
      throw new UnauthorizedException('WS_AUTH:INVALID_ACCESS_TOKEN');
    }

    const session = await SessionRepository.findOne({
      where: {
        id: sessionId,
      },
    });

    if (!session) {
      throw new UnauthorizedException('WS_AUTH:INVALID_SESSION');
    }

    if (session.isRevoked) {
      throw new UnauthorizedException('WS_AUTH:SESSION_REVOKED');
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('WS_AUTH:EXPIRED_SESSION');
    }

    return { userId: session.id, sessionId };
  }
}

export const authService = new AuthService();
