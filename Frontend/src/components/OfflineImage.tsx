import type { ComponentProps } from 'react';
import { useOfflineImage } from '../hooks/useOfflineImage';

export default function OfflineImage(props: ComponentProps<'img'>) {
  const src = useOfflineImage(props.src);
  return <img {...props} src={src} />;
}
