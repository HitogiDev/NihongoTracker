import {
  getStorage,
  ref,
  getDownloadURL,
  uploadBytesResumable,
  deleteObject,
} from 'firebase/storage';
import { firebaseConfig } from '../firebaseConfig.js';
import { initializeApp } from 'firebase/app';
import { customError } from '../middlewares/errorMiddleware.js';

initializeApp(firebaseConfig);

const storage = getStorage();

type fileResponse = {
  message: string;
  name: string;
  type: string;
  size: number;
  downloadURL: string;
};

// Allowed image MIME types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

// Maximum file size (2MB)
const MAX_FILE_SIZE = 2 * 1024 * 1024;

function validateImageFile(file: Express.Multer.File): void {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new customError(
      'Only image files are allowed (JPEG, PNG, GIF, WebP, SVG)',
      400
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new customError('File size exceeds the 2MB limit', 400);
  }
}

async function uploadFile(file: Express.Multer.File): Promise<fileResponse> {
  validateImageFile(file);

  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const storageRef = ref(
    storage,
    `${file.fieldname}s/${file.fieldname}-${uniqueSuffix}`
  );
  const metadata = { contentType: file.mimetype };

  try {
    const snapshot = await uploadBytesResumable(
      storageRef,
      new Uint8Array(file.buffer),
      metadata
    );

    const downloadURL = await getDownloadURL(snapshot.ref);

    return {
      message: 'File uploaded successfully',
      name: file.originalname,
      type: file.mimetype,
      size: file.size,
      downloadURL: downloadURL,
    };
  } catch (error) {
    console.error('Firebase upload error:', error);
    throw new customError('Error uploading file to storage', 500);
  }
}

// Function to upload a new file and automatically delete the old one
export async function uploadFileWithCleanup(
  file: Express.Multer.File,
  oldFileUrl?: string
): Promise<fileResponse> {
  // Delete old file first if it exists
  if (oldFileUrl) {
    await deleteFile(oldFileUrl);
  } else {
    console.log('No old file URL provided, skipping deletion');
  }

  // Upload new file
  return await uploadFile(file);
}

// Function to delete a file from Firebase Storage
export async function deleteFile(fileUrl: string): Promise<void> {
  if (!fileUrl) {
    console.log('No file URL provided, returning early');
    return;
  }

  try {
    // Extract the file path from the Firebase Storage URL
    const url = new URL(fileUrl);

    // Check if it's a Firebase Storage URL
    if (!url.hostname.includes('firebasestorage.googleapis.com')) {
      console.warn('Not a Firebase Storage URL, skipping deletion:', fileUrl);
      return;
    }

    // Extract the file path from the URL
    const pathMatch = url.pathname.match(/\/o\/(.+)$/);
    if (!pathMatch) {
      console.warn('Could not extract file path from URL:', fileUrl);
      return;
    }

    const filePath = decodeURIComponent(pathMatch[1]);
    const fileRef = ref(storage, filePath);

    await deleteObject(fileRef);
  } catch (error: any) {
    // Don't throw error if file doesn't exist (already deleted)
    if (error.code === 'storage/object-not-found') {
      console.log('File already deleted or does not exist:', fileUrl);
    } else {
      console.error('Error deleting file from Firebase:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        url: fileUrl,
      });
      // Log but don't throw to prevent blocking user updates
    }
  }
}

export default uploadFile;
