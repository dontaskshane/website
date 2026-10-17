import { getPhotos, photoUrl } from '@/lib/photos';
import PhotoNameFlow, { type FlowPhoto } from './test/photo-name-flow';

export const revalidate = 300;

export default async function Page() {
  const photos = await getPhotos();
  const items: FlowPhoto[] = photos.map((photo) => ({
    id: photo.id,
    title: photo.title || photo.storage_path.split('/').pop() || '',
    url: photoUrl(photo.storage_path),
  }));

  return <PhotoNameFlow photos={items} />;
}
