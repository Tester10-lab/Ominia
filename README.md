<div align="center">

<img src="https://img.shields.io/badge/OMINIA-Event%20Planner-6366f1?style=for-the-badge&logo=calendar&logoColor=white" alt="OMINIA Event Planner" />

# OMINIA Event Planner

**A premium, mobile-first event management and calendar application.**  
Plan, organise, and manage events beautifully — right in your browser. No installation required.

[![GitHub Pages](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-10b981?style=flat-square&logo=github)](https://Tester10-lab.github.io/Ominia/)
[![License: MIT](https://img.shields.io/badge/License-MIT-6366f1?style=flat-square)](LICENSE)
[![Vanilla JS](https://img.shields.io/badge/Built%20With-Vanilla%20JS-f59e0b?style=flat-square&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

</div>

---

## Overview

OMINIA Event Planner is a fully client-side, zero-dependency event management app built with pure HTML, CSS, and JavaScript. It stores all data locally in your browser via `localStorage` — meaning it works completely offline with no backend, no database, and no accounts required.

---

## Features

### Calendar Views
| View | Description |
|------|-------------|
| **Month** | Full monthly grid with colour-coded event pills |
| **Week** | Hourly time-grid with event blocks |
| **Day** | Detailed single-day view with venue information |
| **Agenda** | Scrollable list of all upcoming events |

### Event Management
- Create events with a rich tabbed form (Details · Guests · Budget · Notes)
- Edit events inline from the calendar or modal
- Delete events with confirmation
- Duplicate events with one click
- Drag & Drop to reschedule events across the month view
- Recurring events — daily, weekly, monthly, yearly with optional end date

### Event Properties
- Title, dates (start & end), start/end time, or all-day flag
- Category (Meeting · Workshop · Competition · Social · Personal · Other)
- Priority (High / Medium / Low) and Status
- Custom event colour picker
- Venue / location, Organizer
- Guest list (email chips)
- Budget with multi-currency support (USD, EUR, GBP, NPR, INR, AUD, JPY)
- Free-text notes

### Search & Filter
- Instant full-text search across title, venue, organizer, and notes
- Filter by category and priority
- Category filter chips in the sidebar

### Design & UX
- **Light & Dark mode** — auto-detected from system, manually toggleable
- **Mobile-first** — fully responsive from 320px to 4K
- **Bottom navigation** for mobile (Calendar · Agenda · Search · Today)
- **Floating Action Button** (FAB) for quick event creation
- **Keyboard shortcuts** for power users
- Premium UI with smooth animations

### Reminders
- Browser Push Notifications support (requires permission)
- Configurable reminder windows: 5 min → 1 day before the event
- Fallback to in-app toast if notifications are blocked

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `N` | New event |
| `T` | Jump to today |
| `M` | Month view |
| `W` | Week view |
| `D` | Day view |
| `A` | Agenda view |
| `←` / `→` | Previous / next period |
| `Ctrl+K` / `⌘K` | Open search |
| `Esc` | Close modal / search |

---

## Quick Start

### Open directly (no install needed)

```bash
git clone https://github.com/Tester10-lab/Ominia.git
cd Ominia

# Open index.html in your browser
start index.html       # Windows
open index.html        # macOS
xdg-open index.html    # Linux
```

No build step. No npm install. No server required.

### Local dev server (for live reload)

```bash
# Python
python3 -m http.server 8080

# Node.js
npx serve .

# VS Code: Install "Live Server" extension → click "Go Live"
```

---

## Project Structure

```
calendar/
├── index.html      # Application shell and markup
├── styles.css      # Full design system — light/dark mode, all views
├── script.js       # All app logic — state, views, CRUD, drag & drop
├── .gitignore      # Excludes secrets, OS files, build artifacts
└── README.md       # This file
```

Zero-dependency project — no package.json, no build tool, no framework.

---

## GitHub Pages Deployment

1. Push this repository to GitHub
2. Go to **Settings → Pages**
3. Source: **Deploy from a branch**
4. Branch: `main`, folder: `/ (root)`
5. Click **Save**

Live URL:
```
https://Tester10-lab.github.io/Ominia/
```

GitHub Pages may take 1–3 minutes to deploy on first setup.

---

## Data Storage

All event data is stored in `localStorage` under the key `ominia-event-planner`.

| Aspect | Detail |
|--------|--------|
| **Storage** | Browser localStorage — private, local |
| **Capacity** | ~4–5 MB per origin |
| **Persistence** | Survives page reloads and restarts |
| **Cross-device** | No sync (data stays on the device) |

To clear all data: DevTools → Application → Local Storage → delete `ominia-event-planner`.

---

## Accessibility

- Semantic HTML5 elements throughout
- ARIA roles, labels, and `aria-live` regions
- `:focus-visible` keyboard navigation indicators
- Sufficient colour contrast in both light and dark modes
- Screen reader-friendly event descriptions

---

## Contributing

```bash
# Fork → clone → branch
git checkout -b feature/my-feature

# Make changes, then commit
git add .
git commit -m "feat: describe your change"
git push origin feature/my-feature
# Open a Pull Request
```

Commit convention: `feat:`, `fix:`, `style:`, `docs:`, `refactor:`

---

## Roadmap

- [ ] iCal / .ics import & export
- [ ] JSON data backup & restore
- [ ] PWA (installable, offline-first)
- [ ] Google Calendar sync
- [ ] Multi-calendar support
- [ ] Event templates

---

## License

MIT License — Copyright (c) 2026 OMINIA Club

Permission is hereby granted, free of charge, to any person obtaining a copy of this software to use, copy, modify, merge, publish, distribute, and/or sell copies of the software without restriction, provided the above copyright notice is included.

---

<div align="center">
Built with love by <strong>OMINIA Club</strong>
</div>
