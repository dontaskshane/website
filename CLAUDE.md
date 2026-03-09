# CLAUDE.md — AI Assistant Guide for `dontaskshane/website`

## Overview

This is a personal static website for Shane Wetzel, hosted on GitHub Pages at `www.shanewetzel.xyz`. It consists of two pages:

- **`index.html`** — A photography portfolio with an interactive masonry gallery and lightbox
- **`dashboard.html`** — A private, password-protected personal dashboard

There is no build system, backend, framework, or package manager. All code is vanilla HTML5, CSS3, and JavaScript (ES6+).

---

## Repository Structure

```
website/
├── CNAME               # GitHub Pages custom domain → www.shanewetzel.xyz
├── README.md           # Minimal readme ("my website :)")
├── index.html          # Portfolio gallery homepage (~163 lines)
├── styles.css          # Shared stylesheet for index.html (~272 lines)
├── dashboard.html      # Personal dashboard, self-contained (~1026 lines)
└── images/             # 30 high-resolution photos + logo
    ├── logo_sw.png
    └── *.JPG / *.jpeg / *.jpg
```

---

## Technology Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Markup      | HTML5                               |
| Styling     | CSS3, inline `<style>` in dashboard |
| Scripting   | Vanilla JavaScript (ES6+)           |
| Fonts       | System font stack                   |
| Deployment  | GitHub Pages (static, no build step)|
| APIs        | Open-Meteo, RSS2JSON, NZZ RSS feeds |

**No npm, yarn, pip, or any build tooling.** Do not introduce package managers or build steps unless explicitly requested.

---

## File Details

### `index.html`
- Displays a responsive, column-based masonry photo gallery
- Lightbox with keyboard navigation (← → arrows, Escape to close)
- Logo acts as a toggle for a site-wide CSS `invert` filter
- Gallery images are listed in a hardcoded JavaScript array inside the file
- Mobile: hover/active effects are disabled; double-tap zoom is prevented
- Uses a CSS custom property `--header-height` calculated dynamically via JS

### `styles.css`
- Stylesheet for `index.html` only
- Responsive breakpoints: `1024px` (tablet) and `640px` (mobile)
- Contains gallery layout, lightbox overlay, header/footer, invert filter effects, and scrollbar styling

### `dashboard.html`
- Entirely self-contained: all CSS is embedded in `<style>`, all JS in `<script>`
- Password-protected via SHA-256 hash (Web Crypto API)
  - Hash stored directly in the JS: `d88a1030fc943736069d7cb44a01a031a263cacb0ab7cfa7b28eb7d54653bb44`
  - 5 failed attempts triggers a 60-second lockout
  - Session is stored in `sessionStorage` (cleared on browser close)
- Widgets (each independently initialized):
  - **Calendar** — current month, today highlighted
  - **Todo list** — persisted in `localStorage['dash_todos']`
  - **Weather** — Bern, Switzerland (46.9481°N, 7.4474°E) via Open-Meteo API
  - **Notes** — auto-saved with 500ms debounce to `localStorage['dash_notes']`
  - **News** — NZZ RSS feeds loaded via JSONP (bypasses CORS)
- Grid layout: 3 columns (desktop), 2 columns (tablet), 1 column (mobile)
- Greeting adapts to time of day (morning / afternoon / evening)

---

## Code Conventions

### JavaScript
- **No frameworks or libraries** — pure DOM APIs only
- Dashboard JS is wrapped in an IIFE: `(function() { ... })();`
- Arrow functions and `const`/`let` throughout
- Event-driven: prefer `addEventListener` over inline handlers
- Debouncing used for frequent events (notes input → `localStorage` write)
- JSONP pattern used for RSS fetching (creates dynamic `<script>` tags with a random callback name)

### CSS
- CSS custom properties (variables) for dynamic values (e.g., `--header-height`)
- Invert filter applied via `.inverted` class on `<body>`
- Media queries follow desktop-first pattern in `styles.css`
- Dashboard uses inline `<style>` — keep it there, do not extract to `styles.css`

### HTML
- Semantic elements where appropriate (`<header>`, `<footer>`, `<main>`)
- All images in the gallery come from the `images/` directory
- No templating engine — HTML is static/hardcoded

---

## External APIs

| API | Purpose | Notes |
|-----|---------|-------|
| `api.open-meteo.com/v1/forecast` | Current weather for Bern | Free, no API key required |
| `api.rss2json.com/v1/api.json` | JSONP proxy for RSS feeds | Free tier; used to bypass CORS |
| `www.nzz.ch/recent.rss` | NZZ general news | Swiss German-language news |
| `www.nzz.ch/zuerich.rss` | NZZ Zurich regional news | Swiss German-language news |

---

## Local Storage Schema

| Key | Location | Content |
|-----|----------|---------|
| `dash_todos` | `localStorage` | JSON array of todo objects `{id, text, done}` |
| `dash_notes` | `localStorage` | Plain text string |
| `dash_session` | `sessionStorage` | Session token string |
| `dash_attempts` | `sessionStorage` | Integer (failed login count) |
| `dash_lockout` | `sessionStorage` | Timestamp (ms) of lockout start |

---

## Development Workflow

### Making Changes

1. Edit HTML/CSS/JS files directly — no compilation needed
2. Open the file in a browser (or a local server) to verify changes
3. Test both desktop and mobile viewport sizes

### Adding Images to the Gallery

1. Add the image file to the `images/` directory
2. In `index.html`, add the filename to the hardcoded images array in the `<script>` block
3. Images are displayed in array order

### Changing the Dashboard Password

1. Generate a SHA-256 hash of the new password (e.g., using `crypto.subtle.digest`)
2. Replace the hash string in `dashboard.html` within the `checkPassword` function

### Running Locally

Since this is a static site, you can serve it with any simple HTTP server:

```bash
# Python 3
python3 -m http.server 8080

# Node (if npx is available)
npx serve .
```

Then visit `http://localhost:8080`.

---

## Deployment

- Hosted on **GitHub Pages** via the `master` branch
- The `CNAME` file configures the custom domain `www.shanewetzel.xyz`
- Pushing to `master` automatically deploys (no CI/CD pipeline needed)
- No build step — files are served as-is

---

## Key Constraints and Gotchas

- **No backend** — do not add server-side code unless architecture changes are explicitly approved
- **No build tools** — do not introduce webpack, Vite, TypeScript, or similar without discussion
- **No npm** — do not add `package.json` or node_modules
- **Dashboard is self-contained** — its CSS and JS must remain embedded in `dashboard.html`
- **CORS limitation** — the RSS news widget uses JSONP because NZZ does not allow cross-origin XHR; do not switch to `fetch()` for RSS without adding a proper proxy
- **Password security is client-side only** — the SHA-256 hash is visible in page source; this is an accepted trade-off for a personal, low-stakes dashboard
- **Images are large** — the `images/` directory is ~150 MB; avoid adding more large assets without consideration

---

## Git Conventions

- Branch naming: `claude/<description>-<session-id>` for AI-assisted work
- Commits are signed with an SSH key (`/home/claude/.ssh/commit_signing_key.pub`)
- Keep commit messages clear and descriptive (imperative mood: "Add", "Fix", "Update")
- Push to the feature branch and open a PR targeting `master`
