# PondWise feature contract

This document describes the static notebook implementation and supersedes the original feature proposal in `PondWise-Features.docx`.

## Navigation and daily context

Overview leads with overdue/today work, estimated versus logged feeding, latest dated water observation, completed-today tasks and recent activity. The active pond is visible on every screen. Mobile navigation has Home, Ponds, Tasks, Records and More; Money, Tools, Help & settings and Plan preview live under More. Legacy hashes remain aliases. Native hash navigation supports bookmarking, Back and Forward, with `aria-current` on selected navigation links.

Ponds have editable details, a single current stock snapshot and a stock-update timestamp. Archive retains all history and frees an active-pond slot. Trashing a pond retains its entire dependent graph; recovering it is one validated mutation. Individual records and tasks have recoverable trash and immediate Undo. There is no permanent purge.

Tasks have future-capable due dates, an agenda with Overdue/Today/Upcoming/Completed groups, searchable/date-filtered complete history, correction actions and a month date chooser using native button semantics, with a native date input on small phones. Selecting a day prefills the entry date; changing the displayed month preserves that date. Completion sets an actual UTC `completedAt`; reopening clears it. Legacy completion times remain unknown. Completing a task never silently creates an observation or financial entry.

Records have one entry form at a time for feeding, water, health or maintenance. Every history is searchable, filterable by period and pond, and paginated without a hidden eight-row cap. Water checks require at least one measurement or observation. Empty, stale and missing measurements are identified separately. Dashboard and guide use the same deterministic latest-water selector (observation date, creation timestamp, ID); insertion order does not override observation date.

Money combines income and expenses in a searchable, categorized, period-filtered ledger. The explicit scope and all active filters govern the totals. **Net cash flow = income − expenses**; it is not accounting profit. PHP values are stored as integer centavos, summed exactly and rejected if aggregates exceed the safe integer range. Transaction descriptions do not alter stock.

## Shared input contracts

The domain validator applies to forms, stored datasets, legacy migration and backups.

| Field | Constraint |
|---|---|
| Pond name, task title, transaction description | Trimmed, 1–120 characters |
| Notes / observations | Trimmed, up to 2,000 characters; health and maintenance observations required |
| Species names | Up to 200 characters |
| Pond area | Optional; finite and greater than zero |
| Fish count | Optional snapshot field; integer 0–10,000,000 |
| Average weight | Optional snapshot field; greater than zero, up to 1,000,000 g when supplied |
| Feeding rate override | Optional; greater than zero, up to 15% |
| Feed logged | Greater than zero, up to 1,000,000 kg; skipped feeding is explicit and records 0 kg |
| Water pH | Optional, 0–14 |
| Temperature | Optional, 0–60 °C |
| Money | Positive decimal PHP amount with at most two decimal places, stored in safe integer centavos |
| Observation/transaction date | Valid YYYY-MM-DD, no future observations |
| Task due date | Valid YYYY-MM-DD; future dates allowed |

The default farm timezone is **Asia/Manila**, editable as an IANA timezone. Civil observation/due dates remain distinct from UTC creation/update/completion instants. An open app notices farm-day rollover. Existing draft dates stay unchanged. Changing timezone does not rewrite history; any record that would become a future observation prevents that settings change until resolved.

## Feed and species

One size-based policy (`PondWise size guide v1`) supplies calculator, pond details, Overview and the rule-based guide. It returns biomass, rate, daily estimate, meal range, source and warnings. Stages are 0–<5 g, 5–<20 g, 20–<100 g, 100–<250 g and ≥250 g; rates are 10%, 7%, 5%, 3% and 2.5% respectively. Fractional fry weights are supported. Incomplete stock yields a missing-input state; zero count with a valid weight yields zero feed. Manual calculator overrides are explicit and do not alter the stock policy.

These are starting estimates requiring species-aware aquaculture review, not authoritative prescriptions. Meals follow the selected stage rather than a hard-coded two-meal assumption. Water guidance states missing information and suggests verification/local expert assessment instead of blanket treatment instructions. The guide is visibly rule-based and prioritizes distress/health terms.

Species lookup immediately displays local name matches, then optionally queries FishBase by genus. Blank queries stay local. HTTP status, response shape, name length, timeout, cancellation, stale response order and cache are handled. Remote failure preserves usable local results with retry guidance. Choosing a species populates the original active pond's stock draft, without saving it automatically.

## Tier preview and data ownership

PondStart allows 1 active pond, PondPro 5 and PondElite unlimited. Money entry/correction is available in Pro/Elite preview; existing money records remain readable/exportable on Start. Basic observations, tasks, feed estimates, backup/export/restore and trash recovery are available on every tier. Downgrades retain all ponds and data, blocking creation/reactivation when at or above the limit. Archived ponds do not count. Replacement restore preserves valid over-limit datasets. The demo has separate data and tier preferences. The separate seeded demo starts with three practice ponds regardless of tier; subsequent creation/reactivation follows the normal limits.

Tier selection is a local preview, not a paid subscription or security boundary. There are no advertised reminders, featured profiles, support subscriptions, push notifications, paid enforcement or unavailable analytics.

## Recovery and scope limits

Schema v2 uses `schemaVersion`, `revision`, settings and declared collections. Migration previews counts, preserves the untouched legacy key, validates references and refuses ambiguous data. Recovery and replacement restore retain raw originals and a one-level rollback snapshot. Read/write/quota failures are explicit. Drafts survive failed saves. See README for origin transfer, export limits and concurrency limitations.

Intentionally outside this release: accounts, server backend, sync, payment processing, push notifications, merge imports, stock batches/cycles, permanent deletion, encrypted vaults and installable offline delivery. The notebook works with the locally cached page/assets and local species library; no service-worker offline-install guarantee is made.
