import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileUploadBatch } from '../services/uploadFile.js';

const storage = vi.hoisted(() => ({
  upload: vi.fn(),
  url: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('firebase/app', () => ({ initializeApp: vi.fn() }));
vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(),
  ref: (_storage: unknown, name: string) => name,
  uploadBytesResumable: storage.upload,
  getDownloadURL: storage.url,
  deleteObject: storage.remove,
}));

const file = {
  fieldname: 'avatar',
  originalname: 'avatar.png',
  mimetype: 'image/png',
  size: 2,
  buffer: Buffer.from('ab'),
} as Express.Multer.File;
const oldUrl =
  'https://firebasestorage.googleapis.com/v0/b/bucket/o/avatars%2Fold';
const newUrl =
  'https://firebasestorage.googleapis.com/v0/b/bucket/o/avatars%2Fnew';
beforeEach(() => {
  vi.clearAllMocks();
  storage.upload.mockResolvedValue({ ref: 'new' });
  storage.url.mockResolvedValue(newUrl);
});

describe('file replacement ordering', () => {
  it('keeps the old file if the upload fails', async () => {
    storage.upload.mockRejectedValue(new Error('network failure'));
    const batch = new FileUploadBatch();
    await expect(batch.upload(file, oldUrl)).rejects.toThrow();
    await batch.rollback();
    expect(storage.remove).not.toHaveBeenCalled();
  });
  it('removes only the new file if persistence fails', async () => {
    const batch = new FileUploadBatch();
    await batch.upload(file, oldUrl);
    expect(storage.remove).not.toHaveBeenCalled();
    await batch.rollback();
    expect(storage.remove).toHaveBeenCalledExactlyOnceWith('avatars/new');
  });
  it('removes the old file after persistence and retains the committed file', async () => {
    const batch = new FileUploadBatch();
    await batch.upload(file, oldUrl);
    await batch.commit();
    await batch.rollback();
    expect(storage.remove).toHaveBeenCalledExactlyOnceWith('avatars/old');
  });
});
