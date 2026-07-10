'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
type Activity = { id: number; kind: string; detail: string; created_at: string };
type ViewRow = { day: string; path: string; count: number };

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
          id="photo-file-input"
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
                  aria-label={`${p.title} auf der Startseite ${p.show_on_home ? 'ausblenden' : 'zeigen'}`}
                  aria-pressed={p.show_on_home}
                  onClick={() => toggleHome(p)}
                >
                  {p.show_on_home ? '🏠' : '▢'}
                </button>
                <button
                  title="Löschen"
                  aria-label={`${p.title} löschen`}
                  onClick={() => remove(p)}
                >
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
          id="note-input"
          placeholder="Neue Notiz…"
          aria-label="Neue Notiz"
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

/* ================= Quick actions ================= */
function QuickActions({ onRevalidated }: { onRevalidated: () => void }) {
  const [busy, setBusy] = useState(false);

  async function refreshCache() {
    setBusy(true);
    await revalidatePublicPages();
    setBusy(false);
    onRevalidated();
  }

  return (
    <section className={styles.widget}>
      <div className={styles.quickGrid}>
        <button
          className={styles.quickBtn}
          onClick={() => document.getElementById('photo-file-input')?.click()}
        >
          <span className={styles.quickIcon}>📤</span>
          Foto hochladen
        </button>
        <button
          className={styles.quickBtn}
          onClick={() => {
            const el = document.getElementById('note-input') as HTMLInputElement | null;
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => el?.focus(), 350);
          }}
        >
          <span className={styles.quickIcon}>📝</span>
          Neue Notiz
        </button>
        <button className={styles.quickBtn} onClick={refreshCache} disabled={busy}>
          <span className={styles.quickIcon}>{busy ? '⏳' : '♻️'}</span>
          Cache aktualisieren
        </button>
        <a className={styles.quickBtn} href="/" target="_blank" rel="noopener">
          <span className={styles.quickIcon}>🌍</span>
          Website ansehen
        </a>
      </div>
    </section>
  );
}

/* ================= Stats / analytics snapshot ================= */
function StatsWidget({
  photoCount,
  openNotes,
  views,
}: {
  photoCount: number;
  openNotes: number;
  views: ViewRow[];
}) {
  // Aggregate daily totals for the last 14 days
  const days: { label: string; total: number }[] = [];
  const byDay = new Map<string, number>();
  for (const v of views) byDay.set(v.day, (byDay.get(v.day) ?? 0) + v.count);
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({
      label: d.toLocaleDateString('de-CH', { day: 'numeric', month: 'short' }),
      total: byDay.get(key) ?? 0,
    });
  }
  const today = days[days.length - 1].total;
  const week = days.slice(-7).reduce((s, d) => s + d.total, 0);
  const max = Math.max(1, ...days.map((d) => d.total));

  const W = 280;
  const H = 56;
  const bw = W / days.length;

  return (
    <section className={styles.widget}>
      <div className={styles.widgetHead}>
        <h2>📊 Statistik</h2>
        <span className={styles.widgetMeta}>letzte 14 Tage</span>
      </div>
      <div className={styles.kpiRow}>
        <div className={styles.kpi}>
          <span className={styles.kpiNum}>{today}</span>
          <span className={styles.kpiLabel}>Views heute</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiNum}>{week}</span>
          <span className={styles.kpiLabel}>Views 7 Tage</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiNum}>{photoCount}</span>
          <span className={styles.kpiLabel}>Fotos</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiNum}>{openNotes}</span>
          <span className={styles.kpiLabel}>offene Notizen</span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.sparkline}
        role="img"
        aria-label={`Seitenaufrufe der letzten 14 Tage, heute ${today}`}
      >
        {days.map((d, i) => {
          const h = Math.max(2, (d.total / max) * (H - 4));
          return (
            <rect
              key={i}
              x={i * bw + 2}
              y={H - h}
              width={bw - 4}
              height={h}
              rx={2}
              className={
                i === days.length - 1 ? styles.sparkBarToday : styles.sparkBar
              }
            >
              <title>{`${d.label}: ${d.total}`}</title>
            </rect>
          );
        })}
      </svg>
    </section>
  );
}

/* ================= Activity feed ================= */
const ACTIVITY_META: Record<string, { icon: string; label: string }> = {
  photo_added: { icon: '📷', label: 'Foto hinzugefügt' },
  photo_deleted: { icon: '🗑', label: 'Foto gelöscht' },
  note_added: { icon: '📝', label: 'Notiz erstellt' },
  source_added: { icon: '📰', label: 'News-Quelle hinzugefügt' },
  source_removed: { icon: '📰', label: 'News-Quelle entfernt' },
};

function relativeTime(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'gerade eben';
  if (s < 3600) return `vor ${Math.floor(s / 60)} Min`;
  if (s < 86400) return `vor ${Math.floor(s / 3600)} Std`;
  if (s < 7 * 86400) return `vor ${Math.floor(s / 86400)} Tagen`;
  return new Date(iso).toLocaleDateString('de-CH', { day: 'numeric', month: 'short' });
}

