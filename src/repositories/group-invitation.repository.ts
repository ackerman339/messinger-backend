import { EntityManager } from 'typeorm';
import { AppDataSource } from '@config/database';
import { GroupInvitationStatus } from '@appTypes';
import { GroupInvitation } from '@entities';

export const GroupInvitationRepository = AppDataSource.getRepository(GroupInvitation).extend({
  async createInvitation(invitation: Partial<GroupInvitation>, manager?: EntityManager) {
    const repository = manager ? manager.getRepository(GroupInvitation) : this;
    const newInvitation = repository.create(invitation);

    return repository.save(newInvitation);
  },

  async acceptInvitation(conversationId: string, targetId: string, manager?: EntityManager) {
    const repository = manager ? manager.getRepository(GroupInvitation) : this;

    return repository.update(
      {
        conversationId,
        targetId,
      },
      {
        status: GroupInvitationStatus.ACCEPTED,
      }
    );
  },

  async rejectInvitation(conversationId: string, targetId: string, manager?: EntityManager) {
    const repository = manager ? manager.getRepository(GroupInvitation) : this;

    return repository.update(
      {
        conversationId,
        targetId,
      },
      {
        status: GroupInvitationStatus.REJECTED,
      }
    );
  },

  async markInvitationAsExpired(conversationId: string, targetId: string, manager?: EntityManager) {
    const repository = manager ? manager.getRepository(GroupInvitation) : this;

    return repository.update(
      {
        conversationId,
        targetId,
      },
      {
        status: GroupInvitationStatus.ACCEPTED,
      }
    );
  },
});
