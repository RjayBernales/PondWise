# PondWise

A local pond notebook built with plain HTML, CSS and JavaScript. No framework, build step, account, payment processor or backend is required.

## Run

Serve this directory from a stable HTTP(S) origin. For development:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000`. For deployment, publish the static files together, including `js/` and `assets/`. Use HTTPS. Modern browsers with localStorage, Intl timezones, BigInt, structuredClone, AbortController and crypto.randomUUID are required. Direct `file:` opening has browser-dependent storage behavior and is not the supported persistence workflow.

**Data belongs to the browser and origin.** Changing scheme, hostname or port does not transfer records. Before moving an existing installation, open it at its original origin, download a backup, then preview and restore that backup at the new origin. Nothing synchronizes automatically.

## Existing data and recovery

The original `pondwise_v1` key is never changed or removed. On first opening legacy data, PondWise validates the complete dataset and shows migration counts before writing `pondwise_v2`. Valid numeric strings become typed values; blank optional measurements become `null`; PHP amounts become integer centavos. IDs and historical civil dates are retained. Historical creation/update/completion timestamps remain unknown rather than being invented. Duplicate IDs, orphan records, invalid fields and missing collections stop migration and show recovery tools; they are never guessed or silently dropped.

A successful migration writes and verifies v2 before the application switches to it. An interrupted or failed migration leaves legacy data recoverable. Opening v2 again is idempotent. To use the old version of the application during the compatibility period, serve the previous code at the **same original origin**; its untouched v1 dataset represents the point before migration. Later v2 edits are not copied back to v1.

Help & settings provides backup, original-data export, replacement restore preview, and rollback preview on every tier. A restore is validated before writing and retains the prior raw v2 value under `pondwise_v2_rollback`. Every later successful mutation replaces this single rollback snapshot, so download it before continuing if you need to keep it. Corrupt originals remain exportable. Storage failures block saves and retain drafts. Save success is announced only after verified persistence.

Backups have a 5 MiB UTF-8 limit, a versioned envelope and an export timestamp. Workspace writes reserve room for the export metadata so every saved workspace can be imported again. Recovery accepts full legacy backups and schema v2; unsupported versions are rejected. Backups restore operational data and timezone, never the browser-selected tier. **Replacement restore only**; no merge semantics are implied. Exports contain all archived and trashed data. Backups and draft exports are unencrypted local files.

Cross-tab storage events pause editing, and every save compares the stored value with the value originally loaded. Export drafts and reload saved data to resolve a conflict. localStorage offers no multi-operation transaction: a simultaneous race between the comparison and write remains possible. Keep one editing tab open. Consider IndexedDB transactions if concurrent editing or larger datasets become necessary.

## Daily workflow

Use the persistent active-pond picker on every screen. New entries and drafts belong to that pond. History and cash reporting have explicit **Active pond / All ponds / named pond** scope controls; archived pond history remains available. Navigate with desktop sidebar links or mobile Home, Ponds, Tasks, Records and More. Old `#dashboard`, `#feed`, `#finance`, `#guide` and `#plans` links still work; Back/Forward updates the visible screen.

Drafts remain in memory per workspace, pond and form when navigating or switching ponds. A leave/reload warning protects unsaved drafts. Settings can download drafts as a reference JSON file; that file is **not** a restorable notebook backup. A browser crash can lose unsaved drafts. Save records or export drafts before closing the tab. Editing a historical record preserves its original pond ownership even when viewed through All ponds.

See [FEATURES.md](FEATURES.md) for the current feature contract. The original `PondWise-Features.docx` is retained as a historical artifact; FEATURES.md supersedes its tier claims and workflow descriptions.

## Files

- `index.html`: accessible application shell and static script loading.
- `styles.css`: navy/blue responsive notebook UI and shared tokens.
- `app.js`: navigation, view rendering, entry/draft handling and UI events; renders only the active view.
- `js/domain.js`: versioned schema, migration, dates, feed policy, money, integrity and selectors.
- `js/storage.js`: verified persistence, recovery snapshots and stale-write checks.
- `js/species.js`: cancellable, bounded, cached remote species lookup with local fallback.
- `species-data.js`: offline species names; feeding rates are exclusively in the shared domain policy.
- `tests/domain.test.js`: dependency-free Node domain/storage/API suite.
- `tests/browser-check.js`: optional synthetic browser integration and responsive harness.

## Checks

Node 18+ supports the test harness (a current LTS is recommended):

```sh
node tests/domain.test.js
node --test tests/*.test.js
node --check app.js
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
