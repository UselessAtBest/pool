# 8-Ball League Site (Jekyll)

This is a full rebuild of the site on Jekyll. The biggest difference from
the previous version: **every page is now a real, separate static HTML
file, generated at build time** - a team's standings, a player's win %, a
match's score, all computed once when the site builds, not in your
browser. There's no more client-side router, no more `fetch()`-ing CSVs on
page load, no more "SPA fallback" server config to get right. A link to
`/player/jamie-mercer/` is a real file at that path; right-click-open-in-
new-tab, view-source, and a plain refresh all just work, everywhere,
including with JavaScript off (theme/language toggles are the only things
that need JS - `assets/js/app.js` is now ~70 lines instead of the old
~600).

The weekly workflow you already know - add a `Week,<n>,<date>` block to
the season's fixtures CSV, fill in a report CSV after the match, edit
`players`/`teams` when rosters change - is unchanged. Only the *engine*
reading those files changed, from JavaScript in the browser to a Ruby
plugin that runs when the site builds.

## What builds the site

A **Jekyll::Generator** plugin (`_plugins/league_generator.rb`, using
`_plugins/league_data.rb` and `_plugins/page_views.rb`) runs once per
build. It reads `_data/config.yml`, `_data/teams.yml`, `_data/players.yml`,
and the raw CSVs under `_league_source/`, computes every standing/roster/
clearance the same way the old client-side code did, and writes a real
page for:

- Home, Fixtures, Teams
- every team (`/teams/<slug>/`)
- every player (`/player/<slug>/`)
- every week (`/week/<n>/`)
- every match (`/match/<team-a>-<team-b>/`)
- the three detailed ranking tables (`/ranking/teams/`, `/ranking/players/`,
  `/ranking/clearances/`)

`rules.html`, `notice.html`, and `404.html` are plain Jekyll pages (not
generated) since their content isn't data-driven.

## One-time setup on GitHub

1. Push this repo to GitHub.
2. In the repo, go to **Settings → Pages**, and under "Build and
   deployment / Source" choose **GitHub Actions** (not "Deploy from a
   branch"). That's it - `.github/workflows/pages.yml` handles the rest,
   including automatically detecting whether your site needs a
   `/repo-name/` prefix or not (project site vs. a custom domain), so
   there's nothing to hand-configure in `_config.yml`.
3. Push to `main` and check the **Actions** tab for the build. Any Ruby
   error in the plugin will show up there with a full stack trace and line
   number.

## Local development

```
bundle install
bundle exec jekyll serve
```

then open `http://localhost:4000/pool/` (note the `/pool/` - `baseurl` in
`_config.yml` applies locally too, so the site serves under that path even
on your machine, matching how it's actually deployed).
`bundle exec jekyll serve --livereload`
will auto-rebuild and refresh your browser as you edit files.

## Updating the site each week

Identical to before:

**1. Add next week's fixtures** to `_league_source/fixtures/2026-27.csv` -
append a `Week,<n>,<date>` block:

```
Week,3,2026-09-03
Team A,Team B
Team C,Team D,postponed
```

Team names can be either a team's `id` or its `displayName` - resolved
automatically either way. Add `postponed` as a third column to flag a
fixture as postponed (shows a badge everywhere instead of "Upcoming", and
the match page says so instead of "hasn't been played yet").

**2. After the match, add the report** to
`_league_source/reports/2026-27/week-03.csv`, using player `uniqueID`s.
One `MATCH` row per fixture, followed by 6 `SINGLES` and 3 `DOUBLES` rows:

```
Type,PlayerA1,PlayerA2,PlayerB1,PlayerB2,ScoreA,ScoreB,Clearance
MATCH,black-cats,,red-devils,,6,3,
SINGLES,j-mercer,,r-ferreira,,1,0,
...
DOUBLES,j-mercer,s-vance,r-ferreira,k-obrien,1,0,
```

The `MATCH` row's own score is just for reference - the real score and
bonus point are always recalculated from the 9 game rows underneath it. A
player's `uniqueID` in the `Clearance` column shows the 🎱 next to whichever
side actually cleared, and links to that exact game.

Once a report file exists for a week, that week is "Played" everywhere -
nothing else to flip. Commit and push; the site rebuilds automatically.

`templates/` has blank copies of everything (`fixtures-template.csv`,
`match-report-template.csv`, `config-template.yml`, `teams-template.yml`,
`players-template.yml`) with every field documented.

## Editing players, teams, and config

Same fields as before, now in `_data/*.yml` instead of `.js`/`.json`:

- **`_data/players.yml`** - `id`, `displayName`, `seasons` (map of season →
  team id), `bio`, `contact`, `photo`.
- **`_data/teams.yml`** - `venue`, `address`, `captain` (a player id),
  `venueOwner` (a player id if they're a league player, otherwise plain
  text), `info`, `image`, `activeSeasons`, `hiddenFromCurrentSeason`.
  Roster isn't stored here - it's derived from every player whose
  `seasons` map points at the team.
- **`_data/config.yml`** - league name, `currentSeason`, `seasons` list,
  disclaimer text.

**Hiding a team / active seasons** works exactly like before: a team only
appears in the Teams list and rankings when `currentSeason` is in its
`activeSeasons` list (or set `hiddenFromCurrentSeason: true` for a quicker
manual override). An inactive team's own page still works, and
automatically falls back to showing the roster from its most recent active
season instead of an empty one.

**Team/player images** - set `image` on a team or `photo` on a player to a
URL or a relative path (e.g. `/assets/img/teams/black-cats.jpg`, with the
file placed under `assets/img/` alongside the other assets). Leave `null`
for no photo.

## Language switching

The `EN`/`ES` toggle next to the theme button still works the same way -
it re-translates the page you're currently looking at, no reload. The
difference from before: since pages are now pre-rendered in English at
build time, translatable UI text is marked with `data-i18n="key"`
attributes right in the generated HTML (interpolated bits like "Week 3"
carry the number in a `data-i18n-n="3"` attribute alongside), and
`assets/js/i18n.js` walks the page re-running the same lookup on toggle.
Team names, player names, bios, and anything from your data files are
never machine-translated - only the site's own UI chrome is. Add a third
language by copying the `en` block in `assets/js/i18n.js` and translating
the values.

## A note on testing

I wasn't able to run an actual Ruby interpreter while building this (no
network access to install one in my sandbox), so the plugin code is
carefully hand-reviewed and the standings/roster/clearance *logic* is
independently cross-checked against the previous JS version's known-good
output, but it hasn't been run through a real `jekyll build`. Please run
`bundle exec jekyll build` (or push and check the Actions log) as your
first step, and if anything throws a Ruby error, paste it back to me with
the file/line it points to and I'll fix it fast.
