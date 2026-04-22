# CLAUDE.md — Hot Cache

**Project:** Shane Wetzel's personal website → www.shanewetzel.xyz (GitHub Pages, master branch)
**Full project reference:** memory/project.md

## Files at a Glance
| File | What |
|------|------|
| `index.html` | Landing — 3 glass tiles (Work / About / Universe), blurred photo backdrop. About opens inline dark macOS-style modal |
| `work.html` | Two floating glass panels (sidebar + content) on soft gradient desktop, floating traffic lights, borderless thumbs + captions |
| `universe.html` | Pannable/zoomable infinite photo canvas, black bg, no UI text, subtle glass back button |
| `dashboard.html` | Private password-protected personal dashboard (unchanged) |
| `old/` | Archived previous masonry gallery (`old/index.html`, `old/styles.css`) |
| `archive/2/`, `archive/3/`, `archive/motion.html` | Archived experimental sites + retired Motion page |
| `images/` | photos + logo; organised into `images/digital/` (6), `images/analog/` (12), and root (30) |

## Stack
**Vanilla HTML5 / CSS3 / ES6+ JS only.** No npm, no build tools, no frameworks, no backend.
No external JS deps on any live page (Three.js only lives on archived `/archive/motion.html` + `/archive/3/`).

## Critical Rules
- **Never modify** `dashboard.html` unless user explicitly asks about the dashboard
- **Never link** dashboard.html from the public site (backdoor stays via `© 2026` footer on `index.html`)
- **Never add** npm, build tools, TypeScript, or a backend
- **Dashboard is self-contained** — CSS and JS stay embedded inside dashboard.html
- Photo paths are explicit with subfolder: `images/digital/*`, `images/analog/*`, `images/*` (root). Arrays live in `work.html` (split into DIGITAL/ANALOG/RANDOM) and `universe.html` (flat IMAGES) — keep in sync when adding photos
- `work.html` Random folder = only files directly in `images/`, not subfolders. Overview = Digital + Analog + Random
- **RSS uses JSONP** on dashboard — do NOT switch to fetch() without a proxy (NZZ blocks CORS)

## Key Facts
- Landing glass tiles: `backdrop-filter: blur(28px) saturate(180%)` over blurred crossfading photo backdrop
- Apple system fonts + native Apple Color Emoji (no web fonts)
- Tile 2 (📝 About) opens an inline dark macOS-style modal — content is placeholder Lorem Ipsum except real contact (Bern / email / Instagram). User should fill in Studio/Press sections
- Tile 3 shows `logo_sw.png` with slow rotate + breathe animation (the "GIF")
- `work.html` = floating traffic lights + two glass panels (sidebar + content) with visible desktop gap between them. No window chrome around it
- `universe.html`: deterministic Poisson-ish scatter, Mulberry32 seed 271, smooth `<img>` tiles (not pixelated canvases)
- Dashboard auth: SHA-256 hash, sessionStorage session
- Weather: Bern, CH via Open-Meteo (no API key)
- Git branches: `claude/<description>-<session-id>`, PRs → master

## Edit Policy
**index.html / work.html / universe.html** → only on explicit request about the public site
**dashboard.html** → only on explicit dashboard request
**old/ and archive/** → leave alone unless user asks to restore/delete
**images/** → only when explicitly instructed

→ Full detail (APIs, localStorage schema, conventions, gotchas): memory/project.md
