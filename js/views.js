/* ===================== helpers ===================== */

function fmtDate(iso) {
  if (!iso) return 'TBC';
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d)) return iso;
  const locale = getLang() === 'es' ? 'es-ES' : 'en-US';
  return d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function teamLink(name) {
  const t = LEAGUE.teams.find(t => t.displayName === name);
  const slug = slugify(name);
  return `<a href="${withBase('/teams/' + slug)}" data-link>${escapeHtml(name)}</a>`;
}

function playerLink(id) {
  const p = LEAGUE.playersById[id];
  if (!p) return escapeHtml(id);
  return `<a href="${withBase('/player/' + slugify(p.displayName))}" data-link>${escapeHtml(p.displayName)}</a>`;
}

/** Venue owner may be a player's uniqueID (links to their profile, like Captain does)
 *  or just plain text for someone who isn't a league player. */
function venueOwnerLink(raw) {
  if (!raw) return t('common.dash');
  if (LEAGUE.playersById[raw]) return playerLink(raw);
  return escapeHtml(raw);
}

function matchUrl(homeName, awayName) {
  return withBase(`/match/${slugify(homeName)}-${slugify(awayName)}`);
}

function weekUrl(n) { return withBase(`/week/${n}`); }

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function matchCard(m) {
  const scoreHtml = m.played
    ? `<span class="${m.pointsA > m.pointsB ? 'win' : ''}">${m.pointsA}</span> - <span class="${m.pointsB > m.pointsA ? 'win' : ''}">${m.pointsB}</span>`
    : t('common.vs');
  const statusClass = m.postponed ? 'postponed' : (m.played ? 'played' : 'upcoming');
  const statusText = m.postponed ? t('badge.postponed') : (m.played ? t('badge.played') : t('badge.upcoming'));
  return `
    <div class="match-card">
      <div class="match-teams">
        <span class="team">${teamLink(m.homeTeamName)}</span>
        <span class="match-score mono">${scoreHtml}</span>
        <span class="team right">${teamLink(m.awayTeamName)}</span>
      </div>
      <div class="match-meta">
        <span>${fmtDate(m.date)} · ${t('common.week', { n: m.weekNumber })}</span>
        <span class="badge ${statusClass}">${statusText}</span>
      </div>
      ${m.played ? `<a class="btn btn-ghost" href="${matchUrl(m.homeTeamName, m.awayTeamName)}" data-link>${t('common.match_report')}</a>` : ''}
    </div>
  `;
}

function isTeamActiveThisSeason(team) {
  const season = LEAGUE.config.currentSeason;
  const inActiveList = !Array.isArray(team.activeSeasons) || team.activeSeasons.includes(season);
  return inActiveList && !team.hiddenFromCurrentSeason;
}

/** The season whose roster/stats should be shown on a team's page: the
 *  current season if the team is active in it, otherwise the most recent
 *  season the team was actually active in (per activeSeasons, ordered by
 *  config.seasons). Falls back to the team's players' own seasons data if
 *  activeSeasons isn't set, then finally to the current season. */
function teamDisplaySeason(team) {
  const config = LEAGUE.config;
  if (isTeamActiveThisSeason(team)) return config.currentSeason;

  const candidateSeasons = Array.isArray(team.activeSeasons) && team.activeSeasons.length
    ? team.activeSeasons
    : Array.from(new Set(LEAGUE.players.flatMap(p => Object.entries(p.seasons).filter(([, tid]) => tid === team.id).map(([s]) => s))));

  let mostRecent = null;
  for (const s of config.seasons) { // config.seasons is chronological, oldest first
    if (candidateSeasons.includes(s)) mostRecent = s;
  }
  return mostRecent || config.currentSeason;
}

function visibleTeamStandings() {
  return computeTeamStandings().filter(s => isTeamActiveThisSeason(s.team));
}

