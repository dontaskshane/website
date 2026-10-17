import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { path } = await req.json();
    if (typeof path === 'string' && path.startsWith('/') && !path.startsWith('/dashboard')) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } }
      );
      await supabase.rpc('track_page_view', { p_path: path });
    }
  } catch {
    // never fail the beacon
  }
  return NextResponse.json({ ok: true });
}
