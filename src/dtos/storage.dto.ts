import { z } from 'zod';

const UPLOAD_CONTENT_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',

  // Video
  'video/mp4',
  'video/webm',
  'video/quicktime',

  // Audio
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/m4a',

  // PDF
  'application/pdf',

  // Microsoft Word
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

  // Microsoft Excel
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

  // Microsoft PowerPoint
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',

  // OpenDocument
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
] as const;

const FileSchema = z.object({
  contentType: z.enum(UPLOAD_CONTENT_TYPES),
  size: z.number().int().positive(),
  fileName: z.string().min(1),
});

export const UploadSchema = z.object({
  files: z.array(FileSchema).min(1).max(10),
});

export const DownloadSchema = z.object({
  attachmentId: z.uuid(),
});

export type UploadDto = z.infer<typeof UploadSchema>;
export type DownloadDto = z.infer<typeof DownloadSchema>;
