'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './dashboard.module.css';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  function friendlyError(message: string): string {
    if (message.includes('Invalid login credentials'))
      return 'E-Mail oder Passwort falsch.';
    if (message.includes('Email not confirmed'))
      return 'E-Mail noch nicht bestätigt — check dein Postfach.';
    if (message.includes('signups are disabled') || message.includes('Database error'))
      return 'Registrierung ist nur für Shane möglich.';
    if (message.toLowerCase().includes('rate limit'))
      return 'Zu viele Versuche — warte kurz und probier es nochmal.';
    if (message.includes('fetch') || message.includes('network'))
      return 'Verbindungsfehler — prüfe dein Internet und versuch es erneut.';
    return `Serverfehler: ${message}`;
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(friendlyError(error.message));
      setBusy(false);
      return;
    }
    router.refresh();
  }

  async function signUp() {
    setBusy(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(friendlyError(error.message));
    } else {
      setInfo('Account erstellt — check dein E-Mail-Postfach zur Bestätigung.');
    }
    setBusy(false);
  }

  return (
    <div className={styles.loginScreen}>
      <form className={styles.loginCard} onSubmit={signIn}>
        <div className={styles.loginEmoji}>🛰️</div>
        <h1 className={styles.loginTitle}>Dashboard</h1>
        <p className={styles.loginSub}>Nur für Shane.</p>
        <input
          type="email"
          placeholder="E-Mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <input
          type="password"
          placeholder="Passwort"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          minLength={8}
        />
        {error && <div className={styles.loginError}>{error}</div>}
        {info && <div className={styles.loginInfo}>{info}</div>}
        <button type="submit" className={styles.btnPrimary} disabled={busy}>
          {busy ? '…' : 'Anmelden'}
        </button>
        <button
          type="button"
          className={styles.btnGhost}
          disabled={busy || !email || password.length < 8}
          onClick={signUp}
        >
          Erstes Mal? Account erstellen
        </button>
      </form>
    </div>
  );
}
