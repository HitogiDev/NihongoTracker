import api from './axiosConfig';
import type { IPostDecoration, IPostImage, SocialVisibility } from '../types';
import { apiBaseUrl } from '../utils/nativeRuntime';

export interface PostFormInput {
  content: string;
  visibility: SocialVisibility;
  sensitive: boolean;
  externalImages: string[];
  files: File[];
  /** Edit only: IDs of the current images to keep. */
  keepImageIds?: string[];
  /** null removes the decoration. */
  decoration: PostDecorationPayload | null;
  backgroundFile?: File;
}

export interface PostDecorationPayload {
  border: IPostDecoration['border'];
  background: Omit<IPostDecoration['background'], 'image'> & {
    imageUrl?: string;
    keepImage?: boolean;
  };
}

function toFormData(input: PostFormInput): FormData {
  const form = new FormData();
  form.append('content', input.content);
  form.append('visibility', input.visibility);
  form.append('sensitive', String(input.sensitive));
  form.append('externalImages', JSON.stringify(input.externalImages));
  if (input.keepImageIds) {
    form.append('keepImageIds', JSON.stringify(input.keepImageIds));
  }
  input.files.forEach((file) => form.append('images', file));
  form.append('decoration', JSON.stringify(input.decoration));
  if (input.backgroundFile) form.append('backgroundImage', input.backgroundFile);
  return form;
}

export async function createPostFn(
  input: PostFormInput
): Promise<{ activityId: string }> {
  const { data } = await api.post('/posts', toFormData(input), {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function updatePostFn(
  postId: string,
  input: PostFormInput
): Promise<void> {
  await api.patch(`/posts/${postId}`, toFormData(input), {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export async function deletePostFn(postId: string): Promise<void> {
  await api.delete(`/posts/${postId}`);
}

/** External images load through the server proxy, so viewers never contact the external host. */
export function externalPostImageSrc(url: string): string {
  return `${apiBaseUrl()}posts/image?url=${encodeURIComponent(url)}`;
}

export function postImageSrc(image: Pick<IPostImage, 'url' | 'source'>): string {
  return image.source === 'hosted' ? image.url : externalPostImageSrc(image.url);
}
