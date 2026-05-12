# Agency OS — Circular Menu Prototype

Interactive circular navigation menu prototype for **Agency OS**, a native desktop application for creative agencies.

Built with React, Framer Motion, Three.js, and Web Audio API.

## Preview

A dark, minimal dashboard with a circular scroll-to-navigate menu system:

- **Scroll** to rotate through 6 main categories (CHAT, PLAN, BRAND, DOCS, FILES, AGENTS)
- **Click center** to reveal sub-menu items arranged in a circular layout
- **Hover + click** sub-items to navigate
- **Sound effects** on every interaction via Web Audio API
- **3D AI Sphere** rendered with Three.js GLSL shaders in the bottom-right corner

## Features

### Circular Menu
- Segmented ring indicator with active segment highlighted in white
- Infinite scroll navigation (wraps around endlessly in both directions)
- Smooth Framer Motion animations with spring physics
- 6 categories × 6 sub-items = 36 navigation targets

### Sub-Menu
- Rounded rectangle cards arranged in circular orbit around center
- Hover state: card fills white, text inverts to dark
- Staggered spring animations on open/close
- Click or Enter to select

### AI Sphere
- Three.js WebGL renderer with custom GLSL vertex/fragment shaders
- Perlin-inspired FBM noise for organic flowing color gradients
- Soft 3D lighting with specular highlights and rim glow
- Pink–purple–blue color palette matching the UI theme
- Smooth rotation animation

### Sound Design
- Web Audio API — no external files, pure synthesized tones
- Menu open: ascending arpeggio (G4 → C5 → G5)
- Menu close: descending arpeggio
- Scroll: subtle randomized tick
- Sub-menu open: triple ascending tone
- Sub-item select: confirmation ping with detune
- Hover: ultra-subtle high tone

### UI Elements
- i7 OS logo (SVG) — bottom left
- Weather display with custom cloud icon (SVG) — top right
- Three bottom control buttons: Dashboard, Microphone, Plus
- Animated gradient blob in background corner
- Dot grid background pattern
- Geist font throughout

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 19 |
| Animations | Framer Motion |
| 3D Rendering | Three.js (r128+) with custom GLSL shaders |
| Sound | Web Audio API (synthesized) |
| Font | Geist (Google Fonts) |
| Build | Vite |

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Interaction Guide

| Action | Result |
|--------|--------|
| Click dashboard icon (bottom center-left) | Open/close circular menu |
| Scroll (mouse wheel) | Navigate between categories |
| Click center label | Open sub-menu for current category |
| Click center again | Close sub-menu, return to ring |
| Hover sub-item card | Card highlights white |
| Click sub-item card | Select and close menu |
| Click outside menu | Close everything |

## Menu Structure

```
CHAT     → Team, Clients, AI, Channels, Calls, Archive
PLAN     → Kanban, Timeline, Tasks, Calendar, Goals, Sprints
BRAND    → Assets, Identity, Knowledge, Personas, Competitor, Guidelines
DOCS     → Notes, Briefs, Wiki, Templates, Proposals, Reports
FILES    → Images, Videos, All Files, Fonts, Raw, Links
AGENTS   → Dev, Design, Strategy, Finance, Marketing, Sales
```

## Design Tokens

```
Background:    #111117
Text:          #ffffffCC
Text Dim:      #ffffff40
Ring Active:   #ffffff
Ring Inactive: #ffffff18
Font:          Geist, -apple-system, sans-serif
```

## Project Context

This prototype is part of **Agency OS** — a native macOS/Windows desktop app (Tauri 2 + React + Supabase) for creative agencies. The circular menu is the main navigation concept for the dashboard.

Full project documentation: see `Agency-OS-Build-Plan.pdf` and `Agency-OS-MVP-v2.pdf`.

## Author

**Sandro Ieva** — [sandroieva.com](https://sandroieva.com)

## License

Private — All rights reserved.
