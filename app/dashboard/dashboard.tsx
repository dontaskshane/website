'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { revalidatePublicPages } from './actions';
import type { NewsItem } from './news';
import styles from './dashboard.module.css';

type Photo = {
  id: string;
  category: 'digital' | 'analog' | 'iphone';
  storage_path: string;
  title: string;
  width: number | null;
  height: number | null;
  sort: number;
  show_on_home: boolean;
};

type Source = { id: string; name: string; feed_url: string; active: boolean };
type Note = { id: string; body: string; done: boolean };

const STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/`;
const CATEGORIES = ['digital', 'analog', 'iphone'] as const;

/* ---------- image compression: max 2400px, JPEG q0.82 ---------- */
async function compressImage(
  file: File
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const MAX = 2400;
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('compress failed'))),
      'image/jpeg',
      0.82
    )
  );
  return { blob, width: w, height: h };
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/* ================= Photo manager ================= */
function PhotoManager({ initial }: { initial: Photo[] }) {
  const [photos, setPhotos] = useState(initial);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('digital');
  const [filter, setFilter] = useState<'all' | (typeof CATEGORIES)[number]>('all');
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => createClient(), []);

  const shown =
    filter === 'all' ? photos : photos.filter((p) => p.category === filter);

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      setUploading(`${i + 1}/${list.length} — ${file.name}`);
      try {
        const { blob, width, height } = await compressImage(file);
        const path = `${category}/${slugify(file.name)}-${Date.now().toString(36)}.jpg`;
        const { error: upErr } = await supabase.storage
          .from('photos')
          .upload(path, blob, { contentType: 'image/jpeg' });
        if (upErr) throw upErr;
        const { data, error: insErr } = await supabase
          .from('photos')
          .insert({
            category,
            storage_path: path,
            title: slugify(file.name),
            width,
            height,
          })
          .select()
          .single();
        if (insErr) throw insErr;
        setPhotos((cur) => [...cur, data as Photo]);
      } catch (err) {
        alert(`Upload von ${file.name} fehlgeschlagen: ${(err as Error).message}`);
      }
    }
    setUploading(null);
    await revalidatePublicPages();
  }

  async function remove(photo: Photo) {
    if (!confirm(`«${photo.title}» wirklich löschen?`)) return;
    await supabase.storage.from('photos').remove([photo.storage_path]);
    const { error } = await supabase.from('photos').delete().eq('id', photo.id);
    if (error) {
      alert(error.message);
      return;
    }
    setPhotos((cur) => cur.filter((p) => p.id !== photo.id));
    await revalidatePublicPages();
  }

  async function toggleHome(photo: Photo) {
    const { error } = await supabase
      .from('photos')
      .update({ show_on_home: !photo.show_on_home })
      .eq('id', photo.id);
    if (error) {
      alert(error.message);
      return;
    }
    setPhotos((cur) =>
      cur.map((p) =>
        p.id === photo.id ? { ...p, show_on_home: !p.show_on_home } : p
      )
    );
    await revalidatePublicPages();
  }

  async function changeCategory(photo: Photo, cat: Photo['category']) {
    const { error } = await supabase
      .from('photos')
      .update({ category: cat })
      .eq('id', photo.id);
    if (error) {
      alert(error.message);
      return;
    }
    setPhotos((cur) =>
      cur.map((p) => (p.id === photo.id ? { ...p, category: cat } : p))
    );
    await revalidatePublicPages();
  }

  return (
    <section className={styles.widget}>
      <div className={styles.widgetHead}>
        <h2>📷 Fotos</h2>
        <span className={styles.widgetMeta}>{photos.length} total</span>
      </div>

      <div
        className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? (
          <span>⏳ {uploading}</span>
        ) : (
          <span>
            Bilder hierhin ziehen oder klicken — landen in{' '}
            <select
              value={category}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) =>
                setCategory(e.target.value as (typeof CATEGORIES)[number])
              }
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </span>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      <div className={styles.filterRow}>
        {(['all', ...CATEGORIES] as const).map((f) => (
          <button
            key={f}
            className={`${styles.chip} ${filter === f ? styles.chipActive : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Alle' : f}
          </button>
        ))}
      </div>

      <div className={styles.photoGrid}>
        {shown.map((p) => (
          <div key={p.id} className={styles.photoCard}>
            <div className={styles.photoThumb}>
              <Image
                src={STORAGE_BASE + p.storage_path}
                alt={p.title}
                fill
                sizes="160px"
                className={styles.photoImg}
              />
              {p.show_on_home && <span className={styles.homeBadge}>🏠</span>}
            </div>
            <div className={styles.photoMeta}>
              <span className={styles.photoTitle}>{p.title}</span>
              <div className={styles.photoActions}>
                <select
                  value={p.category}
                  onChange={(e) =>
                    changeCategory(p, e.target.value as Photo['category'])
                  }
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  title="Auf der Startseite zeigen"
                  onClick={() => toggleHome(p)}
                >
                  {p.show_on_home ? '🏠' : '▢'}
                </button>
                <button title="Löschen" onClick={() => remove(p)}>
                  🗑
                </button>
              </div>
            </div>
          </div>
        ))}
        {!shown.length && <p className={styles.empty}>Keine Fotos hier.</p>}
      </div>
    </section>
  );
}

