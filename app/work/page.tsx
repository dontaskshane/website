import type { Metadata } from 'next';
import { getPhotos, photoUrl } from '@/lib/photos';
import Gallery, { type GalleryPhoto } from './gallery';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Shane Wetzel — Work',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📁</text></svg>",
  },
};

export default async function WorkPage() {
  const photos = await getPhotos();
  const items: GalleryPhoto[] = photos.map((p) => ({
    id: p.id,
    category: p.category,
    url: photoUrl(p.storage_path),
    title: p.title || p.storage_path.split('/').pop() || '',
    width: p.width ?? 1600,
    height: p.height ?? 1067,
  }));
  return <Gallery photos={items} />;
}
