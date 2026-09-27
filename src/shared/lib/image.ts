import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Photos go to the server as multipart, and the server refuses anything over
 * 5MB. A phone camera picture is routinely 4–8MB, so uploading the file the
 * picker hands back fails on most modern phones. Every picked photo is shrunk
 * here first: long edge capped, re-encoded as JPEG, and re-encoded again at a
 * lower quality if it is still too heavy.
 */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Leave headroom under the server limit for the multipart envelope. */
const TARGET_BYTES = 2 * 1024 * 1024;

/** Small enough that shrinking would only cost quality for no gain. */
const LEAVE_ALONE_BYTES = 1.5 * 1024 * 1024;

/** Plenty for a product photo, a bill picture, or a printed logo. */
const MAX_EDGE = 1600;

/** Tried in order until the file fits. */
const QUALITY_STEPS = [0.8, 0.6, 0.45];

/** Bytes on disk, or null when the file cannot be measured. */
export function readFileSize(uri: string): number | null {
  try {
    const size = new File(uri).size;
    return typeof size === 'number' && size > 0 ? size : null;
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

function isLocalFile(uri: string) {
  return uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('data:');
}

/**
 * Returns a uri that is safe to upload. Falls back to the original uri when the
 * image cannot be read or resized, so a picked photo is never silently dropped.
 */
export async function shrinkImageForUpload(uri: string): Promise<string> {
  if (!uri || !isLocalFile(uri)) return uri;

  const originalSize = readFileSize(uri);

  try {
    const source = await ImageManipulator.manipulate(uri).renderAsync();
    const longestEdge = Math.max(source.width, source.height);

    // A modest picture that is already within the pixel cap is left untouched,
    // which also keeps a transparent PNG logo transparent.
    if (longestEdge <= MAX_EDGE && originalSize !== null && originalSize <= LEAVE_ALONE_BYTES) {
      return uri;
    }

    let context = ImageManipulator.manipulate(source);
    if (longestEdge > MAX_EDGE) {
      context =
        source.width >= source.height
          ? context.resize({ width: MAX_EDGE })
          : context.resize({ height: MAX_EDGE });
    }
    const resized = await context.renderAsync();

    let lastUri = uri;
    for (const compress of QUALITY_STEPS) {
      const saved = await resized.saveAsync({ compress, format: SaveFormat.JPEG });
      lastUri = saved.uri;
      const size = readFileSize(saved.uri);
      if (size === null || size <= TARGET_BYTES) return saved.uri;
    }
    return lastUri;
  } catch {
    // Resizing is an optimisation, not a gate. The upload still runs and the
    // caller reports a size problem if the server refuses the file.
    return uri;
  }
}
