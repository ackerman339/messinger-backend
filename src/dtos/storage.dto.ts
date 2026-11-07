import { z } from 'zod';

const UPLOAD_CONTENT_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/tiff',
  'image/geotiff',

  // Video
  'video/mp4',
  'video/webm',
  'video/quicktime',

  // Audio
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/webm; codecs=opus', // for safari
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

  // GIS
  'application/vnd.google-earth.kml+xml', // .kml
  'application/vnd.google-earth.kmz', // .kmz
  'application/vnd.shp', // .shp
  'application/vnd.shx', // .shx
  'application/vnd.dbf', // .dbf
  'application/x-dbf',
  'application/geo+json', // .geojson
  'application/vnd.geo+json',
  'application/gpx+xml', // .gpx
  'application/x-gpx+xml',
  'application/x-mapinfo-tab', // .tab

  // Compressed files
  'application/zip', // .zip
  'application/x-zip-compressed',
  'application/vnd.rar', // .rar
  'application/x-rar-compressed',
  'application/x-rar',
  'application/x-tar', // .tar

  // Installers
  'application/vnd.android.package-archive', // .apk
  'application/x-apple-diskimage', // .dmg

  // 3D models
  'model/vnd.collada+xml', // .dae
  'application/vnd.google.sketchup', // .skp
  'application/x-sketchup',
] as const;

const ALLOWED_CONTENT_TYPES = new Set<string>(UPLOAD_CONTENT_TYPES);

const ADDITIONAL_UPLOAD_EXTENSIONS = new Set([
  '.kml',
  '.kmz',
  '.shp',
  '.shx',
  '.dbf',
  '.prj',
  '.zip',
  '.rar',
  '.tar',
  '.apk',
  '.dmg',
  '.geojson',
  '.gpx',
  '.tab',
  '.tif',
  '.tiff',
  '.dae',
  '.skp',
]);

const GENERIC_CONTENT_TYPES = new Set([
  '',
  'application/octet-stream',
  'application/json',
  'application/xml',
  'text/xml',
  'text/plain',
]);

const FileSchema = z
  .object({
    contentType: z.string().trim().toLowerCase(),
    size: z.number().int().positive(),
    fileName: z.string().trim().min(1),
  })
  .superRefine(({ contentType, fileName }, ctx) => {
    if (ALLOWED_CONTENT_TYPES.has(contentType)) {
      return;
    }

    const extension = fileName.match(/\.[^.]+$/)?.[0].toLowerCase();

    if (
      extension &&
      ADDITIONAL_UPLOAD_EXTENSIONS.has(extension) &&
      GENERIC_CONTENT_TYPES.has(contentType)
    ) {
      return;
    }

    ctx.addIssue({
      code: 'custom',
      path: ['contentType'],
      message: 'El tipo de archivo no está permitido.',
    });
  });

export const UploadSchema = z.object({
  files: z.array(FileSchema).min(1).max(10),
});

export const DownloadSchema = z.object({
  attachmentId: z.uuid(),
});

export type UploadDto = z.infer<typeof UploadSchema>;
export type DownloadDto = z.infer<typeof DownloadSchema>;