function weekLine(m) {
  const scoreHtml = m.played ? `${m.pointsA} - ${m.pointsB}` : t('common.vs');
  return `
    <div class="week-line">
      <span class="wl-team">${teamLink(m.homeTeamName)}</span>
      ${m.postponed ? `<span class="badge postponed">${t('badge.postponed')}</span>` : ''}
      <span class="wl-score mono">${scoreHtml}</span>
      <span class="wl-team wl-team-right">${teamLink(m.awayTeamName)}</span>
      ${m.played ? `<a class="btn btn-ghost btn-sm" href="${matchUrl(m.homeTeamName, m.awayTeamName)}" data-link>${t('common.report')}</a>` : ''}
    </div>
  `;
}

function weekBox(week) {
  return `
    <div class="card week-box">
      <div class="week-box-date">
        <span>${fmtDate(week.date)}</span>
        <span class="badge ${week.played ? 'played' : 'upcoming'}">${week.played ? t('badge.played') : t('badge.upcoming')}</span>
      </div>
      ${week.matches.map(weekLine).join('')}
    </div>
  `;
}

/* ===================== Home ===================== */

function homeView() {
  const weeks = LEAGUE.weeks;
  const pastWeek = [...weeks].reverse().find(w => w.played);
  const nextWeek = weeks.find(w => !w.played);

  const teamStandings = visibleTeamStandings().slice(0, 5);
  const playerStandings = computePlayerStandings()
    .sort((a, b) => b.singlesWon - a.singlesWon || b.winPct - a.winPct || a.player.displayName.localeCompare(b.player.displayName))
    .slice(0, 5);
  const clearances = computeClearances();
  const clearanceBoard = Object.values(
    clearances.reduce((acc, c) => {
      (acc[c.player.id] ||= { player: c.player, entries: [] }).entries.push(c);
      return acc;
    }, {})
  ).sort((a, b) => b.entries.length - a.entries.length).slice(0, 5);

  return `
    <div class="page-header">
      <div class="eyebrow">${escapeHtml(LEAGUE.config.leagueName)}</div>
      <h1>${t('home.title')}</h1>
      <p>${t('home.season_line', { season: escapeHtml(LEAGUE.config.currentSeason) })}</p>
    </div>

    <div class="two-col section">
      <div>
        <div class="section-head"><h2>${t('home.last_week_results')}</h2>${pastWeek ? `<a class="view-all" href="${weekUrl(pastWeek.number)}" data-link>${t('home.week_report_link', { n: pastWeek.number })}</a>` : ''}</div>
        ${pastWeek ? weekBox(pastWeek) : `<div class="empty-state">${t('home.no_results')}</div>`}
      </div>
      <div>
        <div class="section-head"><h2>${t('home.next_week_fixtures')}</h2>${nextWeek ? `<a class="view-all" href="${weekUrl(nextWeek.number)}" data-link>${t('home.week_link', { n: nextWeek.number })}</a>` : ''}</div>
        ${nextWeek ? weekBox(nextWeek) : `<div class="empty-state">${t('home.no_fixtures')}</div>`}
      </div>
    </div>

    <div class="section">
      <div class="section-head"><h2>${t('home.team_rankings')}</h2><a class="view-all" href="${withBase('/ranking/teams')}" data-link>${t('home.full_table')}</a></div>
      ${teamRankTable(teamStandings, false)}
    </div>

    <div class="section">
      <div class="section-head"><h2>${t('home.player_rankings')}</h2><a class="view-all" href="${withBase('/ranking/players')}" data-link>${t('home.full_table')}</a></div>
      ${playerRankTable(playerStandings, false)}
    </div>

    <div class="section">
      <div class="section-head"><h2>${t('home.clearances')}</h2><a class="view-all" href="${withBase('/ranking/clearances')}" data-link>${t('home.full_table')}</a></div>
      ${clearanceBoard.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>${t('table.player')}</th><th class="num">${t('table.clearances_col')}</th><th>${t('table.where')}</th></tr></thead>
        <tbody>
          ${clearanceBoard.map(c => `
            <tr>
              <td>${playerLink(c.player.id)}</td>
              <td class="num clearance-emoji">${c.entries.map(e => `<a href="${matchUrl(e.match.homeTeamName, e.match.awayTeamName)}#game-${e.gameIndex}" data-link title="${t('common.week', { n: e.week.number })}">🎱</a>`).join(' ')}</td>
              <td>${t('table.this_season', { n: c.entries.length })}</td>
            </tr>
          `).join('')}
        </tbody>
      </table></div>` : `<div class="empty-state">${t('home.no_clearances')}</div>`}
    </div>
  `;
}

function teamRankTable(standings, detailed) {
  return `
  <div class="table-wrap"><table>
    <thead><tr>
      <th>${t('table.hash')}</th><th>${t('table.team')}</th>
      <th class="num">${t('table.matches')}</th><th class="num">${t('table.games_won')}</th><th class="num">${t('table.matches_won')}</th>
      ${detailed ? `<th class="num">${t('table.win_pct')}</th><th class="num">${t('table.home_win_pct')}</th><th class="num">${t('table.away_win_pct')}</th>` : ''}
      <th class="num">${t('table.points')}</th>
    </tr></thead>
    <tbody>
      ${standings.map((s, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${teamLink(s.team.displayName)}</td>
          <td class="num">${s.matchesPlayed}</td>
          <td class="num">${s.gamesWon}</td>
          <td class="num">${s.matchesWon}</td>
          ${detailed ? `
            <td class="num">${s.matchesPlayed ? ((s.matchesWon / s.matchesPlayed) * 100).toFixed(0) : 0}%</td>
            <td class="num">${s.homePlayed ? ((s.homeWon / s.homePlayed) * 100).toFixed(0) : 0}%</td>
            <td class="num">${s.awayPlayed ? ((s.awayWon / s.awayPlayed) * 100).toFixed(0) : 0}%</td>
          ` : ''}
          <td class="num"><span class="points-ball">${s.points}</span></td>
        </tr>
      `).join('')}
    </tbody>
  </table></div>`;
}

function playerRankTable(standings, detailed) {
  return `
  <div class="table-wrap"><table>
    <thead><tr>
      <th>${t('table.hash')}</th><th>${t('table.player')}</th><th>${t('table.team')}</th>
      <th class="num">${t('table.games_played')}</th>
      ${detailed ? `<th class="num">${t('table.games_won')}</th><th class="num">${t('table.doubles_played')}</th><th class="num">${t('table.doubles_won')}</th><th class="num">${t('table.doubles_win_pct')}</th><th class="num">${t('table.clearances_col')}</th>` : ''}
      <th class="num">${t('table.win_pct')}</th>
      <th class="num">${t('table.points')}</th>
    </tr></thead>
    <tbody>
      ${standings.map((s, i) => {
        const team = LEAGUE.teamsById[s.player.seasons[LEAGUE.config.currentSeason]];
        return `
        <tr>
          <td>${i + 1}</td>
          <td>${playerLink(s.player.id)}</td>
          <td>${team ? teamLink(team.displayName) : t('common.dash')}</td>
          <td class="num">${s.singlesPlayed}</td>
          ${detailed ? `
            <td class="num">${s.singlesWon}</td>
            <td class="num">${s.doublesPlayed}</td>
            <td class="num">${s.doublesWon}</td>
            <td class="num">${s.doublesWinPct.toFixed(0)}%</td>
            <td class="num">${s.clearances}</td>
          ` : ''}
          <td class="num">${s.winPct.toFixed(0)}%</td>
          <td class="num"><span class="points-ball">${s.totalPoints}</span></td>
        </tr>
      `;}).join('')}
    </tbody>
  </table></div>`;
}

function teamRosterTable(standings) {
  return `
  <div class="table-wrap"><table>
    <thead><tr>
      <th>${t('table.player')}</th>
      <th class="num">${t('table.games_played')}</th>
      <th class="num">${t('table.games_won')}</th>
      <th class="num">${t('table.win_pct')}</th>
      <th class="num">${t('table.points')}</th>
    </tr></thead>
    <tbody>
      ${standings.map(s => `
        <tr>
          <td>${playerLink(s.player.id)}</td>
          <td class="num">${s.singlesPlayed}</td>
          <td class="num">${s.singlesWon}</td>
          <td class="num">${s.winPct.toFixed(0)}%</td>
          <td class="num"><span class="points-ball">${s.totalPoints}</span></td>
        </tr>
      `).join('')}
    </tbody>
  </table></div>`;
}

/* ===================== Fixtures ===================== */

function fixturesView() {
  const weeks = LEAGUE.weeks;
  return `
    <div class="page-header">
      <div class="eyebrow">${t('fixtures.eyebrow')}</div>
      <h1>${t('fixtures.title')}</h1>
      <p>${t('fixtures.subtitle')}</p>
    </div>
    ${weeks.length === 0 ? `<div class="empty-state">${t('fixtures.none')}</div>` : weeks.map(w => `
      <div class="section">
        <div class="section-head">
          <h2><a href="${weekUrl(w.number)}" data-link>${t('common.week', { n: w.number })}</a> · ${fmtDate(w.date)}</h2>
          <span class="badge ${w.played ? 'played' : 'upcoming'}">${w.played ? t('badge.played') : t('badge.upcoming')}</span>
        </div>
        <div class="card-grid">${w.matches.map(matchCard).join('')}</div>
      </div>
    `).join('')}
  `;
}

/* ===================== Week page ===================== */

function weekView(number) {
  const week = LEAGUE.weeks.find(w => w.number === number);
  if (!week) return notFoundView();
  return `
    <div class="page-header">
      <div class="eyebrow">${t('common.week', { n: week.number })}</div>
      <h1>${fmtDate(week.date)}</h1>
      <p>${week.played ? t('week.matches_played', { n: week.matches.length }) : t('week.matches_scheduled', { n: week.matches.length })}</p>
    </div>
    ${week.matches.map(m => matchReportBlock(m)).join('<hr style="border:none;border-top:1px solid var(--border);margin:32px 0;">')}
  `;
}

function matchReportBlock(m, opts = {}) {
  const showFullLink = opts.showFullLink !== false;
  if (!m.played) {
    return `
      <div class="card">
        <div class="match-teams">
          <span class="team">${teamLink(m.homeTeamName)}</span>
          <span class="match-score mono">${t('common.vs')}</span>
          <span class="team right">${teamLink(m.awayTeamName)}</span>
        </div>
        <p class="profile-sub" style="margin-top:10px;">${m.postponed ? t('week.postponed') : t('week.not_played_yet')}</p>
      </div>
    `;
  }
  const singles = m.games.filter(g => g.type === 'SINGLES');
  const doubles = m.games.filter(g => g.type === 'DOUBLES');

  return `
    <div class="card">
      <div class="match-teams">
        <span class="team">${teamLink(m.homeTeamName)}</span>
        <span class="match-score mono">${m.pointsA} - ${m.pointsB}</span>
        <span class="team right">${teamLink(m.awayTeamName)}</span>
      </div>
      <p class="profile-sub" style="margin:4px 0 18px;">${t('week.score_summary', { a: m.scoreA, b: m.scoreB, team: m.pointsA > m.pointsB ? escapeHtml(m.homeTeamName) : escapeHtml(m.awayTeamName) })}</p>

      <h3>${t('common.singles')}</h3>
      ${singles.map((g) => gameRow(g, m.games.indexOf(g))).join('')}
      <h3 style="margin-top:20px;">${t('common.doubles')}</h3>
      ${doubles.map((g) => gameRow(g, m.games.indexOf(g))).join('')}

      ${showFullLink ? `<p style="margin-top:18px;"><a href="${matchUrl(m.homeTeamName, m.awayTeamName)}" data-link>${t('common.full_match_page')}</a></p>` : ''}
    </div>
  `;
}

function gameRow(g, index) {
  const aWon = g.scoreA > g.scoreB;
  const sideA = g.sideA.map(playerLink).join(' & ');
  const sideB = g.sideB.map(playerLink).join(' & ');
  const clearanceOnA = g.clearance && g.sideA.includes(g.clearance);
  const clearanceOnB = g.clearance && g.sideB.includes(g.clearance);
  const clearanceMark = ` <span class="clearance-emoji" title="Clearance">🎱</span>`;
  return `
    <div class="game-row" id="game-${index}">
      <div class="game-side game-side-a">${clearanceOnA ? clearanceMark : ''}<span class="name ${aWon ? 'won' : ''}">${sideA}</span></div>
      <div class="game-score mono">${g.scoreA} - ${g.scoreB}</div>
      <div class="game-side game-side-b"><span class="name ${!aWon ? 'won' : ''}">${sideB}</span>${clearanceOnB ? clearanceMark : ''}</div>
    </div>
  `;
}

/* ===================== Individual match page ===================== */

function matchView(pairSlug) {
  const pair = splitTeamPairSlug(pairSlug);
  if (!pair) return notFoundView();
  const m = findMatchByTeamSlugs(pair[0], pair[1]);
  if (!m) return notFoundView();
  return `
    <div class="page-header">
      <div class="eyebrow">${t('match.report_eyebrow', { week: t('common.week', { n: m.weekNumber }) })}</div>
      <h1>${escapeHtml(m.homeTeamName)} ${t('common.vs')} ${escapeHtml(m.awayTeamName)}</h1>
      <p>${fmtDate(m.date)}</p>
    </div>
    ${matchReportBlock(m, { showFullLink: false })}
  `;
}

/* ===================== Teams list / team page ===================== */

function teamsListView() {
  const standings = visibleTeamStandings();
  return `
    <div class="page-header">
      <div class="eyebrow">${t('teams.eyebrow')}</div>
      <h1>${t('teams.title')}</h1>
      <p>${t('teams.subtitle')}</p>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>${t('table.hash')}</th><th>${t('table.team')}</th><th>${t('table.venue')}</th><th class="num">${t('table.points')}</th></tr></thead>
      <tbody>
        ${standings.map((s, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${teamLink(s.team.displayName)}</td>
            <td>${escapeHtml(s.team.venue)}</td>
            <td class="num"><span class="points-ball">${s.points}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table></div>
  `;
}

function teamView(slug) {
  const team = teamBySlug(slug);
  if (!team) return notFoundView();
  const season = teamDisplaySeason(team);
  const isCurrent = season === LEAGUE.config.currentSeason;
  const roster = LEAGUE.players.filter(p => p.seasons[season] === team.id);
  const playerStats = computePlayerStandings();
  const rosterWithStats = roster
    .map(p => playerStats.find(s => s.player.id === p.id))
    .filter(Boolean)
    .sort((a, b) => b.singlesWon - a.singlesWon);

  const teamStanding = computeTeamStandings().find(s => s.team.id === team.id);

  const allMatches = LEAGUE.weeks.flatMap(w => w.matches)
    .filter(m => m.homeTeamName === team.displayName || m.awayTeamName === team.displayName);
  const recentMatches = allMatches.filter(m => m.played).slice(-3).reverse();
  const nextMatch = allMatches.find(m => !m.played);

  return `
    <div class="page-header team-header">
      ${team.image ? `<img class="team-photo" src="${escapeHtml(team.image)}" alt="${escapeHtml(team.displayName)}">` : ''}
      <div>
        <div class="eyebrow">${t('team.eyebrow')}</div>
        <h1>${escapeHtml(team.displayName)}</h1>
        <p>${escapeHtml(team.info || '')}</p>
      </div>
    </div>

    <div class="two-col section">
      <div class="card">
        <h3>${t('team.venue')}</h3>
        <p>${escapeHtml(team.venue)}<br>${escapeHtml(team.address)}</p>
        <h3 style="margin-top:16px;">${t('team.venue_owner')}</h3>
        <p>${venueOwnerLink(team.venueOwner)}</p>
      </div>
      <div class="card">
        <h3>${t('team.captain')}</h3>
        <p>${team.captain ? playerLink(team.captain) : t('common.dash')}</p>
        <h3 style="margin-top:16px;">${t('team.season')}</h3>
        <p>${escapeHtml(season)}${isCurrent ? '' : ` <span class="badge upcoming">${t('team.not_active')}</span>`}</p>
      </div>
    </div>

    ${teamStanding ? `
    <div class="section">
      <div class="section-head"><h2>${t('team.season_stats')}</h2></div>
      <div class="stat-row">
        <div class="stat-pill"><span class="num">${teamStanding.matchesPlayed}</span><span class="label">${t('team.matches_played')}</span></div>
        <div class="stat-pill"><span class="num">${teamStanding.matchesWon}</span><span class="label">${t('team.matches_won')}</span></div>
        <div class="stat-pill"><span class="num">${teamStanding.gamesWon}</span><span class="label">${t('team.games_won')}</span></div>
        <div class="stat-pill"><span class="num">${teamStanding.gamesPlayed ? ((teamStanding.gamesWon / teamStanding.gamesPlayed) * 100).toFixed(0) : 0}%</span><span class="label">${t('team.game_win_pct')}</span></div>
        <div class="stat-pill"><span class="num">${teamStanding.homePlayed ? ((teamStanding.homeWon / teamStanding.homePlayed) * 100).toFixed(0) : 0}%</span><span class="label">${t('team.home_win_pct')}</span></div>
        <div class="stat-pill"><span class="num">${teamStanding.awayPlayed ? ((teamStanding.awayWon / teamStanding.awayPlayed) * 100).toFixed(0) : 0}%</span><span class="label">${t('team.away_win_pct')}</span></div>
        <div class="stat-pill"><span class="num">${teamStanding.points}</span><span class="label">${t('team.total_points')}</span></div>
      </div>
    </div>` : ''}

    <div class="two-col section">
      <div>
        <div class="section-head"><h2>${t('team.recent_matches')}</h2></div>
        ${recentMatches.length ? `<div class="card-grid">${recentMatches.map(matchCard).join('')}</div>` : `<div class="empty-state">${t('team.no_matches_played')}</div>`}
      </div>
      <div>
        <div class="section-head"><h2>${t('team.next_match')}</h2></div>
        ${nextMatch ? `<div class="card-grid">${matchCard(nextMatch)}</div>` : `<div class="empty-state">${t('team.no_upcoming_match')}</div>`}
      </div>
    </div>

    <div class="section">
      <div class="section-head"><h2>${t('team.roster')}</h2>${isCurrent ? '' : `<span class="view-all">${t('team.roster_from', { season: escapeHtml(season) })}</span>`}</div>
      ${teamRosterTable(rosterWithStats)}
    </div>
  `;
}

/* ===================== Player page ===================== */

function playerView(slug) {
  const player = playerBySlug(slug);
  if (!player) return notFoundView();
  const stats = computePlayerStandings().find(s => s.player.id === player.id);
  const season = LEAGUE.config.currentSeason;
  const currentTeamId = player.seasons[season];
  const currentTeam = currentTeamId ? LEAGUE.teamsById[currentTeamId] : null;
  const pastSeasons = Object.entries(player.seasons).filter(([s]) => s !== season);

  const initials = player.displayName.split(' ').map(n => n[0]).slice(0, 2).join('');
  const avatarHtml = player.photo
    ? `<img class="avatar avatar-photo" src="${escapeHtml(player.photo)}" alt="${escapeHtml(player.displayName)}">`
    : `<div class="avatar">${escapeHtml(initials)}</div>`;

  return `
    <div class="profile-head">
      ${avatarHtml}
      <div>
        <h1>${escapeHtml(player.displayName)}</h1>
        <div class="profile-sub">${currentTeam ? t('player.currently_playing_for', { team: teamLink(currentTeam.displayName) }) : t('player.not_rostered')}</div>
      </div>
    </div>

    ${player.bio ? `<p class="prose">${escapeHtml(player.bio)}</p>` : ''}
    ${player.contact ? `<p class="profile-sub">${t('player.contact', { contact: escapeHtml(player.contact) })}</p>` : ''}

    <div class="stat-row">
      <div class="stat-pill"><span class="num">${stats ? stats.singlesPlayed : 0}</span><span class="label">${t('player.games_played')}</span></div>
      <div class="stat-pill"><span class="num">${stats ? stats.singlesWon : 0}</span><span class="label">${t('player.games_won')}</span></div>
      <div class="stat-pill"><span class="num">${stats ? stats.winPct.toFixed(0) : 0}%</span><span class="label">${t('player.games_win_pct')}</span></div>
      <div class="stat-pill"><span class="num">${stats ? stats.doublesPlayed : 0}</span><span class="label">${t('player.doubles_games_played')}</span></div>
      <div class="stat-pill"><span class="num">${stats ? stats.doublesWon : 0}</span><span class="label">${t('player.doubles_games_won')}</span></div>
      <div class="stat-pill"><span class="num">${stats ? stats.doublesWinPct.toFixed(0) : 0}%</span><span class="label">${t('player.doubles_win_pct')}</span></div>
      <div class="stat-pill"><span class="num">${stats ? stats.clearances : 0}</span><span class="label">${t('player.clearances_count')}</span></div>
    </div>

    ${pastSeasons.length ? `
    <div class="section">
      <h2>${t('player.past_teams')}</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>${t('player.season_col')}</th><th>${t('player.team_col')}</th></tr></thead>
        <tbody>
          ${pastSeasons.map(([s, teamId]) => `<tr><td>${escapeHtml(s)}</td><td>${teamId && LEAGUE.teamsById[teamId] ? teamLink(LEAGUE.teamsById[teamId].displayName) : t('common.dash')}</td></tr>`).join('')}
        </tbody>
      </table></div>
    </div>` : ''}
  `;
}

/* ===================== Ranking detail pages ===================== */

function rankingTeamsView() {
  const standings = visibleTeamStandings();
  return `
    <div class="page-header"><div class="eyebrow">${t('ranking.full_table')}</div><h1>${t('ranking.team_rankings')}</h1></div>
    ${teamRankTable(standings, true)}
  `;
}

function rankingPlayersView() {
  const standings = computePlayerStandings()
    .sort((a, b) => b.singlesWon - a.singlesWon || b.winPct - a.winPct || a.player.displayName.localeCompare(b.player.displayName));
  return `
    <div class="page-header"><div class="eyebrow">${t('ranking.full_table')}</div><h1>${t('ranking.player_rankings')}</h1></div>
    ${playerRankTable(standings, true)}
  `;
}

function rankingClearancesView() {
  const clearances = computeClearances();
  const board = Object.values(
    clearances.reduce((acc, c) => {
      (acc[c.player.id] ||= { player: c.player, entries: [] }).entries.push(c);
      return acc;
    }, {})
  ).sort((a, b) => b.entries.length - a.entries.length || a.player.displayName.localeCompare(b.player.displayName));

  return `
    <div class="page-header"><div class="eyebrow">${t('ranking.full_table')}</div><h1>${t('ranking.clearances_title')}</h1></div>
    ${board.length ? `
    <div class="table-wrap"><table>
      <thead><tr><th>${t('table.hash')}</th><th>${t('table.player')}</th><th class="num">${t('ranking.total')}</th><th>${t('ranking.games')}</th></tr></thead>
      <tbody>
        ${board.map((c, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${playerLink(c.player.id)}</td>
            <td class="num">${c.entries.length}</td>
            <td class="clearance-emoji">${c.entries.map(e => `<a href="${matchUrl(e.match.homeTeamName, e.match.awayTeamName)}#game-${e.gameIndex}" data-link title="${t('common.week', { n: e.week.number })}">🎱</a>`).join(' ')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table></div>` : `<div class="empty-state">${t('home.no_clearances')}</div>`}
  `;
}

/* ===================== Static pages ===================== */

function rulesView() {
  return `
    <div class="page-header"><div class="eyebrow">${t('rules.eyebrow')}</div><h1>${t('rules.title')}</h1></div>
    <div class="prose">
      <p>${t('rules.placeholder')}</p>
      <h2>${t('rules.match_format')}</h2>
      <ul>
        <li>${t('rules.rule1')}</li>
        <li>${t('rules.rule2')}</li>
        <li>${t('rules.rule3')}</li>
      </ul>
    </div>
  `;
}

function noticeView() {
  return `
    <div class="page-header"><div class="eyebrow">${t('notice.eyebrow')}</div><h1>${t('notice.title')}</h1></div>
    <div class="prose">
      <p>${escapeHtml(LEAGUE.config.disclaimer)} ${t('notice.independent_note')}</p>
      <p>${t('notice.errors_note')}</p>
    </div>
  `;
}
