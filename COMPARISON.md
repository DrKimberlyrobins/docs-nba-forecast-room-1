# Player engine comparison — delivery status

This is an additive GitHub Pages module. `index.html`, existing forecasts, grading views and every original archive are preserved. `comparison-core.js` is shared by browser and server receipt validation. External imports never feed the DOC model.

## Actual access audit (November 4, 2026)

| Source | Authorized route found | Retrieved game-specific player projections |
| --- | --- | --- |
| SportsLine | Subscriber tables can be imported by an authorized user; no authorized API confirmed | No |
| Statz AI | Pro subscription/player tables; manual authorized import | No |
| The Margin | Public JSON allowed with credit, https://themarginsports.com/data/ | No: player page is season projections; no verified game-specific player endpoint |
| DARKO | Public daily per-game fantasy estimates and CSV, https://www.darko.app/projections | No: daily baseline is not a specific opponent/game forecast |
| PropScout | Daily projection product documented; public retrieval failed | No |
| xEP Network | Game-specific props documented, https://xep.ai/docs | No authorized feed retrieved |

All six start **Unavailable**, rather than being labeled connected. Imports show Imported or Stale, based on source time and tipoff. Data older than six hours or past tip is stale. Last successful receipt time and each row's source time are visible. No season average is inserted into an external projection column.

## Inputs and use

Open **PLAYER ENGINE COMPARISON**. Choose the date and matchup. The schedule and current rosters come from sourced ESPN feeds; all games appear even when no DOC snapshot exists. Archives are joined by game ID and team ID, never by carrying old player forecasts to another date.

Paste CSV/TSV using the form. Confirm permission and source verification. Enter a HTTPS source URL and ISO source time with timezone. Accepted headers:

```
player,team,date,game_id,MIN,PTS,REB,AST,3PM,PRA
```

Names match exactly after punctuation/diacritic normalization, on team and game date. ESPN `player_id` can replace a name, and `game_id` resolves doubleheaders/reschedules. Long format uses `category,projection`. Empty cells and N/A remain missing. PRA is derived only when PTS, REB, AST are all present. Duplicate rows, wrong teams, missing rosters, ambiguous players, future source timestamps and season forecasts are rejected.

Browser imports are **device-local**. Export comparison receipts for backup. For a shared import, run GitHub Actions → **Refresh player engine comparison** → Run workflow, and paste the exported JSON into `import_json`. GitHub's runner validates all identities again and uses its own receipt timestamp. Browser receipt timestamps are not accepted as proof of a pregame shared capture. Never put subscription credentials or API keys in this public repository.

Quote imports require `player,team,date,game_id,category,line,over_odds,under_odds,book`. Quotes are explicitly operator-attested, not a connected live bookmaker feed. Recommended candidates require fresh DOC snapshots (6h), quotes (1h), at least five observed appearances, valid American prices and positive estimated return. No more than one selection per player; up to two distinct players per team. Missing inputs are listed rather than filling two slots with invented picks.

## Simulation and grades

No 10,000-run simulator exists in the inspected repository at base commit `36e42f4446a2128b682ef6adce8e7d51aaa208f8`. None was removed or replaced. The comparison layer supplies a **separate, experimental DOC-centered empirical residual bootstrap** with 10,000 draws. It preserves the DOC mean as the center and preserves historical PRA correlation by taking whole-game PRA residuals. Outputs are rounded/clipped and can have a different simulated sample mean; they are not recalibrated DOC projections. Historical appearance samples can span seasons. This distribution has not been calibrated or validated for betting accuracy. Reported edge is an estimate from that distribution and the actual supplied odds, not established expected value.

Shared pregame captures are append-only content-addressed JSON under `data/comparison/receipts/`; imports are separate under `imports/`. Postgame collection writes separate actuals and grade summaries. Primary engine metrics use the latest eligible server capture before tipoff, independently of final results. MAE, signed bias and RMSE are category-specific. DNPs are excluded, and recommendation DNPs voided. One-unit flat-stake wins/losses/pushes and ROI use captured American odds. Rescheduled/cancelled/delayed games do not receive current recommendations; imports for another date do not match the rescheduled date.

## Statistics

The collector attempts NBA official base, advanced, possessions, rebounding and passing endpoints for last 5, last 10 and season. Linking to the repository's ESPN player IDs requires an exact full-name **and team** match. All 15 requests failed in the implementation environment. Errors are recorded and tracking metrics remain N/A. The ESPN current-season athlete-log collector retrieved 501 player logs, 434 with regular-season appearances. It supplies source-labeled last-five, last-ten and season actuals, FGA/3PA/3PM and TS/eFG calculated from aggregate shooting totals. Small samples are explicitly labeled `n/5` or `n/10`. Archived partial evidence is never called a season average. Usage and tracking metrics remain N/A. Rankings use actual available inputs only; unsupported efficiency/touches/rebound-chances rankings remain unavailable.

## Remaining blockers

- No external game-specific projection feed has actually been retrieved. Authorized imports are ready, but no user data was fabricated to demonstrate a connection.
- The original collector was refreshed through its supported update route: 14 November 4 pregame forecasts saved at 08:56:10 UTC, with 186 historical box scores, 28 rosters, 123 injury rows and no collection errors. The comparison workflow syncs these original forecasts before refreshing its separate data.
- No verified sportsbook player quotes were available, so there are no live Top Two recommendations or real-data betting-edge validation yet.
- Official NBA tracking endpoints failed in this environment; GitHub Actions will retry, with failures visible.
- Shared future capture/grading is implemented but cannot yet be verified end-to-end on real eligible external forecasts and completed results. No historical pregame record is backfilled using postgame imports.

## Verification

`node --test tests/*.test.cjs` tests ingestion, missing vs zero, matching/trades/ambiguity, chronology, retrospective exclusions, disagreements, averages, deterministic 10,000 draws, prop gating, odds settlement and preservation using real November 1 archives and November 4 schedules/rosters. Synthetic test inputs remain in tests and are never published as projection data. Existing archive files must have zero diff.
