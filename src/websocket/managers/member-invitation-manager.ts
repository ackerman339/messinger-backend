class MemberInvitationManager {
  private invitations = new Map<string, Set<string>>();

  add(userId: string, conversationId: string) {
    const invitations = this.invitations.get(userId) ?? new Set();

    invitations.add(conversationId);
    this.invitations.set(userId, invitations);
  }

  has(userId: string, conversationId: string) {
    return this.invitations.get(userId)?.has(conversationId) ?? false;
  }

  remove(userId: string, conversationId: string) {
    const invitations = this.invitations.get(userId);

    if (!invitations) {
      return;
    }

    invitations.delete(conversationId);

    if (invitations.size === 0) {
      this.invitations.delete(userId);
    }
  }

  removeAll(userId: string) {
    this.invitations.delete(userId);
  }
}

export const memberInvitationManager = new MemberInvitationManager();
