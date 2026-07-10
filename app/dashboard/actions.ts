'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// Bust the ISR cache of the public pages after content changes
export async function revalidatePublicPages() {
  revalidatePath('/');
  revalidatePath('/work');
  revalidatePath('/universe');
}

// Fetch a page's <title> for the link stash; falls back to the hostname
export async function fetchPageTitle(url: string): Promise<string> {
  // Only for the logged-in dashboard user — this action can fetch arbitrary URLs
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return '';

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return '';
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';

  const fallback = parsed.hostname.replace(/^www\./, '');
  try {
    const res = await fetch(parsed.href, {
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; shanewetzel.xyz link stash)' },
    });
    if (!res.ok) return fallback;
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('text/html')) return fallback;
    const html = (await res.text()).slice(0, 100_000);
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!m) return fallback;
    const title = m[1]
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
      .replace(/\s+/g, ' ')
      .trim();
    return title.slice(0, 200) || fallback;
  } catch {
    return fallback;
  }
}
