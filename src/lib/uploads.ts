import { uploadsApi } from '@/src/api';
import { normalizeUploadResult, unwrapEntity } from '@/src/api/normalize';
import { isRemoteAttachment } from '@/src/lib/business';

function normalizedAttachmentPath(uri: string) {
  return uri.split('?')[0].toLowerCase();
}

function inferMimeType(uri: string) {
  const normalized = normalizedAttachmentPath(uri);
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
  if (normalized.endsWith('.webp')) return 'image/webp';
  if (normalized.endsWith('.pdf')) return 'application/pdf';
  if (normalized.endsWith('.doc')) return 'application/msword';
  if (normalized.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  return 'application/octet-stream';
}

function inferFileName(uri: string) {
  const segments = uri.split('/');
  return segments[segments.length - 1] || `upload-${Date.now()}`;
}

export function isImageAttachment(uri: string) {
  const normalized = normalizedAttachmentPath(uri);
  return (
    normalized.endsWith('.png') ||
    normalized.endsWith('.jpg') ||
    normalized.endsWith('.jpeg') ||
    normalized.endsWith('.webp')
  );
}

export function getAttachmentLabel(uri: string) {
  try {
    return decodeURIComponent(inferFileName(uri));
  } catch {
    return inferFileName(uri);
  }
}

function buildFilePart(uri: string) {
  return {
    uri,
    name: inferFileName(uri),
    type: inferMimeType(uri),
  } as unknown as Blob;
}

export async function uploadSingleAttachment(uri: string) {
  if (!uri || isRemoteAttachment(uri)) {
    return uri;
  }

  const formData = new FormData();
  formData.append('file', buildFilePart(uri));
  const response = await uploadsApi.attachment(formData);
  const normalized = normalizeUploadResult(unwrapEntity(response));
  return normalized.url || uri;
}

export async function uploadAttachments(uris: string[]) {
  const remote = uris.filter((uri) => isRemoteAttachment(uri));
  const local = uris.filter((uri) => !isRemoteAttachment(uri));
  if (!local.length) {
    return remote;
  }

  const formData = new FormData();
  local.forEach((uri) => {
    formData.append('files', buildFilePart(uri));
  });

  const response = await uploadsApi.attachments(formData);
  const record = unwrapEntity<Record<string, unknown>>(response);
  const normalizedItems =
    (Array.isArray(record.items) ? record.items : [])
      .map(normalizeUploadResult)
      .map((item) => item.url)
      .filter(Boolean) || [];
  const urls = Array.isArray(record.urls)
    ? record.urls.map((entry) => String(entry)).filter(Boolean)
    : [];

  return [...remote, ...normalizedItems, ...urls];
}
