import { Request, Response } from 'express';
import { UploadDto, DownloadDto } from '@dtos';
import { storageService } from '@services/storage.service';
import { MessageAttachmentRepository } from '@repositories';

export async function processUpload(_req: Request, res: Response) {
  const dto = res.locals.validatedDto as UploadDto;
  const userId = res.locals.userId!;

  const { presignedUrls, pendingUploads } = await storageService.prepareUploads(userId, {
    files: dto.files,
  });

  res.status(201).json({
    message: 'Upload URL created',
    result: {
      presignedUrls,
      pendingUploads,
    },
  });
}

export async function downloadAttachment(_req: Request, res: Response) {
  const dto = res.locals.validatedDto as DownloadDto;

  const attachment = await MessageAttachmentRepository.findOne({ where: { id: dto.attachmentId } });

  if (!attachment) {
    return res.status(404).json({
      message: 'Attachment not found',
    });
  }

  const url = await storageService.createDownloadUrl({
    storageKey: attachment.storageKey,
    fileName: attachment.fileName,
    contentType: attachment.contentType,
  });

  return res.status(200).json({
    result: {
      url,
    },
  });
}
