'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './work.module.css';

export type GalleryPhoto = {
  id: string;
  category: 'digital' | 'analog' | 'iphone';
  url: string;
  title: string;
  width: number;
  height: number;
  createdAt: string;
};

const FOLDERS = [
  { key: 'all', title: 'Overview', icon: '🌍' },
  { key: 'recent', title: 'Zuletzt', icon: '🕘' },
  { key: 'digital', title: 'Digital', icon: '📁' },
  { key: 'analog', title: 'Analog', icon: '📁' },
  { key: 'iphone', title: 'iPhone', icon: '📁' },
] as const;

type FolderKey = (typeof FOLDERS)[number]['key'];
type ViewMode = 'grid' | 'list';
type SortMode = 'name' | 'new';

const CATEGORY_LABEL: Record<GalleryPhoto['category'], string> = {
  digital: 'Digital',
  analog: 'Analog',
  iphone: 'iPhone',
};

export default function Gallery({ photos }: { photos: GalleryPhoto[] }) {
  const [folder, setFolder] = useState<FolderKey>('all');
  const [view, setView] = useState<ViewMode>('grid');
  const [sort, setSort] = useState<SortMode>('name');
  const [maximized, setMaximized] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const paneRef = useRef<HTMLDivElement>(null);

  // Remember view preference like a real Finder window
  useEffect(() => {
    const stored = localStorage.getItem('work-view');
    if (stored === 'list' || stored === 'grid') setView(stored);
  }, []);

  function switchView(v: ViewMode) {
    setView(v);
    try {
      localStorage.setItem('work-view', v);
    } catch {}
  }

  const list = useMemo(() => {
    let items: GalleryPhoto[];
    if (folder === 'all') items = [...photos];
    else if (folder === 'recent')
      items = [...photos]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 12);
    else items = photos.filter((p) => p.category === folder);

    if (folder !== 'recent') {
      items.sort((a, b) =>
        sort === 'name'
          ? a.title.localeCompare(b.title)
          : b.createdAt.localeCompare(a.createdAt)
      );
    }
    return items;
  }, [photos, folder, sort]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: photos.length, recent: Math.min(12, photos.length) };
    for (const p of photos) c[p.category] = (c[p.category] ?? 0) + 1;
    return c;
  }, [photos]);

  const folderTitle = FOLDERS.find((f) => f.key === folder)?.title ?? 'Overview';

  const step = useCallback(
    (d: number) => {
      setLightbox((cur) =>
        cur === null ? cur : (cur + d + list.length) % list.length
      );
    },
    [list.length]
  );

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightbox, step]);

  const swipe = useRef({ x: 0, moved: false });

  function selectFolder(key: FolderKey) {
    setFolder(key);
    paneRef.current?.scrollTo({ top: 0 });
  }

  const current = lightbox !== null ? list[lightbox] : null;
  const nextPhoto = lightbox !== null ? list[(lightbox + 1) % list.length] : null;
  const prevPhoto =
    lightbox !== null ? list[(lightbox - 1 + list.length) % list.length] : null;

  return (
    <div className={styles.screen}>
      <div className={styles.lights}>
        <button
          className={`${styles.light} ${styles.close}`}
          aria-label="Fenster schliessen — zur Startseite"
          title="Schliessen"
          onClick={() => (location.href = '/')}
        />
        <button
          className={`${styles.light} ${styles.min}`}
          aria-label="Fenster minimieren — zur Startseite"
          title="Minimieren"
          onClick={() => (location.href = '/')}
        />
        <button
          className={`${styles.light} ${styles.max}`}
          aria-label={maximized ? 'Seitenleiste einblenden' : 'Fenster maximieren'}
          title={maximized ? 'Wiederherstellen' : 'Maximieren'}
          onClick={() => setMaximized(!maximized)}
        />
      </div>

      <div className={`${styles.app} ${maximized ? styles.appMax : ''}`}>
        <aside className={styles.sidebar} aria-label="Seitenleiste">
          <div className={styles.brand}>Shane Wetzel</div>

          {FOLDERS.slice(0, 2).map((f) => (
            <a
              key={f.key}
              className={`${styles.navItem} ${folder === f.key ? styles.active : ''}`}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                selectFolder(f.key);
              }}
            >
              <span className={styles.ico}>{f.icon}</span>
              <span>{f.title}</span>
              <span className={styles.navCount}>{counts[f.key] ?? 0}</span>
            </a>
          ))}

          <div className={styles.secLabel}>Selected Work</div>
          {FOLDERS.slice(2).map((f) => (
            <a
              key={f.key}
              className={`${styles.navItem} ${folder === f.key ? styles.active : ''}`}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                selectFolder(f.key);
              }}
            >
              <span className={styles.ico}>{f.icon}</span>
              <span>{f.title}</span>
              <span className={styles.navCount}>{counts[f.key] ?? 0}</span>
            </a>
          ))}

          <div className={styles.secLabel}>Links</div>
          <a
            className={`${styles.navItem} ${styles.external}`}
            href="https://www.instagram.com/"
            target="_blank"
            rel="noopener"
          >
            <span className={styles.ico}>📎</span>
            <span>Instagram</span>
          </a>
        </aside>

        <main className={styles.pane} ref={paneRef}>
          <div className={styles.paneHeader}>
            <div className={styles.paneTitle}>{folderTitle}</div>
            <div className={styles.toolbar}>
              {folder !== 'recent' && (
                <select
                  className={styles.sortSelect}
                  value={sort}
                  aria-label="Sortierung"
                  onChange={(e) => setSort(e.target.value as SortMode)}
                >
                  <option value="name">Name</option>
                  <option value="new">Neuste</option>
                </select>
              )}
              <div className={styles.viewToggle} role="group" aria-label="Ansicht">
                <button
                  className={view === 'grid' ? styles.viewActive : ''}
                  aria-label="Symbolansicht"
                  aria-pressed={view === 'grid'}
                  onClick={() => switchView('grid')}
                >
                  ▦
                </button>
                <button
                  className={view === 'list' ? styles.viewActive : ''}
                  aria-label="Listenansicht"
                  aria-pressed={view === 'list'}
                  onClick={() => switchView('list')}
                >
                  ☰
                </button>
              </div>
              <div className={styles.paneCount}>
                {list.length} {list.length === 1 ? 'item' : 'items'}
              </div>
            </div>
          </div>

          {view === 'grid' ? (
            <div className={styles.grid}>
              {list.map((p, i) => (
                <div key={p.id} className={styles.card} onClick={() => setLightbox(i)}>
                  <div className={styles.thumb}>
                    <Image
                      src={p.url}
                      alt={p.title}
                      fill
                      sizes="(max-width: 760px) 100vw, 220px"
                      className={styles.thumbImg}
                    />
                  </div>
                  <div className={styles.caption}>{p.title}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.listView} role="list">
              <div className={`${styles.listRow} ${styles.listHead}`} aria-hidden="true">
                <span />
                <span>Name</span>
                <span>Art</span>
                <span>Grösse</span>
              </div>
              {list.map((p, i) => (
                <button
                  key={p.id}
                  className={styles.listRow}
                  role="listitem"
                  onClick={() => setLightbox(i)}
                >
                  <span className={styles.listThumb}>
                    <Image src={p.url} alt="" fill sizes="48px" className={styles.thumbImg} />
                  </span>
                  <span className={styles.listName}>{p.title}</span>
                  <span className={styles.listKind}>{CATEGORY_LABEL[p.category]}</span>
                  <span className={styles.listDims}>
                    {p.width} × {p.height}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className={styles.pathBar} aria-hidden="true">
            <span>🖥 shane</span>
            <span className={styles.pathSep}>▸</span>
            <span>📁 Work</span>
            <span className={styles.pathSep}>▸</span>
            <span>📁 {folderTitle}</span>
          </div>
        </main>
      </div>

      {current && (
        <div
          className={styles.lb}
          onClick={(e) => {
            if (e.target === e.currentTarget) setLightbox(null);
          }}
          onTouchStart={(e) => {
            swipe.current = { x: e.touches[0].clientX, moved: false };
          }}
          onTouchMove={(e) => {
            if (Math.abs(e.touches[0].clientX - swipe.current.x) > 10)
              swipe.current.moved = true;
          }}
          onTouchEnd={(e) => {
            const dx = e.changedTouches[0].clientX - swipe.current.x;
            if (swipe.current.moved && Math.abs(dx) > 48) step(dx < 0 ? 1 : -1);
            else if (!swipe.current.moved && e.target === e.currentTarget)
              setLightbox(null);
          }}
        >
          <button
            className={styles.lbClose}
            aria-label="Schliessen"
            onClick={() => setLightbox(null)}
          >
            ✕
          </button>

          <button
            className={`${styles.lbNav} ${styles.lbPrev}`}
            aria-label="Vorheriges Bild"
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
          >
            ‹
          </button>

          <figure className={styles.lbFigure}>
            <Image
              key={current.id}
              src={current.url}
              alt={current.title}
              width={current.width}
              height={current.height}
              sizes="92vw"
              quality={85}
              className={styles.lbImg}
              priority
            />
            <figcaption className={styles.lbCaption}>
              <span>{current.title}</span>
              <span className={styles.lbCounter}>
                {(lightbox ?? 0) + 1} / {list.length}
              </span>
            </figcaption>
          </figure>

          <button
            className={`${styles.lbNav} ${styles.lbNext}`}
            aria-label="Nächstes Bild"
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
          >
            ›
          </button>

          {/* Preload neighbours so arrow keys feel instant */}
          <div className={styles.lbPreload} aria-hidden="true">
            {nextPhoto && nextPhoto.id !== current.id && (
              <Image
                src={nextPhoto.url}
                alt=""
                width={nextPhoto.width}
                height={nextPhoto.height}
                sizes="92vw"
                quality={85}
              />
            )}
            {prevPhoto && prevPhoto.id !== current.id && prevPhoto.id !== nextPhoto?.id && (
              <Image
                src={prevPhoto.url}
                alt=""
                width={prevPhoto.width}
                height={prevPhoto.height}
                sizes="92vw"
                quality={85}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
