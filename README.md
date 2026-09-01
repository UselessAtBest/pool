# 8-Ball League Site

A static, no-build website for tracking an 8-ball pool league: fixtures, match
reports, team/player pages, and three sets of rankings (teams, players,
clearances). Dark purple theme by default with a light-theme toggle.

It's plain HTML/CSS/JS — no framework, no build step. All league data lives in
JSON and CSV files under `data/`, which you edit every week.

## Running it locally

Because the app loads data with `fetch()`, it has to be served over HTTP —
opening `index.html` directly (`file://...`) will fail silently in most
browsers. From this folder, run:

```
python3 serve.py
```

then open `http://localhost:8080`. This is a small custom server (not the
plain `python3 -m http.server`) — it also makes refreshing a deep link like
`/player/jamie-mercer` work locally the same way it already does once
deployed (see "Deploying with clean URLs" below). Pass a port as an argument
if 8080 is taken: `python3 serve.py 8090`.

## Updating the site each week

**1. Add next week's fixtures.**
All of a season's fixtures live in one file, `data/fixtures/2026-27.csv`.
Each week starts with a `Week,<number>,<date>` marker row, followed by that
week's pairings — first team listed is the home team:

```
Week,3,2026-09-03
Team A,Team B
Team C,Team D
```

Just append a new `Week,...` block to the bottom of the file for each
upcoming week — no separate file, and no other file to register it in.
`data/templates/fixtures-template.csv` has a two-week example if you want a
starting point (e.g. for a new season).

Team names here can be either the team's `id` or its `displayName` from
`data/teams.json` — the site resolves either one to the same team, so it
doesn't matter which style you're consistent with.

To mark a fixture as postponed, add `postponed` as a third column on that
line — it'll show a "Postponed" badge everywhere instead of "Upcoming", and
the match report page will say so instead of "hasn't been played yet":

```
Week,3,2026-09-03
Team A,Team B
Team C,Team D,postponed
```

**2. After the match is played, add the report.**
Copy `data/templates/match-report-template.csv` to
`data/reports/2026-27/week-03.csv` (the report files are still one per
week — match numbers with the `Week,<number>,...` marker in the fixtures
file, zero-padded to two digits) and fill in each row using player
`uniqueID`s (not display names) — the `MATCH` row's team columns accept
either the team's `id` or `displayName`, same as fixtures above. One `MATCH`
row per fixture, followed by its 6 `SINGLES` rows and 3 `DOUBLES` rows:

```
Type,PlayerA1,PlayerA2,PlayerB1,PlayerB2,ScoreA,ScoreB,Clearance
MATCH,black-cats,,red-devils,,6,3,
SINGLES,j-mercer,,r-ferreira,,1,0,
SINGLES,t-oyelaran,,k-obrien,,0,1,
...
DOUBLES,j-mercer,s-vance,r-ferreira,k-obrien,1,0,
```

- `ScoreA`/`ScoreB` on a `SINGLES` or `DOUBLES` row is `1`/`0` (or `0`/`1`) —
  whoever won that game.
- The `Type,MATCH` row's own score is just for your reference; the site
  always recalculates the real match score (and the bonus point) by summing
  the 9 game rows underneath it, so it can't get out of sync.
- Put a player's `uniqueID` in the `Clearance` column on whichever game they
  cleared the table in. Leave it blank otherwise — and it'll show up next to
  whichever side actually made it, not always on one side.
- Once this file exists, the site marks that week "Played" automatically —
  there's nothing else to flip.

## Adding or editing players and teams

- **`data/players.js`** — one entry per player: `id` (their uniqueID, used
  in match reports), `displayName` (used everywhere on the public site),
  and `seasons` (a map of season → team id). The current season's entry is
  shown as their current team; every other season shows as a past team.
  It's loaded as a plain `<script>` tag (`window.PLAYERS_DATA = {...}`)
  rather than fetched, so — unlike the rest of the data — editing it still
  works even when opening `index.html` straight from disk.