/* ================= News ================= */
function NewsWidget({
  news,
  sources: initialSources,
}: {
  news: NewsItem[];
  sources: Source[];
}) {
  const [sources, setSources] = useState(initialSources);
  const [manage, setManage] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  async function addSource(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase
      .from('news_sources')
      .insert({ name, feed_url: url })
      .select()
      .single();
    if (error) {
      alert(error.message);
      return;
    }
    setSources((cur) => [...cur, data as Source]);
    setName('');
    setUrl('');
    router.refresh();
  }

  async function toggleSource(s: Source) {
    const { error } = await supabase
      .from('news_sources')
      .update({ active: !s.active })
      .eq('id', s.id);
    if (error) return alert(error.message);
    setSources((cur) =>
      cur.map((x) => (x.id === s.id ? { ...x, active: !x.active } : x))
    );
    router.refresh();
  }

  async function removeSource(s: Source) {
    if (!confirm(`Quelle «${s.name}» entfernen?`)) return;
    const { error } = await supabase.from('news_sources').delete().eq('id', s.id);
    if (error) return alert(error.message);
    setSources((cur) => cur.filter((x) => x.id !== s.id));
    router.refresh();
  }

  return (
    <section className={styles.widget}>
      <div className={styles.widgetHead}>
        <h2>📰 News</h2>
        <button className={styles.btnGhostSm} onClick={() => setManage(!manage)}>
          {manage ? 'Fertig' : 'Quellen'}
        </button>
      </div>

      {manage && (
        <div className={styles.sourceManager}>
          {sources.map((s) => (
            <div key={s.id} className={styles.sourceRow}>
              <button
                className={styles.srcToggle}
                onClick={() => toggleSource(s)}
                title={s.active ? 'aktiv' : 'pausiert'}
              >
                {s.active ? '🟢' : '⚪️'}
              </button>
              <span className={styles.srcName}>{s.name}</span>
              <button className={styles.srcDelete} onClick={() => removeSource(s)}>
                ✕
              </button>
            </div>
          ))}
          <form className={styles.sourceForm} onSubmit={addSource}>
            <input
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              placeholder="RSS-Feed-URL"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
            <button type="submit" className={styles.btnPrimarySm}>
              +
            </button>
          </form>
        </div>
      )}

      <ul className={styles.newsList}>
        {news.slice(0, 24).map((n, i) => (
          <li key={i}>
            <a href={n.link} target="_blank" rel="noopener noreferrer">
              <span className={styles.newsSource}>{n.source}</span>
              <span className={styles.newsTitle}>{n.title}</span>
              {n.published && (
                <span className={styles.newsTime}>
                  {new Date(n.published).toLocaleString('de-CH', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </a>
          </li>
        ))}
        {!news.length && <p className={styles.empty}>Keine News geladen.</p>}
      </ul>
    </section>
  );
}

/* ================= Notes ================= */
function NotesWidget({ initial }: { initial: Note[] }) {
  const [notes, setNotes] = useState(initial);
  const [body, setBody] = useState('');
  const supabase = useMemo(() => createClient(), []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    const { data, error } = await supabase
      .from('notes')
      .insert({ body: body.trim() })
      .select()
      .single();
    if (error) return alert(error.message);
    setNotes((cur) => [data as Note, ...cur]);
    setBody('');
  }

  async function toggle(n: Note) {
    const { error } = await supabase
      .from('notes')
      .update({ done: !n.done })
      .eq('id', n.id);
    if (error) return alert(error.message);
    setNotes((cur) =>
      cur.map((x) => (x.id === n.id ? { ...x, done: !x.done } : x))
    );
  }

  async function remove(n: Note) {
    const { error } = await supabase.from('notes').delete().eq('id', n.id);
    if (error) return alert(error.message);
    setNotes((cur) => cur.filter((x) => x.id !== n.id));
  }

  return (
    <section className={styles.widget}>
      <div className={styles.widgetHead}>
        <h2>📝 Notizen</h2>
      </div>
      <form className={styles.noteForm} onSubmit={add}>
        <input
          placeholder="Neue Notiz…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button type="submit" className={styles.btnPrimarySm}>
          +
        </button>
      </form>
      <ul className={styles.noteList}>
        {notes.map((n) => (
          <li key={n.id} className={n.done ? styles.noteDone : ''}>
            <button className={styles.noteCheck} onClick={() => toggle(n)}>
              {n.done ? '☑︎' : '☐'}
            </button>
            <span>{n.body}</span>
            <button className={styles.noteDelete} onClick={() => remove(n)}>
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ================= Password ================= */
function PasswordWidget() {
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  async function change(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg('Passwort geändert ✓');
    setPw('');
  }

  return (
    <section className={styles.widget}>
      <div className={styles.widgetHead}>
        <h2>🔐 Konto</h2>
        <button className={styles.btnGhostSm} onClick={() => setOpen(!open)}>
          {open ? 'Schliessen' : 'Passwort ändern'}
        </button>
      </div>
      {open && (
        <form className={styles.noteForm} onSubmit={change}>
          <input
            type="password"
            placeholder="Neues Passwort (min. 8 Zeichen)"
            value={pw}
            minLength={8}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="new-password"
            required
          />
          <button type="submit" className={styles.btnPrimarySm}>
            OK
          </button>
        </form>
      )}
      {msg && <p className={styles.empty}>{msg}</p>}
    </section>
  );
}

/* ================= Shell ================= */
export default function Dashboard({
  email,
  photos,
  sources,
  notes,
  news,
}: {
  email: string;
  photos: Photo[];
  sources: Source[];
  notes: Note[];
  news: NewsItem[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  async function signOut() {
    await supabase.auth.signOut();
    router.refresh();
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <span className={styles.logo}>🛰️ Dashboard</span>
          <nav className={styles.topnav}>
            <Link href="/">Startseite</Link>
            <Link href="/work">Work</Link>
            <Link href="/universe">Universe</Link>
          </nav>
        </div>
        <div className={styles.topbarRight}>
          <span className={styles.email}>{email}</span>
          <button className={styles.btnGhostSm} onClick={signOut}>
            Abmelden
          </button>
        </div>
      </header>

      <main className={styles.grid}>
        <div className={styles.colWide}>
          <PhotoManager initial={photos} />
        </div>
        <div className={styles.colNarrow}>
          <NewsWidget news={news} sources={sources} />
          <NotesWidget initial={notes} />
          <PasswordWidget />
        </div>
      </main>
    </div>
  );
}
