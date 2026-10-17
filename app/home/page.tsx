import type { Metadata } from 'next';
import { getPhotos, photoUrl } from '@/lib/photos';
import Home from '../home';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Shane Wetzel — Home',
};

export default async function HomePage() {
  const photos = await getPhotos();
  const curated = photos.filter((photo) => photo.show_on_home);
  const pool = (curated.length >= 6 ? curated : photos).map((photo) =>
    photoUrl(photo.storage_path)
  );

  return <Home backdropUrls={pool} />;
}
