import { uploadsApi } from '@/src/api';
import { ApiError } from '@/src/api/client';
import { normalizeUploadResult, unwrapEntity } from '@/src/api/normalize';
import { isRemoteAttachment } from '@/src/shared/lib/business';
import { attachmentFileName, attachmentMimeType, completeUploadUrls, isImageAttachment } from '@/src/shared/lib/upload-files';
export { isImageAttachment } from '@/src/shared/lib/upload-files';
import {
  formatBytes,
  MAX_UPLOAD_BYTES,
  readFileSize,
  shrinkImageForUpload,
} from '@/src/shared/lib/image';

export function getAttachmentLabel(uri: string) {
  try {
    return decodeURIComponent(attachmentFileName(uri));
  } catch {
    return attachmentFileName(uri);
  }
}

function buildFilePart(uri: string) {
  return {
    uri,
    name: attachmentFileName(uri),
    type: attachmentMimeType(uri),
  } as unknown as Blob;
}

/**
 * Turns an upload failure into a sentence a shop owner can act on. The server
 * answers an oversized file with a plain error page rather than JSON, so the
 * only clue reaching here is the status code.
 */
export function resolveUploadMessage(error: unknown) {
  const status = error instanceof ApiError ? error.status : undefined;
  const message = error instanceof Error ? error.message : '';

  if (status === 413 || /file too large|too large|entity too large/i.test(message)) {
    return `That file is too big. Keep it under ${formatBytes(MAX_UPLOAD_BYTES)}.`;
  }
  if (/not fully configured|r2/i.test(message)) {
    return 'File storage is not set up on the server yet. Please tell support.';
  }
  if (/network request failed/i.test(message)) {
    return 'Upload failed. Check your internet and try again.';
  }
  if (status && status >= 500) {
    return 'The server could not save that file. Please try again.';
  }
  return message || 'Upload failed. Please try again.';
}

/** Shrinks pictures so the server never refuses them for size. */
async function prepareForUpload(uri: string) {
  const prepared = isImageAttachment(uri) || attachmentMimeType(uri) === 'application/octet-stream'
    ? await shrinkImageForUpload(uri) : uri;
  const size = readFileSize(prepared);
  if (size !== null && size > MAX_UPLOAD_BYTES) {
    throw new ApiError(`That file is too big. Keep it under ${formatBytes(MAX_UPLOAD_BYTES)}.`, 413);
  }
  return prepared;
}

export async function uploadSingleAttachment(uri: string) {
  if (!uri || isRemoteAttachment(uri)) {
    return uri;
  }

  const prepared = await prepareForUpload(uri);
  const formData = new FormData();
  formData.append('file', buildFilePart(prepared));
  const response = await uploadsApi.attachment(formData);
  const normalized = normalizeUploadResult(unwrapEntity(response));
  if (!normalized.url) {
    throw new ApiError('The server did not return a link for that file. Please try again.');
  }
  return normalized.url;
}

export async function uploadAttachments(uris: string[]) {
  const remote = uris.filter((uri) => isRemoteAttachment(uri));
  const local = uris.filter((uri) => !isRemoteAttachment(uri));
  if (!local.length) {
    return remote;
  }

  const prepared = await Promise.all(local.map((uri) => prepareForUpload(uri)));

  const formData = new FormData();
  prepared.forEach((uri) => {
    formData.append('files', buildFilePart(uri));
  });

  const response = await uploadsApi.attachments(formData);
  const record = unwrapEntity<Record<string, unknown>>(response);
  const normalizedItems = (Array.isArray(record.items) ? record.items : [])
      .map(normalizeUploadResult)
      .map((item) => item.url)
      .filter(Boolean);
  const uploaded = completeUploadUrls(normalizedItems, Array.isArray(record.urls) ? record.urls : [], local.length);

  let uploadedIndex = 0;
  return uris.map((uri) => isRemoteAttachment(uri) ? uri : uploaded[uploadedIndex++]);
}
