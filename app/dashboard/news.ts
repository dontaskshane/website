import { createClient } from '@supabase/supabase-js';

export type NewsItem = {
  source: string;
  title: string;
  link: string;
  published: string | null;
};

function firstMatch(xml: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = xml.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .trim();
}

// Minimal RSS 2.0 / Atom parser — titles, links, dates only
function parseFeed(xml: string, sourceName: string, limit = 8): NewsItem[] {
  const items: NewsItem[] = [];
  const blocks =
    xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ??
    xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ??
    [];
  for (const block of blocks.slice(0, limit)) {
    const title = firstMatch(block, [/<title[^>]*>([\s\S]*?)<\/title>/i]);
    const link =
      firstMatch(block, [
        /<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i,
        /<link[^>]*href=["']([^"']+)["']/i,
        /<link[^>]*>([\s\S]*?)<\/link>/i,
      ]) ?? '';
    const published = firstMatch(block, [
      /<pubDate>([\s\S]*?)<\/pubDate>/i,
      /<published>([\s\S]*?)<\/published>/i,
      /<updated>([\s\S]*?)<\/updated>/i,
    ]);
    if (title) {
      items.push({
        source: sourceName,
        title: decodeEntities(title),
        link: decodeEntities(link),
        published,
      });
    }
  }
  return items;
}

export async function getNews(): Promise<NewsItem[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  // news_sources is only readable authenticated; use service-side anon read via RPC-free fallback:
  // sources are not secret — but RLS restricts to authenticated, so fetch with the caller's session
  // instead. To keep this simple and cacheable we read the table with anon and rely on a
  // dedicated read policy added in the migration `news_sources_anon_read`.
  const { data: sources } = await supabase
    .from('news_sources')
    .select('name, feed_url, active')
    .eq('active', true);

  if (!sources?.length) return [];

  const results = await Promise.allSettled(
    sources.map(async (s) => {
      const res = await fetch(s.feed_url, {
        next: { revalidate: 900 },
        headers: { 'user-agent': 'shanewetzel.xyz dashboard' },
      });
      if (!res.ok) return [] as NewsItem[];
      const xml = await res.text();
      return parseFeed(xml, s.name);
    })
  );

  const items = results
    .filter((r): r is PromiseFulfilledResult<NewsItem[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value);

  return items.sort((a, b) => {
    const ta = a.published ? Date.parse(a.published) : 0;
    const tb = b.published ? Date.parse(b.published) : 0;
    return tb - ta;
  });
}
