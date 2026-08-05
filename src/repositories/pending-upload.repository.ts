import { EntityManager, LessThan } from 'typeorm';
import { AppDataSource } from '@config/database';
import { PendingUpload } from '@entities';

export const PendingUploadRepository = AppDataSource.getRepository(PendingUpload).extend({
  async createUploads(uploads: Partial<PendingUpload>[], manager?: EntityManager) {
    const repository = manager ? manager.getRepository(PendingUpload) : this;

    const newUploads = uploads.map((upload) => {
      const created = repository.create(upload);
      return repository.save(created);
    });

    return Promise.all(newUploads);
  },

  async findByIdAndUser(id: string, userId: string, manager?: EntityManager) {
    const repository = manager ? manager.getRepository(PendingUpload) : this;

    return repository.findOne({
      where: {
        id,
        userId,
      },
    });
  },

  async deleteById(id: string, manager?: EntityManager) {
    const repository = manager ? manager.getRepository(PendingUpload) : this;

    await repository.delete({
      id,
    });
  },

  async deleteExpired() {
    await this.delete({
      expiresAt: LessThan(new Date()),
    });
  },
});
