export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

export enum SessionRevokeReason {
  LOGOUT = 'logout',
  SECURITY = 'security',
  TIMEOUT = 'timeout',
  SUSPICIOUS = 'suspicious',
  EXPIRED = 'expired',
  INVALID = 'invalid_token',
}
