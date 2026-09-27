function attachmentPath(uri: string) {
  return uri.split(/[?#]/)[0].toLowerCase();
}

export function attachmentMimeType(uri: string) {
  const extension = attachmentPath(uri).split('.').pop();
  const types: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
    heic: 'image/heic', heif: 'image/heif', gif: 'image/gif',
    pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return types[extension ?? ''] ?? 'application/octet-stream';
}

export function isImageAttachment(uri: string) {
  return attachmentMimeType(uri).startsWith('image/') || uri.startsWith('data:image/');
}

export function attachmentFileName(uri: string) {
  const path = uri.split(/[?#]/)[0];
  return path.split('/').pop() || 'attachment';
}

/** A partial response must not silently discard one of the selected files. */
export function completeUploadUrls(items: string[], urls: unknown[], expected: number) {
  const directUrls = urls.filter((url): url is string => typeof url === 'string' && Boolean(url.trim()));
  const itemUrls = items.filter((url) => Boolean(url.trim()));
  if (itemUrls.length === expected) return itemUrls;
  if (directUrls.length === expected) return directUrls;
  throw new Error('The server did not return links for every file. Please try again.');
}
