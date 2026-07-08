'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import styles from './home.module.css';

function Backdrop({ urls }: { urls: string[] }) {
  const [pool] = useState(() => [...urls].sort(() => Math.random() - 0.5));
  const [slotA, setSlotA] = useState<string | null>(null);
  const [slotB, setSlotB] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<'a' | 'b'>('a');
  const idx = useRef(0);

  useEffect(() => {
    if (!pool.length) return;
    setSlotA(pool[0]);
    idx.current = 1;
    const t = setInterval(() => {
      const src = pool[idx.current % pool.length];
      idx.current++;
      setActiveSlot((cur) => {
        if (cur === 'a') {
          setSlotB(src);
          return 'b';
        }
        setSlotA(src);
        return 'a';
      });
    }, 9000);
    return () => clearInterval(t);
  }, [pool]);

  return (
    <div className={styles.backdrop} aria-hidden="true">
      {slotA && (
        <Image
          src={slotA}
          alt=""
          fill
          sizes="100vw"
          quality={35}
          priority
          className={`${styles.bdImg} ${activeSlot === 'a' ? styles.on : ''}`}
        />
      )}
      {slotB && (
        <Image
          src={slotB}
          alt=""
          fill
          sizes="100vw"
          quality={35}
          className={`${styles.bdImg} ${activeSlot === 'b' ? styles.on : ''}`}
        />
      )}
    </div>
  );
}

export default function Home({ backdropUrls }: { backdropUrls: string[] }) {
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    if (!aboutOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAboutOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [aboutOpen]);

  return (
    <div className={styles.screen}>
      <Backdrop urls={backdropUrls} />

      <header className={styles.header}>
        <Link href="/" className={styles.name}>
          Shane Wetzel
        </Link>
      </header>

      <main className={styles.main}>
        <Link href="/work" className={styles.tile} aria-label="Work">
          <span className={styles.logoWrap}>
            <Image src="/images/finder_folder.png" alt="" width={92} height={92} />
          </span>
          <span className={styles.label}>Work</span>
        </Link>
        <Link href="/universe" className={styles.tile} aria-label="Universe">
          <span className={styles.logoWrap}>
            <Image
              src="/images/logo_sw.png"
              alt=""
              width={92}
              height={92}
              className={styles.spinBreathe}
            />
          </span>
          <span className={styles.label}>Universe</span>
        </Link>
        <button
          type="button"
          className={styles.tile}
          onClick={() => setAboutOpen(true)}
          aria-label="About me"
          aria-haspopup="dialog"
        >
          <span className={styles.emoji}>🕵️</span>
          <span className={styles.label}>About me</span>
        </button>
      </main>

      <footer className={styles.footer}>
        <span className={styles.backdoor}>© 2026 Shane Wetzel</span>
      </footer>

      <div
        className={`${styles.modal} ${aboutOpen ? styles.open : ''}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!aboutOpen}
        onClick={(e) => {
          if (e.target === e.currentTarget) setAboutOpen(false);
        }}
      >
        <div className={styles.aboutWin}>
          <div className={styles.aboutBar}>
            <div className={styles.lights}>
              <button
                className={`${styles.lt} ${styles.ltClose}`}
                aria-label="Close"
                onClick={() => setAboutOpen(false)}
              />
              <button
                className={`${styles.lt} ${styles.ltMin}`}
                aria-label="Close"
                onClick={() => setAboutOpen(false)}
              />
              <button
                className={`${styles.lt} ${styles.ltMax}`}
                aria-label="Close"
                onClick={() => setAboutOpen(false)}
              />
            </div>
            <div className={styles.aboutTitle}>
              <span className={styles.doc}>🕵️</span>
              <span>About me</span>
            </div>
          </div>
          <div className={styles.aboutBody}>
            <div className={styles.aboutRow}>
              <div className={styles.aboutLabel}>Contact</div>
              <div className={styles.aboutCol}>
                <p>Bern, CH</p>
                <p>
                  <a href="mailto:hello@shanewetzel.xyz">hello@shanewetzel.xyz</a>
                </p>
              </div>
              <div className={styles.aboutCol}>
                <p>
                  <a href="https://www.instagram.com/" target="_blank" rel="noopener">
                    Instagram
                  </a>
                </p>
              </div>
            </div>
            <div className={styles.aboutRow}>
              <div className={styles.aboutLabel}>About me</div>
              <div className={styles.aboutCol} style={{ gridColumn: 'span 2' }}>
                <p>Shane Wetzel is based in Bern, Switzerland.</p>
                <p>
                  This site collects selected work, photographs, and a visual universe
                  of ongoing references.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
