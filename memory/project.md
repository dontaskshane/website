# Website Project — Full Reference

**Owner:** Shane Wetzel  
**Live at:** www.shanewetzel.xyz (GitHub Pages, master branch, auto-deploys)  
**Repo:** dontaskshane/website

## Files

| File | What it is |
|------|-----------|
| `index.html` | Landing — 3 glass tiles (Work / About / Universe), blurred photo backdrop, About modal inline |
| `work.html` | Two floating glass panels on soft gradient desktop; borderless thumbs with filename captions |
| `universe.html` | Pannable/zoomable infinite photo canvas (black, no text) |
| `dashboard.html` | Private password-protected personal dashboard, fully self-contained (~1026 lines) |
| `old/index.html` + `old/styles.css` | Archived previous masonry gallery (image/dashboard paths rewritten to `../`) |
| `archive/2/`, `archive/3/` | Archived experimental sites (untouched) |
| `archive/motion.html` | Retired Motion shader page (Three.js slideshow) — unlinked, kept for reference |
| `CNAME` | Custom domain config |
| `images/` | Photos + logo. Subfolders `digital/` (6 photos), `analog/` (12 photos); 30 more photos at root + `logo_sw.png` |

## index.html Details (landing)
- 3 centered glass tiles: 📁 Work, 📝 About (opens modal), logo GIF (rotate + breathe) Universe
- "Shane Wetzel" top-left, small Apple-style weight
- Blurred photo backdrop — two `<img>` elements crossfade every 9s
- Footer `© 2026 Shane Wetzel` → dashboard backdoor (no visible label)
- About modal = dark macOS window; traffic-lights close it; Esc + outside-click close it. Placeholder Lorem Ipsum in Studio/Press sections, real Bern coords + email + Instagram link in Contact
- Mobile: tiles stack vertically; modal collapses to single column

## work.html Details (Finder — no window chrome)
- Soft gradient desktop (purple/peach radial gradients on off-white base)
- Floating traffic-light trio top-left (16px offset) — all route to `index.html`
- Two independent glass panels separated by 14px gap with desktop visible between: sidebar 224px + content (flex)
- Each panel: rounded 16px, `backdrop-filter: blur(34px) saturate(180%)`, glass white 62%, soft shadow
- Sidebar: "Shane Wetzel" text (no avatar/box), Overview (🗂️), Selected Work → Digital/Analog/Random (📁), Links → Instagram (📷)
- FOLDERS map uses explicit paths (no regex heuristic): DIGITAL array (6), ANALOG (12), RANDOM (30 root-level), ALL = concat of all
- Content pane header: folder title + item count; grid is `repeat(auto-fill, minmax(200px, 1fr))`
- Thumbnails: borderless, `aspect-ratio: 4/3`, `object-fit: cover`, caption = filename (basename only) below
- Click thumbnail → fullscreen dark lightbox; ←/→/Esc keys
- Mobile: sidebar collapses above content

## universe.html Details
- Adapted from `archive/2/gallery.html` — drag to pan, wheel/pinch to zoom
- Full photo list (48 photos across subfolders + root) with explicit paths in IMAGES array
- Smooth `<img>` tiles for clean "space" feel; subtle radial stage gradient
- Zero text UI. Back = tiny glass circular button top-left with inverted logo — fades after 2.6s cursor idle
- Click tile → lightbox (click anywhere to close), Escape → home
- Mulberry32 seed 271, 4200×2800 spread, MIN_SEP 220

## dashboard.html Details
- All CSS in `<style>`, all JS in `<script>` — must stay self-contained
- Password-protected via SHA-256 (Web Crypto API)
  - Hash: `d88a1030fc943736069d7cb44a01a031a263cacb0ab7cfa7b28eb7d54653bb44`
  - 5 failed attempts → 60s lockout
  - Session in `sessionStorage` (cleared on browser close)
- Widgets: Calendar, Todo list, Weather, Notes, News
- Grid: 3 cols desktop / 2 cols tablet / 1 col mobile
- Greeting adapts to time of day
- JS wrapped in IIFE: `(function() { ... })();`

## External APIs
| API | Purpose |
|-----|---------|
| `api.open-meteo.com/v1/forecast` | Weather for Bern CH (46.9481°N, 7.4474°E), no key needed |
| `api.rss2json.com/v1/api.json` | JSONP proxy for RSS (free tier) |
| `www.nzz.ch/recent.rss` | NZZ general news (Swiss German) |
| `www.nzz.ch/zuerich.rss` | NZZ Zurich regional news |

## localStorage Schema
| Key | Store | Content |
|-----|-------|---------|
| `dash_todos` | localStorage | JSON array `{id, text, done}` |
| `dash_notes` | localStorage | Plain text string |
| `dash_session` | sessionStorage | Session token |
| `dash_attempts` | sessionStorage | Failed login count (int) |
| `dash_lockout` | sessionStorage | Lockout start timestamp (ms) |

## Code Conventions
- **No frameworks** — pure vanilla HTML5/CSS3/JS (ES6+) only
- No npm, no build tools, no backend, no TypeScript
- Arrow functions, const/let, addEventListener (not inline handlers)
- JSONP for RSS (NZZ blocks cross-origin XHR — do NOT switch to fetch() without a proxy)
- CSS vars for dynamic values; dashboard inline styles stay inline

## Constraints / Gotchas
- Dashboard CSS+JS must remain embedded in dashboard.html — do not extract
- CORS: RSS uses JSONP — don't switch to fetch() without a proper proxy
- Password hash is client-side visible — accepted trade-off for personal low-stakes use
- Images are large (~150 MB) — avoid adding more without consideration
- No backend — do not add server-side code
- dashboard.html is intentionally NOT linked from public navigation — the `© 2026` footer on `index.html` is the backdoor
- Photo array (30 filenames) lives inside `<script>` in all four public pages (index/work/motion/universe) — adding/removing an image means updating all four

## Adding Images
1. Drop file into the correct folder:
   - Digital work → `images/digital/`
   - Analog work → `images/analog/`
   - Miscellaneous / Random → `images/` (root)
2. Add the full path (e.g. `images/digital/foo.jpg`) to the appropriate array:
   - `work.html` → DIGITAL / ANALOG / RANDOM depending on folder (ALL is derived)
   - `universe.html` → IMAGES (flat list, all folders)
3. Landing page (`index.html`) PHOTOS array = optional; used only for the blurred backdrop crossfade — any subset is fine

## Changing Dashboard Password
1. SHA-256 hash the new password (use `crypto.subtle.digest`)
2. Replace hash string in `dashboard.html` → `checkPassword` function

## Git
- Branch naming: `claude/<description>-<session-id>`
- SSH commit signing key: `/home/claude/.ssh/commit_signing_key.pub`
- Commit messages: imperative mood ("Add", "Fix", "Update")
- PRs target `master`
