import axiosInstance from '../api/axiosConfig';

export async function uploadFile(
  file: File,
  fieldName: string
): Promise<string> {
  try {
    const formData = new FormData();
    formData.append(fieldName, file);

    const { data } = await axiosInstance.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return data.downloadURL;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
}
