import { getPhotos, photoUrl } from '@/lib/photos';
import Home from './home';

export const revalidate = 300;

export default async function Page() {
  const photos = await getPhotos();
  const curated = photos.filter((p) => p.show_on_home);
  const pool = (curated.length >= 6 ? curated : photos).map((p) =>
    photoUrl(p.storage_path)
  );
  return <Home backdropUrls={pool} />;
}
