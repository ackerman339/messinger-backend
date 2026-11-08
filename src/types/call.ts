export enum CallStatus {
  RINGING = 'ringing',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  ENDED = 'ended',
  MISSED = 'missed',
  CONNECTED = 'connected',
  FAILED = 'failed',
}

export enum CallMedia {
  AUDIO = 'audio',
  VIDEO = 'video',
}

export enum CallNegotiationType {
  INITIAL = 'INITIAL',
  MEDIA_CHANGE = 'MEDIA_CHANGE',
  ICE_RESTART = 'ICE_RESTART',
}

export enum CallNegotiationStatus {
  PENDING = 'PENDING',
  OFFERED = 'OFFERED',
  ANSWERED = 'ANSWERED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}
