'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { revalidatePublicPages, fetchPageTitle } from './actions';
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
type Note = { id: string; body: string; pinned: boolean; created_at: string; updated_at: string };
type Todo = {
  id: string;
  body: string;
  due_date: string | null;
  done: boolean;
  done_at: string | null;
  created_at: string;
};
type LinkItem = { id: string; url: string; title: string; comment: string; created_at: string };

const STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/`;
const CATEGORIES = ['digital', 'analog', 'iphone'] as const;

function relativeTime(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'gerade eben';
  if (s < 3600) return `vor ${Math.floor(s / 60)} Min`;
  if (s < 86400) return `vor ${Math.floor(s / 3600)} Std`;
  if (s < 7 * 86400) return `vor ${Math.floor(s / 86400)} Tagen`;
  return new Date(iso).toLocaleDateString('de-CH', { day: 'numeric', month: 'short' });
}

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

/* ================= Todos ================= */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dueLabel(due: string): string {
  const today = todayStr();
  if (due === today) return 'heute';
  const d = new Date(due + 'T00:00');
  const t = new Date(today + 'T00:00');
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diff === 1) return 'morgen';
  if (diff === -1) return 'gestern';
  if (diff < 0) return d.toLocaleDateString('de-CH', { day: 'numeric', month: 'short' });
  if (diff < 7) return d.toLocaleDateString('de-CH', { weekday: 'long' });
  return d.toLocaleDateString('de-CH', { day: 'numeric', month: 'short' });
}

function TodosWidget({ initial }: { initial: Todo[] }) {
  const [todos, setTodos] = useState(initial);
  const [body, setBody] = useState('');
  const [due, setDue] = useState('');
  const [showDone, setShowDone] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const today = todayStr();
  const open = todos.filter((t) => !t.done);
  const done = todos
    .filter((t) => t.done)
    .sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''));

  const overdue = open
    .filter((t) => t.due_date && t.due_date < today)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!));
  const dueToday = open.filter((t) => t.due_date === today);
  const upcoming = open
    .filter((t) => t.due_date && t.due_date > today)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!));
  const someday = open.filter((t) => !t.due_date);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    const { data, error } = await supabase
      .from('todos')
      .insert({ body: body.trim(), due_date: due || null })
      .select()
      .single();
    if (error) return alert(error.message);
    setTodos((cur) => [data as Todo, ...cur]);
    setBody('');
    setDue('');
  }

  async function toggle(t: Todo) {
    const patch = t.done
      ? { done: false, done_at: null }
      : { done: true, done_at: new Date().toISOString() };
    const { error } = await supabase.from('todos').update(patch).eq('id', t.id);
    if (error) return alert(error.message);
    setTodos((cur) => cur.map((x) => (x.id === t.id ? { ...x, ...patch } : x)));
  }

  async function remove(t: Todo) {
    const { error } = await supabase.from('todos').delete().eq('id', t.id);
    if (error) return alert(error.message);
    setTodos((cur) => cur.filter((x) => x.id !== t.id));
  }

  async function clearDone() {
    const ids = done.map((t) => t.id);
    if (!ids.length) return;
    const { error } = await supabase.from('todos').delete().in('id', ids);
    if (error) return alert(error.message);
    setTodos((cur) => cur.filter((x) => !x.done));
    setShowDone(false);
  }

  function section(title: string, items: Todo[], overdueStyle = false) {
    if (!items.length) return null;
    return (
      <div className={styles.todoSection}>
        <div className={`${styles.todoSectionTitle} ${overdueStyle ? styles.todoOverdueTitle : ''}`}>
          {title}
        </div>
        <ul className={styles.todoList}>
          {items.map((t) => (
            <li key={t.id}>
              <button
                className={styles.todoCheck}
                aria-label={`${t.body} erledigt`}
                onClick={() => toggle(t)}
              >
                ○
              </button>
              <span className={styles.todoBody}>{t.body}</span>
              {t.due_date && (
                <span
                  className={`${styles.todoDue} ${
                    t.due_date < today ? styles.todoDueOverdue : ''
                  } ${t.due_date === today ? styles.todoDueToday : ''}`}
                >
                  {dueLabel(t.due_date)}
                </span>
              )}
              <button
                className={styles.todoDelete}
                aria-label={`${t.body} löschen`}
                onClick={() => remove(t)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <section className={styles.widget}>
      <div className={styles.widgetHead}>
        <h2>☑️ Todos</h2>
        <span className={styles.widgetMeta}>
          {open.length ? `${open.length} offen` : 'alles erledigt ✨'}
        </span>
      </div>

      <form className={styles.todoForm} onSubmit={add}>
        <input
          id="todo-input"
          placeholder="Was steht an?"
          aria-label="Neues Todo"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <input
          type="date"
          aria-label="Fällig am"
          value={due}
          min={today}
          onChange={(e) => setDue(e.target.value)}
        />
        <button type="submit" className={styles.btnPrimarySm}>
          +
        </button>
      </form>

      {section('Überfällig', overdue, true)}
      {section('Heute', dueToday)}
      {section('Demnächst', upcoming)}
      {section('Irgendwann', someday)}

      {!open.length && !done.length && (
        <p className={styles.empty}>Nichts offen. Geniess den Tag.</p>
      )}

      {done.length > 0 && (
        <div className={styles.todoDoneBar}>
          <button className={styles.btnGhost} onClick={() => setShowDone(!showDone)}>
            {showDone ? '▾' : '▸'} Erledigt ({done.length})
          </button>
          {showDone && (
            <button className={styles.btnGhost} onClick={clearDone}>
              Aufräumen
            </button>
          )}
        </div>
      )}
      {showDone && (
        <ul className={`${styles.todoList} ${styles.todoListDone}`}>
          {done.map((t) => (
            <li key={t.id}>
              <button
                className={styles.todoCheck}
                aria-label={`${t.body} wieder öffnen`}
                onClick={() => toggle(t)}
              >
                ●
              </button>
              <span className={`${styles.todoBody} ${styles.todoBodyDone}`}>{t.body}</span>
              <button
                className={styles.todoDelete}
                aria-label={`${t.body} löschen`}
                onClick={() => remove(t)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ================= Notes ================= */
function NotesWidget({ initial }: { initial: Note[] }) {
  const [notes, setNotes] = useState(initial);
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const supabase = useMemo(() => createClient(), []);

  const sorted = [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updated_at.localeCompare(a.updated_at);
  });

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

  async function saveEdit(n: Note) {
    const next = editBody.trim();
    if (!next || next === n.body) {
      setEditing(null);
      return;
    }
    const patch = { body: next, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('notes').update(patch).eq('id', n.id);
    if (error) return alert(error.message);
    setNotes((cur) => cur.map((x) => (x.id === n.id ? { ...x, ...patch } : x)));
    setEditing(null);
  }

  async function togglePin(n: Note) {
    const { error } = await supabase
      .from('notes')
      .update({ pinned: !n.pinned })
      .eq('id', n.id);
    if (error) return alert(error.message);
    setNotes((cur) =>
      cur.map((x) => (x.id === n.id ? { ...x, pinned: !x.pinned } : x))
    );
  }

  async function remove(n: Note) {
    if (!confirm('Notiz löschen?')) return;
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
        <textarea
          id="note-input"
          placeholder="Gedanke festhalten…"
          aria-label="Neue Notiz"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button type="submit" className={styles.btnPrimarySm}>
          Speichern
        </button>
      </form>
      <div className={styles.noteStack}>
        {sorted.map((n) => (
          <div key={n.id} className={`${styles.noteCard} ${n.pinned ? styles.notePinned : ''}`}>
            {editing === n.id ? (
              <textarea
                className={styles.noteEdit}
                value={editBody}
                rows={Math.min(8, Math.max(2, editBody.split('\n').length))}
                autoFocus
                onChange={(e) => setEditBody(e.target.value)}
                onBlur={() => saveEdit(n)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    saveEdit(n);
                  }
                  if (e.key === 'Escape') setEditing(null);
                }}
              />
            ) : (
              <p
                className={styles.noteBody}
                onClick={() => {
                  setEditing(n.id);
                  setEditBody(n.body);
                }}
                title="Klicken zum Bearbeiten"
              >
                {n.body}
              </p>
            )}
            <div className={styles.noteFooter}>
              <span className={styles.noteTime}>{relativeTime(n.updated_at)}</span>
              <span className={styles.noteActions}>
                <button
                  aria-label={n.pinned ? 'Notiz lösen' : 'Notiz anpinnen'}
                  onClick={() => togglePin(n)}
                >
                  {n.pinned ? '📌' : '📍'}
                </button>
                <button aria-label="Notiz löschen" onClick={() => remove(n)}>
                  ✕
                </button>
              </span>
            </div>
          </div>
        ))}
        {!sorted.length && <p className={styles.empty}>Noch keine Notizen.</p>}
      </div>
    </section>
  );
}

/* ================= Ablage (links) ================= */
function LinksWidget({ initial }: { initial: LinkItem[] }) {
  const [links, setLinks] = useState(initial);
  const [url, setUrl] = useState('');
  const [comment, setComment] = useState('');
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return links;
    return links.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q) ||
        l.comment.toLowerCase().includes(q)
    );
  }, [links, filter]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    let normalized = url.trim();
    if (!normalized) return;
    if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized;
    try {
      new URL(normalized);
    } catch {
      alert('Das sieht nicht wie eine gültige URL aus.');
      return;
    }
    setBusy(true);
    const title = await fetchPageTitle(normalized);
    const { data, error } = await supabase
      .from('links')
      .insert({ url: normalized, title, comment: comment.trim() })
      .select()
      .single();
    setBusy(false);
    if (error) return alert(error.message);
    setLinks((cur) => [data as LinkItem, ...cur]);
    setUrl('');
    setComment('');
  }

  async function remove(l: LinkItem) {
    const { error } = await supabase.from('links').delete().eq('id', l.id);
    if (error) return alert(error.message);
    setLinks((cur) => cur.filter((x) => x.id !== l.id));
  }

  function domain(u: string) {
    try {
      return new URL(u).hostname.replace(/^www\./, '');
    } catch {
      return u;
    }
  }

  return (
    <section className={styles.widget}>
      <div className={styles.widgetHead}>
        <h2>🔖 Ablage</h2>
        {links.length > 4 && (
          <input
            className={styles.linkFilter}
            placeholder="Suchen…"
            aria-label="Ablage durchsuchen"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        )}
      </div>

      <form className={styles.linkForm} onSubmit={add}>
        <input
          id="link-input"
          placeholder="URL einfügen…"
          aria-label="Link-URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <input
          placeholder="Wieso cool? (optional)"
          aria-label="Kommentar"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <button type="submit" className={styles.btnPrimarySm} disabled={busy}>
          {busy ? '…' : '+'}
        </button>
      </form>

      <ul className={styles.linkList}>
        {shown.map((l) => (
          <li key={l.id} className={styles.linkItem}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={styles.linkFavicon}
              src={`https://www.google.com/s2/favicons?domain=${domain(l.url)}&sz=32`}
              alt=""
              width={16}
              height={16}
              loading="lazy"
            />
            <span className={styles.linkBody}>
              <a href={l.url} target="_blank" rel="noopener noreferrer">
                {l.title || domain(l.url)}
              </a>
              <span className={styles.linkMeta}>
                {domain(l.url)}
                {l.comment && <> — {l.comment}</>}
              </span>
            </span>
            <span className={styles.linkActions}>
              <button
                aria-label="URL kopieren"
                title="URL kopieren"
                onClick={() => navigator.clipboard?.writeText(l.url)}
              >
                ⧉
              </button>
              <button aria-label="Link löschen" title="Löschen" onClick={() => remove(l)}>
                ✕
              </button>
            </span>
          </li>
        ))}
        {!shown.length && (
          <p className={styles.empty}>
            {links.length ? 'Nichts gefunden.' : 'URL oben reinwerfen — Titel wird automatisch geholt.'}
          </p>
        )}
      </ul>
    </section>
  );
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
                  aria-label={`Kategorie von ${p.title}`}
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
                aria-label={`${s.name} ${s.active ? 'pausieren' : 'aktivieren'}`}
                title={s.active ? 'aktiv' : 'pausiert'}
              >
                {s.active ? '🟢' : '⚪️'}
              </button>
              <span className={styles.srcName}>{s.name}</span>
              <button
                className={styles.srcDelete}
                aria-label={`${s.name} entfernen`}
                onClick={() => removeSource(s)}
              >
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
        {news.slice(0, 16).map((n, i) => (
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
        <form className={styles.pwForm} onSubmit={change}>
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
function focusInput(id: string) {
  const el = document.getElementById(id) as HTMLElement | null;
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => el?.focus(), 350);
}

export default function Dashboard({
  email,
  photos,
  sources,
  notes,
  todos,
  links,
  weekViews,
  news,
}: {
  email: string;
  photos: Photo[];
  sources: Source[];
  notes: Note[];
  todos: Todo[];
  links: LinkItem[];
  weekViews: number;
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
      { label: '☑️ Neues Todo', hint: 'Fokus aufs Todo-Feld', run: () => focusInput('todo-input') },
      { label: '📝 Neue Notiz', hint: 'Fokus aufs Notizfeld', run: () => focusInput('note-input') },
      { label: '🔖 Link ablegen', hint: 'Fokus auf die Ablage', run: () => focusInput('link-input') },
      {
        label: '📤 Foto hochladen',
        hint: 'Upload',
        run: () => document.getElementById('photo-file-input')?.click(),
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

  const openTodos = todos.filter((t) => !t.done);
  const overdueCount = openTodos.filter(
    (t) => t.due_date && t.due_date < todayStr()
  ).length;
  const dateLine = new Date().toLocaleDateString('de-CH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

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

      <div className={styles.greeting}>
        <h1>Hoi Shane</h1>
        <p>
          {dateLine}
          {openTodos.length > 0 && (
            <>
              {' · '}
              {openTodos.length} Todo{openTodos.length !== 1 && 's'} offen
              {overdueCount > 0 && (
                <span className={styles.greetingOverdue}>
                  {' '}
                  ({overdueCount} überfällig)
                </span>
              )}
            </>
          )}
          {openTodos.length === 0 && ' · alles erledigt ✨'}
        </p>
      </div>

      <main className={styles.grid}>
        <div className={styles.colWide}>
          <TodosWidget initial={todos} />
          <LinksWidget initial={links} />
          <PhotoManager initial={photos} />
        </div>
        <div className={styles.colNarrow}>
          <NotesWidget initial={notes} />
          <NewsWidget news={news} sources={sources} />
          <PasswordWidget />
          <p className={styles.viewsLine}>
            {weekViews} {weekViews === 1 ? 'Besuch' : 'Besuche'} auf der Website in den
            letzten 7 Tagen
          </p>
        </div>
      </main>

      <CommandBar open={cmdOpen} onClose={() => setCmdOpen(false)} commands={commands} />
    </div>
  );
}
