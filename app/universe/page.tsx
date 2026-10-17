import type { Metadata } from 'next';
import { getPhotos, photoUrl } from '@/lib/photos';
import World, { type WorldPhoto } from './world';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Shane Wetzel',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌀</text></svg>",
  },
};

export default async function UniversePage() {
  const photos = await getPhotos();
  const items: WorldPhoto[] = photos.map((p) => ({
    id: p.id,
    url: photoUrl(p.storage_path),
    width: p.width ?? 1600,
    height: p.height ?? 1067,
  }));
  return <World photos={items} />;
}
