# PondWise v1

Plain HTML + CSS + JS fishpond manager. No framework, no build step.

## Open it

Open `index.html` in any browser. Data stays in that browser (localStorage).

## Files (read in this order)

1. `index.html` - all screens as simple sections
2. `styles.css` - dark LPMAS-style monitor theme, flat panels, two breakpoints
3. `species-data.js` - built-in species list + `suggestRateByWeight()`
4. `app.js` - plain functions: storage, ponds, feed, tasks, records, finance, plans, guide
5. `assets/` - logo files (`logo.svg` in sidebar + favicon, `logo.png`, original `logo.jpeg`) and `reference/` screenshots

## Species library

- Live: FishBase API at `https://fishbase.ropensci.org/species` (search by genus).
- Offline fallback: `SPECIES_LIST` in `species-data.js` always works.

## Multi-pond

Every task/log/expense/sale stores a `pondId`. The sidebar picker (desktop) or dashboard switcher (mobile) selects the active pond.

## Mobile layout (narrow screens, per `assets/reference/mobile.png`)

At 700px and below the sidebar is replaced by a fixed bottom tab bar (Home, Tasks, + Records, Helper, Money), and the dashboard swaps its desktop blocks for a greeting header, pond switcher, mini cards, Quick Access icons, Overview stats, Today's Schedule with tap-to-finish pills, and a help card.

## Backup

Helper tab -> Download backup (JSON). Restore with the file picker.

## Features and where they live

- Dashboard: status bar, KPI strip (tasks open, feed today, profit, water pH), upcoming tasks, pond report, recent feedings, get-started panel
- Dashboard on mobile: greeting + date, tasks bell with due-count badge, pond avatar, pond switcher, active-pond and tasks-today cards, Quick Access row, Overview stats, Today's Schedule, help card
- Bottom tab bar on mobile: Home, Tasks, + (daily records), Helper, Money
- Ponds: small 3-column pond cards with pond art on top (tap to pick, delete), add-pond form, fish-stock form
- Feed: species search (live FishBase API + offline built-in list, "Use" fills stock names), daily feed estimator, "use selected pond" fill
- Tasks: grouped upcoming/done list, Done/Undo toggle, delete, add-task form
- Records: food given, water check, fish health, work done - each with big Save button, example text, and Remove on saved rows
- Money: money-out and money-in forms with plain words and examples, 3 summary boxes (paid, sold, left), plain-language profit line, Remove on saved rows
- Plans: proposed PondStart (₱0) / PondElite (₱199, featured) / PondPro (₱99) tiers per `assets/reference/sub.jpg`, choice saved in browser
- Helper: railguarded chatbot (PondWise topics only) with quick-question buttons, plain What/Why/Where/How guide, backup download/restore, load demo data
- Everywhere: data auto-saves in the browser (localStorage), section deep-links via URL hash, demo data (3 stocked ponds) from Dashboard, Ponds, or Helper
