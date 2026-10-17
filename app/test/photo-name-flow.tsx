'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import styles from './test.module.css';

export type FlowPhoto = {
  id: string;
  title: string;
  url: string;
};

export default function PhotoNameFlow({ photos }: { photos: FlowPhoto[] }) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [activePhoto, setActivePhoto] = useState<FlowPhoto | null>(null);
  const [previewPosition, setPreviewPosition] = useState({ left: 16, top: 16 });

  useEffect(() => {
    if (!activePhoto) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActivePhoto(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePhoto]);

  function movePreview(x: number, y: number) {
    const width = Math.min(260, window.innerWidth - 32);
    const height = width * 0.75;
    const left = Math.max(16, Math.min(x + 18, window.innerWidth - width - 16));
    const top = Math.max(16, Math.min(y + 18, window.innerHeight - height - 16));
    const preview = previewRef.current;

    if (preview) {
      preview.style.left = `${left}px`;
      preview.style.top = `${top}px`;
    } else {
      setPreviewPosition({ left, top });
    }
  }

  function showAtElement(photo: FlowPhoto, element: HTMLElement) {
    const bounds = element.getBoundingClientRect();
    movePreview(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    setActivePhoto(photo);
  }

  return (
    <main className={styles.page} onClick={(event) => {
      if (event.target === event.currentTarget) setActivePhoto(null);
    }}>
      <p className={styles.flow} aria-label="Photo names">
        {photos.map((photo, index) => (
          <span className={styles.item} key={photo.id}>
            <button
              type="button"
              className={styles.name}
              aria-label={`Show ${photo.title}`}
              onPointerEnter={(event) => {
                if (event.pointerType === 'mouse') {
                  movePreview(event.clientX, event.clientY);
                  setActivePhoto(photo);
                }
              }}
              onPointerMove={(event) => {
                if (event.pointerType === 'mouse') movePreview(event.clientX, event.clientY);
              }}
              onPointerLeave={(event) => {
                if (event.pointerType === 'mouse') setActivePhoto(null);
              }}
              onFocus={(event) => {
                if (event.currentTarget.matches(':focus-visible')) {
                  showAtElement(photo, event.currentTarget);
                }
              }}
              onBlur={() => setActivePhoto(null)}
              onClick={(event) => {
                if (window.matchMedia('(hover: none)').matches) {
                  if (activePhoto?.id === photo.id) setActivePhoto(null);
                  else showAtElement(photo, event.currentTarget);
                }
              }}
            >
              {photo.title}
            </button>
            {index < photos.length - 1 ? ' ' : null}
          </span>
        ))}
      </p>

      {activePhoto && (
        <div
          className={styles.preview}
          ref={previewRef}
          style={{ left: previewPosition.left, top: previewPosition.top }}
          aria-hidden="true"
        >
          <Image
            src={activePhoto.url}
            alt=""
            fill
            sizes="260px"
            quality={65}
            className={styles.previewImage}
          />
        </div>
      )}
    </main>
  );
}
