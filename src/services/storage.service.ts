import { EntityManager } from 'typeorm';
import { addHours } from 'date-fns';
import { PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client } from '@config/r2-client';
import { env } from '@config/environment';
import { BadRequestException } from '@exceptions';
import { UploadDto, MessageAttachmentDto } from '@dtos';
import { MessageAttachment } from '@entities';
import { PendingUploadRepository, MessageAttachmentRepository } from '@repositories';

type ProcessAttachmentsParams = {
  userId: string;
  messageId: string;
  attachments: MessageAttachmentDto[];
  manager?: EntityManager;
};

class StorageService {
  private async createPresignedUrl({ key, contentType }: { key: string; contentType: string }) {
    const command = new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(r2Client, command, {
      expiresIn: 60 * 10,
    });

    return {
      url,
      key,
    };
  }

  private async objectExists(key: string) {
    try {
      await r2Client.send(
        new HeadObjectCommand({
          Bucket: env.R2_BUCKET_NAME,
          Key: key,
        })
      );

      return true;
    } catch (error: unknown) {
      const statusCode = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
        ?.httpStatusCode;
      const errorName = (error as { name?: string })?.name;

      if (statusCode === 404 || errorName === 'NotFound') {
        return false;
      }

      throw error;
    }
  }

  async prepareUploads(userId: string, { files }: UploadDto) {
    const expiresAt = addHours(new Date(), 24);
    const uploads = files.map((file) => {
      const storageKey = `users/${userId}/attachments/` + `${crypto.randomUUID()}.bin`;

      return {
        fileName: file.fileName,
        contentType: file.contentType,
        size: file.size,
        userId,
        storageKey,
        expiresAt,
      };
    });

    const presignedUrls = [];
    const pendingUploads = await PendingUploadRepository.createUploads(uploads);

    for (const upload of pendingUploads) {
      const { url, key } = await this.createPresignedUrl({
        key: upload.storageKey,
        contentType: upload.contentType,
      });

      presignedUrls.push({ url, key });
    }

    return { presignedUrls, pendingUploads };
  }

  async processMessageAttachments({
    attachments,
    messageId,
    userId,
    manager,
  }: ProcessAttachmentsParams) {
    if (attachments.length === 0) {
      return;
    }

    const pendingUploadIds: string[] = [];
    const messageAttachments: Partial<MessageAttachment>[] = [];

    for (const attachment of attachments) {
      const pendingUpload = await PendingUploadRepository.findByIdAndUser(
        attachment.id,
        userId,
        manager
      );

      if (!pendingUpload) {
        throw new BadRequestException('ATTACHMENT:INVALID_UPLOAD');
      }

      if (pendingUpload.expiresAt < new Date()) {
        throw new BadRequestException('ATTACHMENT:UPLOAD_EXPIRED');
      }

      const exists = await this.objectExists(pendingUpload.storageKey);

      if (!exists) {
        throw new BadRequestException('ATTACHMENT:UPLOAD_NOT_FOUND');
      }

      pendingUploadIds.push(pendingUpload.id);

      messageAttachments.push({
        storageKey: pendingUpload.storageKey,
        fileName: pendingUpload.fileName,
        contentType: pendingUpload.contentType,
        size: pendingUpload.size,
        messageId,
      });
    }

    await MessageAttachmentRepository.createAttachments(messageAttachments, manager);

    for (const uploadId of pendingUploadIds) {
      await PendingUploadRepository.deleteById(uploadId, manager);
    }
  }

  async createDownloadUrl({
    storageKey,
    fileName,
    contentType,
  }: {
    storageKey: string;
    fileName: string;
    contentType: string;
  }) {
    const command = new GetObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: storageKey,
      ResponseContentType: contentType,
      ResponseContentDisposition: `attachment; filename="${fileName}"`,
    });

    return getSignedUrl(r2Client, command, {
      expiresIn: 2 * 24 * 60 * 60, // 2 days
    });
  }
}

export const storageService = new StorageService();
