# DOC'S NBA FORECAST ROOM 1

**GitHub edition — independent of the original NBA War Room and ChatGPT Site.**

## Status
The first working foundation is in `index.html`. It includes:
- Searchable player directory: position, listed/confirmed starter status, specialty, birthdate-derived age, height, weight, current-season salary and role notes.
- Explicit source and timestamp fields.
- Pregame forecasts with expected minutes, points, rebounds, assists, threes, blocks, attempts, rebound chances, potential assists, usage and evidence.
- Immutable pregame snapshots in the UI (saved snapshots cannot be edited).
- Postgame grading, category-level errors, PRA and mean absolute error.
- JSON backup and restore.

**Data is not live yet.** No external NBA API, injury source, salary feed, server database, or automatic scheduler is connected. Do not interpret manually entered starters as confirmed. Forecasts entered after the game date are labeled retrospective. A pregame lock timestamp alone cannot prove a forecast was saved before tipoff without verified game tip times.

**Persistence:** Browser localStorage only, per browser/device. Export JSON backups. Production-grade history requires remote storage and authenticated writes.

## Publish on GitHub Pages
In the repository, open **Settings → Pages → Build and deployment**. Choose **Deploy from a branch**, select **main** and **/(root)**, then save. The public address will normally be `https://drkimberlyrobins.github.io/docs-nba-forecast-room-1/` once GitHub reports a successful deployment. Verify the actual address in Pages settings.

## Next phases
1. Recover and inspect original ChatGPT Site source and history; do not overwrite it.
2. Connect authoritative NBA schedule, rosters, official injury reports, play-by-play/rotations and salary records.
3. Build an evidence-backed projection service with backtesting and timestamped pregame archives.
4. Add a durable shared database, scheduled data refreshes and source freshness checks.
5. Test pregame-to-postgame forecasts on held-out games before reporting predictive accuracy.

No original GitHub NBA repository or ChatGPT Site has been modified.
