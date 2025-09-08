import {
  getStorage,
  ref,
  getDownloadURL,
  uploadBytesResumable,
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

// Maximum file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function validateImageFile(file: Express.Multer.File): void {
  // Check if file is an image
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new customError(
      'Only image files are allowed (JPEG, PNG, GIF, WebP, SVG)',
      400
    );
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    throw new customError('File size exceeds the 5MB limit', 400);
  }
}

async function uploadFile(file: Express.Multer.File): Promise<fileResponse> {
  // Validate file before uploading
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

export default uploadFile;
