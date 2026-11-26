# PondWise

A local pond notebook built with plain HTML, CSS and JavaScript. No framework or build step is required. A small Node server connects the generative AI Helper to Meta. A browser-local profile gates the notebook UI; it is not server authentication or an encrypted vault.

## Run

Serve this directory from a stable HTTP(S) origin. For development:

```sh
node --env-file-if-exists=.env server.mjs
```

Open `http://127.0.0.1:8000`. Set `MODEL_API_KEY` in `.env` to enable Helper (see Generative Helper below). For hosting, serve the static assets and `/api/chat` together with server authentication and HTTPS. Modern browsers with localStorage, Intl timezones, BigInt, structuredClone, AbortController and crypto.randomUUID are required. Direct `file:` opening has browser-dependent storage behavior and is not the supported persistence workflow.

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

The dashboard shows a dismissible inline Elite offer for Free and Pro previews. Closing it persists for the current browser workspace. Purchase buttons open an accessible native dialog with plan details and an optional local preview; **checkout is not connected and no payment is collected**. Elite previews do not show the offer. No prices, discounts or billing claims are implied.

The visual regression harness uses the taste skill’s zero-dependency headless Chrome helper. It starts its own temporary local server by default, checks routes in both themes and multiple viewport sizes, and writes screenshots under `/tmp/pondwise-refinements`. Point `PONDWISE_CDP_MODULE` at `design-taste-frontend/scripts/lib/cdp.mjs` and `CHROME_PATH` at your Chromium executable:

```sh
PONDWISE_CDP_MODULE=/path/to/design-taste-frontend/scripts/lib/cdp.mjs \
CHROME_PATH=/path/to/chromium node tests/refinement-check.mjs
```

## Generative Helper and workspace redesign

The dashboard and dedicated `#helper` page share a natural-language conversation per pond and workspace. The fixed keyword responder has been removed. Helper uses Meta `muse-spark-1.3-contributor`, understands messy text and follow-ups, and receives the selected pond's stock plus recent water, feed, health and task records. Account credentials and financial records are excluded. Contributor mode allows Meta to use submitted content for model training; see [Meta's pricing modes](https://dev.meta.ai/docs/pricing-rate-limits). The information panel and privacy page explain this.

To enable actual generation, create a `.env` file using `.env.example` and set `MODEL_API_KEY` to a Meta Model API key. Do not put the key into browser code or commit it. Start the app with Node 22+:

```sh
node --env-file=.env server.mjs
```

Open `http://127.0.0.1:8000`. Without a key, the app still opens, but Helper shows a connection error and never substitutes canned answers. A plain static server cannot serve `/api/chat`. The included server binds to loopback for local use; an internet deployment needs server authentication and HTTPS rather than relying on the browser-local profile as API authentication.

Conversations are stored in the current tab's session storage, separately from pond records. New chat clears the selected conversation; signing out clears chat histories in that tab. Dashboard and Helper keep the same history. Switching ponds preserves separate histories. Only the most recent 24 messages are sent with each request. Chat errors support retry, and an in-progress response can be stopped.

Settings now has Appearance, Farm preferences, Account & security, Data & backup, and Help & about categories. Secondary explanations are opened with click-only information buttons. Labels, units, validation errors, storage failures, and restore confirmations stay visible. `workspace.css` defines the responsive workspace, light/dark styling and reduced-motion behavior. The upgrade panel is inline to avoid covering app controls. Workspace isolation remains unchanged; demo/sample labels have been removed from the interface.

Additional checks:

```sh
node --test tests/chat.test.mjs
CHROME_PATH=/path/to/chromium \
PONDWISE_CDP_MODULE=/path/to/design-taste-frontend/scripts/lib/cdp.mjs \
node tests/workspace-check.mjs
```

The server tests use simulated provider responses to verify the Meta request, field allowlist, follow-ups, provider errors, invalid requests and server file isolation. The workspace browser suite checks the simulated generation flow, history continuity, information popovers, all Settings categories, both themes and responsive routes. Live provider quality requires a configured key and should be checked with real conversations before hosting.

## GitHub Pages with Cloudflare AI

GitHub Pages serves the notebook. `cloudflare/worker.mjs` serves `/api/chat` on Cloudflare and imports the same AI policy/validation as the local Node server. This keeps the Meta key out of Pages and browser JavaScript. The Worker does not publish the repository or static files.

1. Authorize Cloudflare: `npx wrangler login`.
2. Deploy the backend from this directory: `npx wrangler deploy`.
3. Add the Meta key privately: `npx wrangler secret put MODEL_API_KEY`. Enter only the key when prompted; do not commit `.env` or put the key in `wrangler.jsonc`.
4. Set `chatEndpoint` in `js/config.js` to the deployment URL followed by `/api/chat`, for example `https://pondwise-helper.<account-subdomain>.workers.dev/api/chat`. This is a public URL, not a secret.
5. Commit and push the endpoint configuration to GitHub Pages. The public configuration uses the local `/api/chat` endpoint on localhost and the Worker on the hosted site, so local Node use keeps working. Other browser origins need explicit allowance in `ALLOWED_ORIGINS`.

The allowed browser origin is `https://rjaybernales.github.io` (the origin has no `/PondWise/` path). A custom domain must be added explicitly. Preflight requests are supported, arbitrary browser origins are rejected, request bodies are bounded, and platform rate-limit bindings apply per client and per site. Limits are approximate per Cloudflare location; CORS and limits are not server authentication. The public prototype has no server accounts. The Meta key never appears in responses or client configuration.

Worker health is available at `/health`; it reports only whether the key is configured. Request/response bodies are not logged by application code. Cloudflare credentials, `.dev.vars`, `.wrangler/` state and `.env` stay ignored by Git. See [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/) and [rate-limit binding behavior](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

Run `node --test tests/worker.test.mjs` for the origin/preflight, rate limits, validation, provider failures and secret-exclusion checks. Cloudflare deployment itself requires authorization to the intended account.

Deployed AI endpoint: `https://pondwise-helper.ond-ise.workers.dev/api/chat`. The frontend selects it automatically on GitHub Pages; the API key is a Cloudflare secret, not a repository value.

The Plans screen shows illustrative prices of ₱199/month for PondPro and ₱499/month for PondElite. PondStart has no price shown. The same prices appear in plan details; choosing a plan does not collect payment.
