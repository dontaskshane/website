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
};

const FOLDERS = [
  { key: 'all', title: 'Overview', icon: '🌍' },
  { key: 'digital', title: 'Digital', icon: '📁' },
  { key: 'analog', title: 'Analog', icon: '📁' },
  { key: 'iphone', title: 'iPhone', icon: '📁' },
] as const;

type FolderKey = (typeof FOLDERS)[number]['key'];

export default function Gallery({ photos }: { photos: GalleryPhoto[] }) {
  const [folder, setFolder] = useState<FolderKey>('all');
  const [lightbox, setLightbox] = useState<number | null>(null);
  const paneRef = useRef<HTMLDivElement>(null);

  const list = useMemo(
    () => (folder === 'all' ? photos : photos.filter((p) => p.category === folder)),
    [photos, folder]
  );

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

  // Swipe to navigate in lightbox on touch
  const swipe = useRef({ x: 0, moved: false });

  function selectFolder(key: FolderKey) {
    setFolder(key);
    paneRef.current?.scrollTo({ top: 0 });
  }

  return (
    <div className={styles.screen}>
      <div className={styles.lights}>
        <button
          className={`${styles.light} ${styles.close}`}
          aria-label="Home"
          onClick={() => (location.href = '/')}
        />
        <button
          className={`${styles.light} ${styles.min}`}
          aria-label="Home"
          onClick={() => (location.href = '/')}
        />
        <button
          className={`${styles.light} ${styles.max}`}
          aria-label="Home"
          onClick={() => (location.href = '/')}
        />
      </div>

      <div className={styles.app}>
        <aside className={styles.sidebar} aria-label="Sidebar">
          <div className={styles.brand}>Shane Wetzel</div>

          {FOLDERS.slice(0, 1).map((f) => (
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
            </a>
          ))}

          <div className={styles.secLabel}>Selected Work</div>
          {FOLDERS.slice(1).map((f) => (
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
            <div className={styles.paneCount}>
              {list.length} {list.length === 1 ? 'item' : 'items'}
            </div>
          </div>
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
        </main>
      </div>

      {lightbox !== null && list[lightbox] && (
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
            else if (!swipe.current.moved) setLightbox(null);
          }}
        >
          <button
            className={styles.lbClose}
            aria-label="Close"
            onClick={() => setLightbox(null)}
          >
            ✕
          </button>
          <Image
            key={list[lightbox].id}
            src={list[lightbox].url}
            alt={list[lightbox].title}
            width={list[lightbox].width}
            height={list[lightbox].height}
            sizes="92vw"
            quality={85}
            className={styles.lbImg}
            priority
          />
        </div>
      )}
    </div>
  );
}
