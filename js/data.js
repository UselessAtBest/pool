const LEAGUE = {
  config: null,
  players: [],
  teams: [],
  playersById: {},
  teamsById: {},
  weeks: [],       // [{ id, season, number, date, fixtures:[{home,away}], matches:[...] }]
  matchesByTeams: {}, // key: "slugA__slugB" (sorted) -> [match, ...]
};

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function teamBySlug(slug) {
  return LEAGUE.teams.find(t => slugify(t.displayName) === slug || t.id === slug);
}

function playerBySlug(slug) {
  return LEAGUE.players.find(p => slugify(p.displayName) === slug || p.id === slug);
}

/** CSV files may reference a team by its id ("black-cats") or its display name
 *  ("Black Cats") - resolve either to the canonical display name so every view
 *  shows the same thing regardless of which one was typed in the CSV. */
function resolveTeamName(raw) {
  if (!raw) return raw;
  const val = raw.trim();
  const team = LEAGUE.teams.find(t => t.id === val || t.displayName.toLowerCase() === val.toLowerCase());
  return team ? team.displayName : raw;
}

async function loadLeagueData() {
  const [config, teamsData] = await Promise.all([
    fetchJSON('data/config.json'),
    fetchJSON('data/teams.json'),
  ]);

  if (!window.PLAYERS_DATA) {
    throw new Error('players.js not loaded - check the <script src="data/players.js"> tag is before js/data.js in index.html');
  }

  LEAGUE.config = config;
  LEAGUE.players = window.PLAYERS_DATA.players;
  LEAGUE.teams = teamsData.teams;
  LEAGUE.playersById = Object.fromEntries(LEAGUE.players.map(p => [p.id, p]));
  LEAGUE.teamsById = Object.fromEntries(LEAGUE.teams.map(t => [t.id, t]));

  const season = config.currentSeason;

  // One fixtures file per season: "Week,<n>,<date>" marker rows introduce each
  // week, followed by that week's "home,away[,postponed]" pairing rows.
  let fixtureRows = [];
  try {
    fixtureRows = await fetchCSV(`data/fixtures/${season}.csv`);
  } catch (e) {
    console.warn('No fixtures file found for season', season, e);
  }

  const weeks = [];
  let currentWeek = null;
  for (const r of fixtureRows) {
    const marker = (r[0] || '').trim().toLowerCase();
    if (marker === 'week') {
      const number = parseInt(r[1], 10) || 0;
      currentWeek = {
        id: `week-${String(number).padStart(2, '0')}`,
        season, number,
        date: (r[2] || '').trim() || null,
        fixtures: [], matches: [], played: false,
      };
      weeks.push(currentWeek);
    } else if (currentWeek && r[0] && r[0].trim()) {
      currentWeek.fixtures.push({
        home: resolveTeamName(r[0].trim()),
        away: resolveTeamName((r[1] || '').trim()),
        postponed: (r[2] || '').trim().toLowerCase() === 'postponed',
      });
    }
  }

  for (const week of weeks) {
    // report (may not exist yet if the week hasn't been played)
    let reportRows = null;
    try {
      reportRows = await fetchCSV(`data/reports/${season}/${week.id}.csv`);
    } catch (e) {
      reportRows = null;
    }

    const reportedMatches = (reportRows && reportRows.length > 1) ? buildMatchesFromReport(reportRows, week) : [];
    const reportedByPair = Object.fromEntries(reportedMatches.map(m => [m.homeTeamName + '|' + m.awayTeamName, m]));

    // Merge: every fixture becomes a match, using the reported result if one exists,
    // otherwise a placeholder (unplayed, or postponed if flagged in the fixtures CSV).
    week.matches = week.fixtures.map(fx => {
      const reported = reportedByPair[fx.home + '|' + fx.away];
      if (reported) return reported;
      return {
        week: week.id,
        weekNumber: week.number,
        date: week.date,
        homeTeamName: fx.home,
        awayTeamName: fx.away,
        played: false,
        postponed: fx.postponed,
        games: [],
        scoreA: 0, scoreB: 0, pointsA: 0, pointsB: 0,
      };
    });

    week.played = !!(reportRows && reportRows.length > 1);
  }

  weeks.sort((a, b) => a.number - b.number);
  LEAGUE.weeks = weeks;
  indexMatchesByTeams();
  return LEAGUE;
}

function buildMatchesFromReport(rows, week) {
  const [, ...body] = rows; // skip header row
  const matches = [];
  let current = null;

  for (const r of body) {
    const [type, a1, a2, b1, b2, scoreA, scoreB, clearance] = r.map(x => (x || '').trim());
    if (!type) continue;

    if (type.toUpperCase() === 'MATCH') {
      if (current) matches.push(current);
      current = {
        week: week.id,
        weekNumber: week.number,
        date: week.date,
        homeTeamName: resolveTeamName(a1),
        awayTeamName: resolveTeamName(b1),
        played: true,
        games: [],
        rawGamesA: parseInt(scoreA, 10) || 0,
        rawGamesB: parseInt(scoreB, 10) || 0,
      };
    } else if (current) {
      current.games.push({
        type: type.toUpperCase(), // SINGLES | DOUBLES
        sideA: [a1, a2].filter(Boolean),
        sideB: [b1, b2].filter(Boolean),
        scoreA: parseInt(scoreA, 10) || 0,
        scoreB: parseInt(scoreB, 10) || 0,
        clearance: clearance || null,
      });
    }
  }
  if (current) matches.push(current);

  // derive final scores + bonus point from the actual game rows (source of truth)
  matches.forEach(m => {
    const gamesA = m.games.reduce((s, g) => s + g.scoreA, 0);
    const gamesB = m.games.reduce((s, g) => s + g.scoreB, 0);
    m.scoreA = gamesA;
    m.scoreB = gamesB;
    m.pointsA = gamesA + (gamesA > gamesB ? 1 : 0);
    m.pointsB = gamesB + (gamesB > gamesA ? 1 : 0);
  });

  return matches;
}

