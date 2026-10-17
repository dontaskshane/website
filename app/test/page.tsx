import type { Metadata } from 'next';
import { getPhotos, photoUrl } from '@/lib/photos';
import PhotoNameFlow, { type FlowPhoto } from './photo-name-flow';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Test — Shane Wetzel',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function TestPage() {
  const photos = await getPhotos();
  const items: FlowPhoto[] = photos.map((photo) => ({
    id: photo.id,
    title: photo.title || photo.storage_path.split('/').pop() || '',
    url: photoUrl(photo.storage_path),
  }));

  return <PhotoNameFlow photos={items} />;
}
