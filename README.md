# PondWise

A local pond notebook built with plain HTML, CSS and JavaScript. No framework, build step, payment processor or backend is required. A browser-local profile gates the notebook UI; it is not server authentication or an encrypted vault.

## Run

Serve this directory from a stable HTTP(S) origin. For development:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000`. For deployment, publish the static files together, including `js/` and `assets/`. Use HTTPS. Modern browsers with localStorage, Intl timezones, BigInt, structuredClone, AbortController and crypto.randomUUID are required. Direct `file:` opening has browser-dependent storage behavior and is not the supported persistence workflow.

**Data belongs to the browser and origin.** Changing scheme, hostname or port does not transfer records. PondElite exposes the Backup Data controls needed to download, preview and restore a workspace at a new origin. Nothing synchronizes automatically.

## Signup, Profile and Settings

New visitors see signup before the dashboard. One personal profile is stored per browser/origin; sign-in sessions are tab-local. Password verifiers use PBKDF2-SHA-256 with a random salt and 210,000 iterations. There is no email verification or password recovery. Existing farm data is preserved when a profile is created.

The built-in demo login is **user@gmail.com** / **user123**. Choose **Sign in** from signup. It automatically opens and seeds the separate demo workspace with a tilapia pond, fish stock, feeding, water, task, bought and sold records. Later sign-ins and reloads retain demo edits instead of reseeding. Demo credentials are fixed; demo name and photo are editable. Signing in with a personal profile returns to the farm notebook.

Profile supports a photo (JPEG/PNG/WebP up to 2 MiB, resized locally), name, email, current Free/Pro/Elite plan preview and password changes. Settings includes persistent dark mode, privacy/security information, data management, tier-gated backup/restore, help, a downloadable diagnostic report, app information, terms, privacy policy and logout. Logout retains saved data and in-memory pond drafts in the same tab. Terms and privacy text describe this local prototype and should be reviewed before a public launch.

## Demo subscription matrix

- **PondStart:** one active pond; Feed Estimator, standard feed table, Tasks and PondWise Helper. No Money entry, Auto Calculator, Pond Rations or Backup Data.
- **PondPro:** up to five active ponds; PondStart features plus the Money Calculator. No Auto Calculator, Pond Rations or Backup Data.
- **PondElite:** unlimited active ponds and full access to Money, Auto Calculator, per-pond Rations and Backup Data.

Tier selection is a local demo preview, not a payment or security system. Downgrades retain data and block only gated actions; they do not delete ponds, history or transactions.

## Existing data and recovery

The original `pondwise_v1` key is never changed or removed. On first opening legacy data, PondWise validates the complete dataset and shows migration counts before writing `pondwise_v2`. Valid numeric strings become typed values; blank optional measurements become `null`; PHP amounts become integer centavos. IDs and historical civil dates are retained. Historical creation/update/completion timestamps remain unknown rather than being invented. Duplicate IDs, orphan records, invalid fields and missing collections stop migration and show recovery tools; they are never guessed or silently dropped.

A successful migration writes and verifies v2 before the application switches to it. An interrupted or failed migration leaves legacy data recoverable. Opening v2 again is idempotent. To use the old version of the application during the compatibility period, serve the previous code at the **same original origin**; its untouched v1 dataset represents the point before migration. Later v2 edits are not copied back to v1.

PondElite Help & settings provides backup, original-data export, replacement restore preview and rollback preview. PondStart and PondPro show that Backup Data is unavailable. A restore is validated before writing and retains the prior raw v2 value under `pondwise_v2_rollback`. Every later successful mutation replaces this single rollback snapshot, so download it before continuing if you need to keep it. Corrupt originals remain exportable through emergency recovery. Storage failures block saves and retain drafts. Save success is announced only after verified persistence.

Backups have a 5 MiB UTF-8 limit, a versioned envelope and an export timestamp. Workspace writes reserve room for the export metadata so every saved workspace can be imported again. Recovery accepts full legacy backups and schema v2; unsupported versions are rejected. Backups restore operational data and timezone, never the browser-selected tier. **Replacement restore only**; no merge semantics are implied. Exports contain all archived and trashed data. Backups and draft exports are unencrypted local files.

Cross-tab storage events pause editing, and every save compares the stored value with the value originally loaded. Export drafts and reload saved data to resolve a conflict. localStorage offers no multi-operation transaction: a simultaneous race between the comparison and write remains possible. Keep one editing tab open. Consider IndexedDB transactions if concurrent editing or larger datasets become necessary.

## Daily workflow

Use the persistent active-pond picker on every screen. New entries, helper answers and drafts belong to that selected pond. History and Money reporting have explicit **Active pond / All ponds / named pond** scope controls; archived pond history remains available. Ponds supports creating, editing and recoverably trashing a pond, plus editing or explicitly removing its current fish stock. Feed contains the manual Estimator and standard feed table on every tier; PondElite adds automatic dashboard calculations and per-pond rations. Money records Bought and Sold amounts and shows Profit as sold minus bought (net cash flow, not full accounting profit). The Tasks calendar shows task indicators and selected-day work; selecting a date prefills a new task without changing the date of an existing correction. Use Tab/Enter or the arrow keys to navigate dates.

Drafts remain in memory per workspace, pond and form when navigating or switching ponds. A leave/reload warning protects unsaved drafts. Settings can download drafts as a reference JSON file; that file is **not** a restorable notebook backup. A browser crash can lose unsaved drafts. Save records or export drafts before closing the tab. Editing a historical record preserves its original pond ownership even when viewed through All ponds.

See [FEATURES.md](FEATURES.md) for the current feature contract. The original `PondWise-Features.docx` is retained as a historical artifact; FEATURES.md supersedes its tier claims and workflow descriptions.

## Files

- `index.html`: accessible application shell and static script loading.
- `styles.css`: base responsive notebook layouts.
- `refinements.css`: shared blue, teal and amber visual system, light/dark components and floating plan offer.
- `js/icons.js`: local, accessible Lucide icon renderer; license and sources are retained in `assets/icons/`.
- `js/account.js`: local signup/sign-in, fixed demo login, profile, password hashing, photo resizing and theme preferences.
- `app.js`: navigation, view rendering, entry/draft handling and UI events; renders only the active view.
- `js/domain.js`: versioned schema, migration, dates, feed policy, money, integrity and selectors.
- `js/storage.js`: verified persistence, recovery snapshots and stale-write checks.
- `js/species.js`: cancellable, bounded, cached remote species lookup with local fallback.
- `species-data.js`: offline species names; feeding rates are exclusively in the shared domain policy.
- `tests/domain.test.js`: dependency-free Node domain/storage/API suite.
- `tests/browser-check.js`: optional synthetic browser integration and responsive harness.
- `tests/mobile-check.js`: optional isolated Playwright checks for mobile layouts, calendar interaction, date drafts, recovery and keyboard behavior.

## Checks

Node 18+ supports the test harness (a current LTS is recommended):

```sh
node tests/domain.test.js
node --test tests/*.test.js
node --check app.js
node --check js/account.js
node --check species-data.js
node --check js/domain.js
node --check js/storage.js
node --check js/species.js
node --check tests/domain.test.js
node --check tests/browser-check.js
git diff --check
```

For browser integration, install `agent-browser` separately, start the static server at port 8765, and run:

```sh
AGENT_BROWSER_BIN=/path/to/agent-browser \
AGENT_BROWSER_EXECUTABLE_PATH=/path/to/chromium \
node tests/browser-check.js
```

The harness creates its own named browser session and synthetic local data. It must never be attached to an operator's browser profile. Set `PONDWISE_TEST_URL` to change the isolated test origin. Browser screenshots are written under `/tmp`.

For the focused mobile suite, make Playwright available to Node (for example through a separate test environment), start the static server, and run:

```sh
PONDWISE_TEST_URL=http://127.0.0.1:8765 \
BROWSER_BIN=/path/to/chromium \
node tests/mobile-check.js
```

This suite checks 320, 375, 390, 480, 700 and 1440px and writes dashboard/calendar screenshots to `/tmp`. Software-keyboard viewport behavior is simulated; the suite does not need a physical phone. Set `AXE_CORE_PATH` to a local `axe-core/axe.min.js` file to audit all routes at 390 and 1440px as well.

Account browser regression (same server and browser setup as the integration harness):

```sh
node tests/account-check.js
```

## Plan offer and visual checks

The dashboard shows a dismissible Elite offer for Free and Pro previews. Closing it persists for the current browser workspace. Purchase buttons open an accessible native dialog with plan details and an optional local preview; **checkout is not connected and no payment is collected**. Elite previews do not show the offer. No prices, discounts or billing claims are implied.

The visual regression harness uses the taste skill’s zero-dependency headless Chrome helper. It starts its own temporary local server by default, checks routes in both themes and multiple viewport sizes, and writes screenshots under `/tmp/pondwise-refinements`. Point `PONDWISE_CDP_MODULE` at `design-taste-frontend/scripts/lib/cdp.mjs` and `CHROME_PATH` at your Chromium executable:

```sh
PONDWISE_CDP_MODULE=/path/to/design-taste-frontend/scripts/lib/cdp.mjs \
CHROME_PATH=/path/to/chromium node tests/refinement-check.mjs
```
