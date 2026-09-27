import test from 'node:test';
import assert from 'node:assert/strict';
import { attachmentFileName, attachmentMimeType, completeUploadUrls, isImageAttachment } from '../src/shared/lib/upload-files.ts';

test('phone image formats and document types retain the correct MIME type', () => {
  assert.equal(isImageAttachment('file:///camera/IMG_123.HEIC'), true);
  assert.equal(isImageAttachment('content://photos/123.heif'), true);
  assert.equal(isImageAttachment('data:image/jpeg;base64,abc'), true);
  assert.equal(attachmentMimeType('file:///bill.JPG?cache=1'), 'image/jpeg');
  assert.equal(attachmentMimeType('file:///bill.pdf'), 'application/pdf');
  assert.equal(isImageAttachment('file:///bill.pdf'), false);
  assert.equal(attachmentFileName('file:///bill.jpg?cache=1#preview'), 'bill.jpg');
});

test('upload responses never duplicate attachments or accept missing links', () => {
  const urls = ['https://files.test/a.jpg', 'https://files.test/b.jpg'];
  assert.deepEqual(completeUploadUrls(urls, urls, 2), urls);
  assert.deepEqual(completeUploadUrls([], urls, 2), urls);
  assert.throws(() => completeUploadUrls([urls[0]], [], 2), /every file/);
  assert.throws(() => completeUploadUrls([], [null, {}], 2), /every file/);
});
