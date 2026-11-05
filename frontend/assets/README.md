# Nexora Fx — Assets (pictures and icons)

Use these files exactly as named. Cline: copy this folder's contents into the built project's `assets/` (or `public/assets/`) folder and reference them by these names. Do not rename them to generic names, do not invent a different logo, and do not copy another brand's logo or text.

## Files in this folder
- `logo-nx-mark-transparent.png` — NX mark-only logo, transparent PNG, 900×949. Use for: header logo, sidebar logo, Landing top bar, and (with the "Nexora Fx" wordmark text next to it, never baked into the image) the site logo lockup. Works on dark and light backgrounds because the background is transparent. This is the working logo for all Nexora Fx videos and the site.
- `favicon.ico` — browser favicon, ICO with 16×16 and 32×32 sizes. Use in `<link rel="icon" href="assets/favicon.ico">`.
- `favicon-512.png` — 512×512 PNG. Use for PWA / app manifest icon and for any large favicon need.
- `apple-touch-icon.png` — 180×180 PNG. Use in `<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">` for iOS home-screen icons.

## Format guidance (what goes where, and what NOT to invent)
- Logo: transparent PNG only (never JPG — JPG has no transparency and would put a white box behind the NX mark). Keep the original transparent PNG; if a smaller file is needed, export a downscaled PNG from this file, do not redraw it.
- Favicon: ICO for browsers + 512 PNG for PWA/manifest. Do not use a JPG as a favicon.
- App icon: PNG (and WebP is acceptable as an additional export from the same PNG) — 512×512 for the manifest, 180×180 for Apple Touch.
- Hero image (Landing gold-coin-stack picture): there is NO fixed hero file in this pack, on purpose — do not invent one. The hero picture is admin-uploadable: admin → CONTENT → Home Page Manage (hero picture upload/replace) or Site Settings/CMS → Media Library → Hero Image Replace, then Save. Whatever admin uploads there is the hero image. In the build, the hero slot must read from `GET /api/settings` / media library, with the design's coin-stack illustration as a placeholder only until admin uploads a real picture.
- Trader avatars, user profile photos: uploaded via admin (trader avatars) or Edit Profile (user photos) and stored in `/uploads` — not fixed files in this pack.
- All other icons (sidebar icons, bell, eye, chevrons, copy, search, etc.): use inline SVG / heroicons-style icons in code. No image files are needed for them, and no image file should be invented for them.
- Deposit QR code: NEVER use a picture from this pack or from a screenshot as a payment QR. The Deposit QR comes from admin → Deposit Wallet Settings (Binance address + QR picture upload). Screenshot QR patterns are decorative samples only.
- All amounts, prices, ROI figures, and trader stats in screenshots are sample design data, not real results.

## For VS Code / Cline
1. Unzip the pack, open the folder in VS Code.
2. Keep `assets/` at the pack root; Cline copies it into the project as above.
3. Keep `screenshots/` (populated by the parent agent — detailed, one picture per screen, descriptively named) as the visual reference; the prompt file tells Cline to ignore design-preview chrome in those screenshots.
4. The prompt file is the single source of truth for logic; this README is only about file formats and names.
