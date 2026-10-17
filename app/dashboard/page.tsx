import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import LoginForm from './login-form';
import Dashboard from './dashboard';
import { getNews } from './news';

export const metadata: Metadata = {
  title: 'Dashboard — Shane Wetzel',
  robots: { index: false, follow: false },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🛰️</text></svg>",
  },
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <LoginForm />;
  }

  const since = new Date();
  since.setDate(since.getDate() - 6);
  const sinceStr = since.toISOString().slice(0, 10);

  const [
    { data: photos },
    { data: sources },
    { data: notes },
    { data: todos },
    { data: links },
    { data: views },
    news,
  ] = await Promise.all([
    supabase
      .from('photos')
      .select('*')
      .order('category')
      .order('sort')
      .order('created_at'),
    supabase.from('news_sources').select('*').order('name'),
    supabase.from('notes').select('*').order('created_at', { ascending: false }),
    supabase.from('todos').select('*').order('created_at', { ascending: false }),
    supabase.from('links').select('*').order('created_at', { ascending: false }),
    supabase.from('page_views').select('count').gte('day', sinceStr),
    getNews(),
  ]);

  const weekViews = (views ?? []).reduce((sum, v) => sum + v.count, 0);

  return (
    <Dashboard
      email={user.email ?? ''}
      photos={photos ?? []}
      sources={sources ?? []}
      notes={notes ?? []}
      todos={todos ?? []}
      links={links ?? []}
      weekViews={weekViews}
      news={news}
    />
  );
}