function indexMatchesByTeams() {
  LEAGUE.matchesByTeams = {};
  for (const week of LEAGUE.weeks) {
    for (const m of week.matches) {
      const slugA = slugify(m.homeTeamName);
      const slugB = slugify(m.awayTeamName);
      const key = [slugA, slugB].sort().join('__');
      (LEAGUE.matchesByTeams[key] ||= []).push(m);
    }
  }
}

function findMatchByTeamSlugs(slugA, slugB) {
  const key = [slugA, slugB].sort().join('__');
  const list = LEAGUE.matchesByTeams[key] || [];
  return list[list.length - 1] || null; // most recent meeting
}

/** Given a combined "teamA-teamB" URL param, figure out which two known team
 *  slugs it's made of (team slugs may themselves contain hyphens). */
function splitTeamPairSlug(combined) {
  const slugs = LEAGUE.teams.map(t => slugify(t.displayName));
  for (const s of slugs) {
    if (combined === s) continue;
    if (combined.startsWith(s + '-')) {
      const rest = combined.slice(s.length + 1);
      if (slugs.includes(rest)) return [s, rest];
    }
    if (combined.endsWith('-' + s)) {
      const rest = combined.slice(0, combined.length - s.length - 1);
      if (slugs.includes(rest)) return [rest, s];
    }
  }
  return null;
}

/* ===================== Standings ===================== */

function computeTeamStandings() {
  const stats = {};
  for (const t of LEAGUE.teams) {
    stats[t.id] = {
      team: t, matchesPlayed: 0, matchesWon: 0, gamesWon: 0, gamesPlayed: 0,
      points: 0, homePlayed: 0, homeWon: 0, awayPlayed: 0, awayWon: 0,
    };
  }
  const idFor = (name) => {
    const t = LEAGUE.teams.find(t => t.displayName === name);
    return t ? t.id : null;
  };

  for (const week of LEAGUE.weeks) {
    for (const m of week.matches) {
      if (!m.played) continue;
      const idA = idFor(m.homeTeamName);
      const idB = idFor(m.awayTeamName);
      if (!idA || !idB) continue;
      const sA = stats[idA], sB = stats[idB];

      sA.matchesPlayed++; sB.matchesPlayed++;
      sA.gamesPlayed += 9; sB.gamesPlayed += 9;
      sA.gamesWon += m.scoreA; sB.gamesWon += m.scoreB;
      sA.points += m.pointsA; sB.points += m.pointsB;
      sA.homePlayed++; sB.awayPlayed++;

      if (m.scoreA > m.scoreB) { sA.matchesWon++; sA.homeWon++; }
      else if (m.scoreB > m.scoreA) { sB.matchesWon++; sB.awayWon++; }
    }
  }

  const list = Object.values(stats);
  list.sort((a, b) => b.points - a.points || b.gamesWon - a.gamesWon || a.team.displayName.localeCompare(b.team.displayName));
  return list;
}

function computePlayerStandings() {
  const stats = {};
  for (const p of LEAGUE.players) {
    stats[p.id] = {
      player: p, singlesPlayed: 0, singlesWon: 0,
      doublesPlayed: 0, doublesWon: 0, clearances: 0,
    };
  }

  for (const week of LEAGUE.weeks) {
    for (const m of week.matches) {
      if (!m.played) continue;
      for (const g of m.games) {
        const aWon = g.scoreA > g.scoreB;
        if (g.type === 'SINGLES') {
          const pa = g.sideA[0], pb = g.sideB[0];
          if (stats[pa]) { stats[pa].singlesPlayed++; if (aWon) stats[pa].singlesWon++; }
          if (stats[pb]) { stats[pb].singlesPlayed++; if (!aWon) stats[pb].singlesWon++; }
        } else if (g.type === 'DOUBLES') {
          for (const pid of g.sideA) if (stats[pid]) { stats[pid].doublesPlayed++; if (aWon) stats[pid].doublesWon++; }
          for (const pid of g.sideB) if (stats[pid]) { stats[pid].doublesPlayed++; if (!aWon) stats[pid].doublesWon++; }
        }
        if (g.clearance && stats[g.clearance]) stats[g.clearance].clearances++;
      }
    }
  }

  const list = Object.values(stats).filter(s => s.player);
  list.forEach(s => {
    s.winPct = s.singlesPlayed ? (s.singlesWon / s.singlesPlayed) * 100 : 0;
    s.doublesWinPct = s.doublesPlayed ? (s.doublesWon / s.doublesPlayed) * 100 : 0;
    s.totalPoints = s.singlesWon; // 1 point per singles win
  });
  return list;
}

function computeClearances() {
  const entries = [];
  for (const week of LEAGUE.weeks) {
    for (const m of week.matches) {
      if (!m.played) continue;
      m.games.forEach((g, gi) => {
        if (g.clearance && LEAGUE.playersById[g.clearance]) {
          entries.push({
            player: LEAGUE.playersById[g.clearance],
            week, match: m, gameIndex: gi,
          });
        }
      });
    }
  }
  return entries;
}
