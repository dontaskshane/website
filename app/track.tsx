'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

// Fire-and-forget page-view beacon; public pages only, no PII
export default function Track() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith('/dashboard')) return;
    const body = JSON.stringify({ path: pathname });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/hit', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/hit', { method: 'POST', body, keepalive: true });
      }
    } catch {
      // analytics must never break the page
    }
  }, [pathname]);

  return null;
}
