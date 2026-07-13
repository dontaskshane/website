import Link from 'next/link';
import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <div className={styles.screen}>
      <div className={styles.tile}>
        <span className={styles.emoji}>🌀</span>
        <h1 className={styles.code}>404</h1>
        <p className={styles.text}>Diese Seite hat sich im Universum verirrt.</p>
        <Link href="/" className={styles.home}>
          Zur Startseite
        </Link>
      </div>
    </div>
  );
}
