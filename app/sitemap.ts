import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://shanewetzel.xyz';
  return [
    { url: base, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/work`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/universe`, changeFrequency: 'weekly', priority: 0.8 },
  ];
}
