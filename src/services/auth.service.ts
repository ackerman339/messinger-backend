import bcrypt from 'bcrypt';
import { env } from '@config/environment';
import { SessionRevokeReason } from '@appTypes';
import { SignUpDto, SignInDto } from '@dtos';
import { NotFoundException, UnauthorizedException } from '@exceptions';
import { SessionRepository, UserRepository } from '@repositories';
import { USER_CODE_LENGTH, LOGIN_KEY_LENGTH } from '@constants';
import { hashToken, generateRandomString, generateLoginKeyLookup } from '@utils';

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
}

export const authService = new AuthService();