function ActivityFeed({ activity }: { activity: Activity[] }) {
  return (
    <section className={styles.widget}>
      <div className={styles.widgetHead}>
        <h2>🕘 Aktivität</h2>
      </div>
      {activity.length ? (
        <ul className={styles.activityList}>
          {activity.map((a) => {
            const meta = ACTIVITY_META[a.kind] ?? { icon: '•', label: a.kind };
            return (
              <li key={a.id}>
                <span className={styles.activityIcon}>{meta.icon}</span>
                <span className={styles.activityBody}>
                  <span className={styles.activityLabel}>{meta.label}</span>
                  {a.detail && <span className={styles.activityDetail}>{a.detail}</span>}
                </span>
                <span className={styles.activityTime}>{relativeTime(a.created_at)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.empty}>
          Noch keine Einträge — Aktionen wie Uploads erscheinen hier automatisch.
        </p>
      )}
    </section>
  );
}

/* ================= Command bar (⌘K) ================= */
type Command = { label: string; hint: string; run: () => void };

function CommandBar({
  open,
  onClose,
  commands,
}: {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  if (!open) return null;

  return (
    <div
      className={styles.cmdOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.cmdPanel} role="dialog" aria-label="Befehle">
        <input
          ref={inputRef}
          className={styles.cmdInput}
          placeholder="Wohin oder was? (Esc zum Schliessen)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' && filtered[index]) {
              onClose();
              filtered[index].run();
            } else if (e.key === 'Escape') {
              onClose();
            }
          }}
        />
        <ul className={styles.cmdList}>
          {filtered.map((c, i) => (
            <li key={c.label}>
              <button
                className={`${styles.cmdItem} ${i === index ? styles.cmdItemActive : ''}`}
                onMouseEnter={() => setIndex(i)}
                onClick={() => {
                  onClose();
                  c.run();
                }}
              >
                <span>{c.label}</span>
                <span className={styles.cmdHint}>{c.hint}</span>
              </button>
            </li>
          ))}
          {!filtered.length && <li className={styles.empty}>Nichts gefunden.</li>}
        </ul>
      </div>
    </div>
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
  activity,
  views,
  news,
}: {
  email: string;
  photos: Photo[];
  sources: Source[];
  notes: Note[];
  activity: Activity[];
  views: ViewRow[];
  news: NewsItem[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [cmdOpen, setCmdOpen] = useState(false);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.refresh();
  }, [supabase, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const commands: Command[] = useMemo(
    () => [
      {
        label: '📤 Foto hochladen',
        hint: 'Upload',
        run: () => document.getElementById('photo-file-input')?.click(),
      },
      {
        label: '📝 Neue Notiz',
        hint: 'Fokus aufs Notizfeld',
        run: () => {
          const el = document.getElementById('note-input') as HTMLInputElement | null;
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => el?.focus(), 350);
        },
      },
      {
        label: '♻️ Cache aktualisieren',
        hint: 'Öffentliche Seiten neu bauen',
        run: () => void revalidatePublicPages(),
      },
      { label: '🌍 Startseite', hint: 'shanewetzel.xyz', run: () => window.open('/', '_blank') },
      { label: '📁 Work', hint: '/work', run: () => window.open('/work', '_blank') },
      { label: '🌀 Universe', hint: '/universe', run: () => window.open('/universe', '_blank') },
      {
        label: '▲ Vercel-Projekt',
        hint: 'Deployments & Domains',
        run: () => window.open('https://vercel.com/dontaskshanes-projects/shanewetzel-xyz', '_blank'),
      },
      {
        label: '⚡️ Supabase-Projekt',
        hint: 'Datenbank & Storage',
        run: () => window.open('https://supabase.com/dashboard/project/xjgnclvqhpdhdvqucpcc', '_blank'),
      },
      { label: '🚪 Abmelden', hint: 'Session beenden', run: () => void signOut() },
    ],
    [signOut]
  );

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
          <button
            className={styles.btnGhostSm}
            onClick={() => setCmdOpen(true)}
            aria-label="Befehle öffnen"
          >
            ⌘K
          </button>
          <span className={styles.email}>{email}</span>
          <button className={styles.btnGhostSm} onClick={signOut}>
            Abmelden
          </button>
        </div>
      </header>

      <main className={styles.grid}>
        <div className={styles.colWide}>
          <QuickActions onRevalidated={() => router.refresh()} />
          <PhotoManager initial={photos} />
        </div>
        <div className={styles.colNarrow}>
          <StatsWidget
            photoCount={photos.length}
            openNotes={notes.filter((n) => !n.done).length}
            views={views}
          />
          <ActivityFeed activity={activity} />
          <NewsWidget news={news} sources={sources} />
          <NotesWidget initial={notes} />
          <PasswordWidget />
        </div>
      </main>

      <CommandBar open={cmdOpen} onClose={() => setCmdOpen(false)} commands={commands} />
    </div>
  );
}
