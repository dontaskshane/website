import { createClient } from '@supabase/supabase-js';

export type Photo = {
  id: string;
  category: 'digital' | 'analog' | 'iphone';
  storage_path: string;
  title: string;
  width: number | null;
  height: number | null;
  sort: number;
  show_on_home: boolean;
  created_at: string;
};

const STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/`;

export function photoUrl(storagePath: string) {
  return STORAGE_BASE + storagePath;
}

// Cookie-less anon client: public pages stay statically cacheable (ISR)
function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function getPhotos(): Promise<Photo[]> {
  const { data, error } = await publicClient()
    .from('photos')
    .select('id, category, storage_path, title, width, height, sort, show_on_home, created_at')
    .order('category')
    .order('sort')
    .order('created_at');
  if (error) {
    console.error('getPhotos failed:', error.message);
    return [];
  }
  return (data ?? []) as Photo[];
}