- **`data/teams.json`** — one entry per team: venue, address, `captain`
  (a player `id`, links to their profile), `venueOwner` (also a player `id`
  if the owner is a league player — links the same way; otherwise just
  plain text, e.g. `"Marcus Webb"`, and it's shown as-is with no link), and
  a blurb.  A team's roster isn't stored here — it's derived automatically
  from every player whose `seasons` map points at that team for the current
  season.
- **`data/config.json`** — league name, and which entry in `seasons` is
  `currentSeason`. Flip this at the start of a new season.

## URLs

| Page | URL |
|---|---|
| Home | `/` |
| Fixtures | `/fixtures` |
| Teams list | `/teams` |
| Team page | `/teams/black-cats` |
| Player page | `/player/jamie-mercer` |
| Week report | `/week/1` (also answers to `/match/Week1` and `/matches/Week1`) |
| Single match report | `/match/black-cats-red-devils` |
| Team rankings (detailed, sortable columns) | `/ranking/teams` |
| Player rankings (detailed) | `/ranking/players` |
| Clearances (detailed) | `/ranking/clearances` |
| Rules | `/rules` |

Team and player URLs are built from their display name (lowercased,
spaces → hyphens), not their internal id.

## Hiding a team for the current season

Every team in `data/teams.json` has an `"activeSeasons"` array (e.g.
`["2025-26", "2026-27"]`) — a team is only shown in the Teams list and the
team/full rankings tables (main-page preview and `/ranking/teams`) when the
current season is in that list. Drop a season off the list (or just leave
it off a brand-new team) to keep it out of that season's public pages.

There's also a `"hiddenFromCurrentSeason": true` flag for a quicker manual
override — set it to hide a team from the current season regardless of
`activeSeasons` (useful if a team is technically still active but you want
it off the page temporarily, e.g. mid-dispute or on hiatus).

Either way, the team's own page still works if linked directly — useful so
a player's past-team history keeps resolving even after their old team is
hidden.

## Team & player images

- **Team photo**: set `"image"` on a team in `data/teams.json` to an image
  URL or a relative path (e.g. `"images/teams/black-cats.jpg"`, with the
  file placed in an `images/` folder you create alongside `index.html`).
  Leave it `null` for no photo.
- **Player photo**: same idea, `"photo"` on a player in `data/players.js`.
  Falls back to a colored initials badge when left `null`.

## Language switching

There's a language button next to the theme toggle (shows `EN`/`ES`) that
cycles through whatever languages are defined in `js/i18n.js`. It re-renders
the current page in the new language and remembers the choice for next
visit. Team names, player names, bios, and anything from your CSV/JSON data
files aren't machine-translated — only the site's own UI text (nav, labels,
buttons, headings) is. To add a third language, copy the `en` block in
`js/i18n.js`, translate the values, give it a new top-level key (e.g. `fr`),
and it'll show up in the toggle automatically.

## Deploying with clean URLs

This is a single-page app using the browser History API, so the *server*
needs to send every path to `index.html` and let the app's own router figure
out what to show — otherwise `/player/jamie-mercer` 404s at the host level
before the app ever loads. A config file for each of the common hosts is
already included:

- **Netlify** — `_redirects` is already set up, no action needed.
- **Vercel** — `vercel.json` is already set up, no action needed.
- **GitHub Pages** — there's no rewrite config option, so `404.html` is a
  copy of `index.html` as a fallback (GitHub Pages serves it for any unknown
  path while keeping the URL in the address bar, and the app's router takes
  it from there). If you change `index.html`, copy it over `404.html` again.
- **Any other static host** — look for "SPA fallback" or "custom 404" in its
  docs and point it at `index.html`.

## Sample data

The site ships with 4 example teams, 20 example players, and two example
weeks (one played, one upcoming) so you can see everything working end to
end. Replace it with your real league's data whenever you're ready — nothing
in the code is specific to the sample teams.

## Rules page

The rules page content, in `js/views.js` (`rulesView()`), is a placeholder —
swap in your real rulebook text; it's plain HTML so headings, lists, and
paragraphs will pick up the site's styling automatically.
