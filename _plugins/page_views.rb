module PageViews
  V = ViewHelpers

  def self.visible_team_standings(data)
    season = data['season']
    data['teamStandings'].select { |s| LeagueData.team_active_this_season?(s['team'], season) }
  end

  def self.home(data, site)
    weeks = data['weeks']
    past_week = weeks.select { |w| w['played'] }.last
    next_week = weeks.find { |w| !w['played'] }

    team_standings = visible_team_standings(data).first(5)
    player_standings = data['playerStandings'].first(5)

    clearance_groups = {}
    order = []
    data['clearances'].each do |c|
      pid = c['player']['id']
      unless clearance_groups[pid]
        clearance_groups[pid] = { 'player' => c['player'], 'entries' => [] }
        order << pid
      end
      clearance_groups[pid]['entries'] << c
    end
    clearance_board = order.map { |pid| clearance_groups[pid] }
                            .sort_by { |g| -g['entries'].length }
                            .first(5)

    past_week_html = past_week ? V.week_box(data, site, past_week) : "<div class=\"empty-state\">#{V.i18n('home.no_results', 'No results yet this season.')}</div>"
    past_week_link = past_week ? "<a class=\"view-all\" href=\"#{V.week_url(site, past_week['number'])}\">#{V.i18n('home.week_report_link', "Week #{past_week['number']} report &rarr;", { 'n' => past_week['number'] })}</a>" : ''

    next_week_html = next_week ? V.week_box(data, site, next_week) : "<div class=\"empty-state\">#{V.i18n('home.no_fixtures', 'No fixtures scheduled yet.')}</div>"
    next_week_link = next_week ? "<a class=\"view-all\" href=\"#{V.week_url(site, next_week['number'])}\">#{V.i18n('home.week_link', "Week #{next_week['number']} &rarr;", { 'n' => next_week['number'] })}</a>" : ''

    clearance_rows = clearance_board.map do |c|
      links = c['entries'].map do |e|
        url = "#{V.match_url(site, e['match']['homeTeamName'], e['match']['awayTeamName'])}#game-#{e['gameIndex']}"
        "<a href=\"#{url}\" title=\"Week #{e['week']['number']}\">\u{1F3B1}</a>"
      end.join(' ')
      <<~HTML
        <tr>
          <td>#{V.player_link(data, site, c['player']['id'])}</td>
          <td class="num clearance-emoji">#{links}</td>
          <td>#{V.i18n('table.this_season', "#{c['entries'].length} this season", { 'n' => c['entries'].length })}</td>
        </tr>
      HTML
    end.join

    clearances_html = clearance_board.empty? ? "<div class=\"empty-state\">#{V.i18n('home.no_clearances', 'No clearances recorded yet.')}</div>" : <<~HTML
      <div class="table-wrap"><table>
        <thead><tr><th>#{V.i18n('table.player', 'Player')}</th><th class="num">#{V.i18n('table.clearances_col', 'Clearances')}</th><th>#{V.i18n('table.where', 'Where')}</th></tr></thead>
        <tbody>#{clearance_rows}</tbody>
      </table></div>
    HTML

    <<~HTML
      <div class="page-header">
        <div class="eyebrow">#{V.esc(data['config']['leagueName'])}</div>
        <h1>#{V.i18n('home.title', 'Home')}</h1>
        <p>#{V.i18n('home.season_line', "Season #{V.esc(data['season'])}", { 'season' => V.esc(data['season']) })}</p>
      </div>

      <div class="two-col section">
        <div>
          <div class="section-head"><h2>#{V.i18n('home.last_week_results', "Last week's results")}</h2>#{past_week_link}</div>
          #{past_week_html}
        </div>
        <div>
          <div class="section-head"><h2>#{V.i18n('home.next_week_fixtures', "Next week's fixtures")}</h2>#{next_week_link}</div>
          #{next_week_html}
        </div>
      </div>

      <div class="section">
        <div class="section-head"><h2>#{V.i18n('home.team_rankings', 'Team rankings')}</h2><a class="view-all" href="#{V.base_url(site, '/ranking/teams/')}">#{V.i18n('home.full_table', 'Full table &rarr;')}</a></div>
        #{V.team_rank_table(data, site, team_standings, false)}
      </div>

      <div class="section">
        <div class="section-head"><h2>#{V.i18n('home.player_rankings', 'Player rankings')}</h2><a class="view-all" href="#{V.base_url(site, '/ranking/players/')}">#{V.i18n('home.full_table', 'Full table &rarr;')}</a></div>
        #{V.player_rank_table(data, site, player_standings, false)}
      </div>

      <div class="section">
        <div class="section-head"><h2>#{V.i18n('home.clearances', 'Clearances')}</h2><a class="view-all" href="#{V.base_url(site, '/ranking/clearances/')}">#{V.i18n('home.full_table', 'Full table &rarr;')}</a></div>
        #{clearances_html}
      </div>
    HTML
  end

  def self.fixtures(data, site)
    weeks = data['weeks']
    if weeks.empty?
      body = "<div class=\"empty-state\">#{V.i18n('fixtures.none', 'No fixtures published yet.')}</div>"
    else
      body = weeks.map do |w|
        status_class = w['played'] ? 'played' : 'upcoming'
        status_text = w['played'] ? V.i18n('badge.played', 'Played') : V.i18n('badge.upcoming', 'Upcoming')
        cards = w['matches'].map { |m| V.match_card(data, site, m) }.join
        <<~HTML
          <div class="section">
            <div class="section-head">
              <h2><a href="#{V.week_url(site, w['number'])}">#{V.i18n('common.week', "Week #{w['number']}", { 'n' => w['number'] })}</a> &middot; #{V.fmt_date(w['date'])}</h2>
              <span class="badge #{status_class}">#{status_text}</span>
            </div>
            <div class="card-grid">#{cards}</div>
          </div>
        HTML
      end.join
    end

    <<~HTML
      <div class="page-header">
        <div class="eyebrow">#{V.i18n('fixtures.eyebrow', 'Schedule')}</div>
        <h1>#{V.i18n('fixtures.title', 'Fixtures')}</h1>
        <p>#{V.i18n('fixtures.subtitle', 'Every match this season, in order.')}</p>
      </div>
      #{body}
    HTML
  end

  def self.week(data, site, w)
    blocks = w['matches'].map { |m| V.match_report_block(data, site, m, true) }
    divider = '<hr style="border:none;border-top:1px solid var(--border);margin:32px 0;">'
    subtitle = w['played'] ? V.i18n('week.matches_played', "#{w['matches'].length} matches played.", { 'n' => w['matches'].length }) : V.i18n('week.matches_scheduled', "#{w['matches'].length} matches scheduled.", { 'n' => w['matches'].length })

    <<~HTML
      <div class="page-header">
        <div class="eyebrow">#{V.i18n('common.week', "Week #{w['number']}", { 'n' => w['number'] })}</div>
        <h1>#{V.fmt_date(w['date'])}</h1>
        <p>#{subtitle}</p>
      </div>
      #{blocks.join(divider)}
    HTML
  end

  def self.match(data, site, m)
    <<~HTML
      <div class="page-header">
        <div class="eyebrow">#{V.i18n('match.report_eyebrow', "Match report &middot; Week #{m['weekNumber']}", { 'week' => "Week #{m['weekNumber']}" })}</div>
        <h1>#{V.esc(m['homeTeamName'])} #{V.i18n('common.vs', 'vs')} #{V.esc(m['awayTeamName'])}</h1>
        <p>#{V.fmt_date(m['date'])}</p>
      </div>
      #{V.match_report_block(data, site, m, false)}
    HTML
  end

  def self.teams_list(data, site)
    standings = visible_team_standings(data)
    rows = standings.each_with_index.map do |s, i|
      <<~HTML
        <tr>
          <td>#{i + 1}</td>
          <td>#{V.team_link(data, site, s['team']['displayName'])}</td>
          <td>#{V.esc(s['team']['venue'])}</td>
          <td class="num"><span class="points-ball">#{s['points']}</span></td>
        </tr>
      HTML
    end.join

    <<~HTML
      <div class="page-header">
        <div class="eyebrow">#{V.i18n('teams.eyebrow', 'The League')}</div>
        <h1>#{V.i18n('teams.title', 'Teams')}</h1>
        <p>#{V.i18n('teams.subtitle', 'Ordered by current season points.')}</p>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>#{V.i18n('table.hash', '#')}</th><th>#{V.i18n('table.team', 'Team')}</th><th>#{V.i18n('table.venue', 'Venue')}</th><th class="num">#{V.i18n('table.points', 'Points')}</th></tr></thead>
        <tbody>#{rows}</tbody>
      </table></div>
    HTML
  end

  def self.team(data, site, tm)
    season = LeagueData.team_display_season(tm, data['players'], data['config'])
    is_current = season == data['config']['currentSeason']
    roster = LeagueData.roster_for_team(data['players'], tm, season)

    roster_stats = roster.map { |p| data['playerStandings'].find { |s| s['player']['id'] == p['id'] } }
                          .compact
                          .sort_by { |s| -s['singlesWon'] }

    team_standing = data['teamStandings'].find { |s| s['team']['id'] == tm['id'] }

    all_matches = data['weeks'].flat_map { |w| w['matches'] }
                                .select { |m| m['homeTeamName'] == tm['displayName'] || m['awayTeamName'] == tm['displayName'] }
    recent_matches = all_matches.select { |m| m['played'] }.last(3).reverse
    next_match = all_matches.find { |m| !m['played'] }

    image_html = (tm['image'] && !tm['image'].to_s.strip.empty?) ? "<img class=\"team-photo\" src=\"#{V.esc(tm['image'])}\" alt=\"#{V.esc(tm['displayName'])}\">" : ''
    not_active_badge = is_current ? '' : " <span class=\"badge upcoming\">#{V.i18n('team.not_active', 'Not active this season')}</span>"

    stats_block = ''
    if team_standing
      game_pct = team_standing['gamesPlayed'] > 0 ? ((team_standing['gamesWon'].to_f / team_standing['gamesPlayed']) * 100).round : 0
      home_pct = team_standing['homePlayed'] > 0 ? ((team_standing['homeWon'].to_f / team_standing['homePlayed']) * 100).round : 0
      away_pct = team_standing['awayPlayed'] > 0 ? ((team_standing['awayWon'].to_f / team_standing['awayPlayed']) * 100).round : 0
      stats_block = <<~HTML
        <div class="section">
          <div class="section-head"><h2>#{V.i18n('team.season_stats', 'Season stats')}</h2></div>
          <div class="stat-row">
            <div class="stat-pill"><span class="num">#{team_standing['matchesPlayed']}</span><span class="label">#{V.i18n('team.matches_played', 'Matches played')}</span></div>
            <div class="stat-pill"><span class="num">#{team_standing['matchesWon']}</span><span class="label">#{V.i18n('team.matches_won', 'Matches won')}</span></div>
            <div class="stat-pill"><span class="num">#{team_standing['gamesWon']}</span><span class="label">#{V.i18n('team.games_won', 'Games won')}</span></div>
            <div class="stat-pill"><span class="num">#{game_pct}%</span><span class="label">#{V.i18n('team.game_win_pct', 'Game win %')}</span></div>
            <div class="stat-pill"><span class="num">#{home_pct}%</span><span class="label">#{V.i18n('team.home_win_pct', 'Home win %')}</span></div>
            <div class="stat-pill"><span class="num">#{away_pct}%</span><span class="label">#{V.i18n('team.away_win_pct', 'Away win %')}</span></div>
            <div class="stat-pill"><span class="num">#{team_standing['points']}</span><span class="label">#{V.i18n('team.total_points', 'Total points')}</span></div>
          </div>
        </div>
      HTML
    end

    recent_html = recent_matches.empty? ? "<div class=\"empty-state\">#{V.i18n('team.no_matches_played', 'No matches played yet.')}</div>" : "<div class=\"card-grid\">#{recent_matches.map { |m| V.match_card(data, site, m) }.join}</div>"
    next_html = next_match ? "<div class=\"card-grid\">#{V.match_card(data, site, next_match)}</div>" : "<div class=\"empty-state\">#{V.i18n('team.no_upcoming_match', 'No upcoming match scheduled.')}</div>"
    roster_from = is_current ? '' : "<span class=\"view-all\">#{V.i18n('team.roster_from', "From #{V.esc(season)}", { 'season' => V.esc(season) })}</span>"

    <<~HTML
      <div class="page-header team-header">
        #{image_html}
        <div>
          <div class="eyebrow">#{V.i18n('team.eyebrow', 'Team')}</div>
          <h1>#{V.esc(tm['displayName'])}</h1>
          <p>#{V.esc(tm['info'].to_s)}</p>
        </div>
      </div>

      <div class="two-col section">
        <div class="card">
          <h3>#{V.i18n('team.venue', 'Venue')}</h3>
          <p>#{V.esc(tm['venue'])}<br>#{V.esc(tm['address'])}</p>
          <h3 style="margin-top:16px;">#{V.i18n('team.venue_owner', 'Venue owner')}</h3>
          <p>#{V.venue_owner_link(data, site, tm['venueOwner'])}</p>
        </div>
        <div class="card">
          <h3>#{V.i18n('team.captain', 'Captain')}</h3>
          <p>#{tm['captain'] ? V.player_link(data, site, tm['captain']) : V.i18n('common.dash', '&mdash;')}</p>
          <h3 style="margin-top:16px;">#{V.i18n('team.season', 'Season')}</h3>
          <p>#{V.esc(season)}#{not_active_badge}</p>
        </div>
      </div>

      #{stats_block}

      <div class="two-col section">
        <div>
          <div class="section-head"><h2>#{V.i18n('team.recent_matches', 'Recent matches')}</h2></div>
          #{recent_html}
        </div>
        <div>
          <div class="section-head"><h2>#{V.i18n('team.next_match', 'Next match')}</h2></div>
          #{next_html}
        </div>
      </div>

      <div class="section">
        <div class="section-head"><h2>#{V.i18n('team.roster', 'Roster')}</h2>#{roster_from}</div>
        #{V.team_roster_table(data, site, roster_stats)}
      </div>
    HTML
  end

  def self.player(data, site, pl)
    stats = data['playerStandings'].find { |s| s['player']['id'] == pl['id'] }
    season = data['config']['currentSeason']
    current_team_id = (pl['seasons'] || {})[season]
    current_team = current_team_id ? data['teamsById'][current_team_id] : nil
    past_seasons = (pl['seasons'] || {}).reject { |s, _| s == season }

    initials = pl['displayName'].to_s.split(/\s+/).map { |w| w[0] }.compact.first(2).join

    if pl['photo'] && !pl['photo'].to_s.strip.empty?
      avatar_html = "<img class=\"avatar avatar-photo\" src=\"#{V.esc(pl['photo'])}\" alt=\"#{V.esc(pl['displayName'])}\">"
    else
      avatar_html = "<div class=\"avatar\">#{V.esc(initials)}</div>"
    end

    sub_line = current_team ? V.i18n('player.currently_playing_for_prefix', 'Currently playing for') + ' ' + V.team_link(data, site, current_team['displayName']) : V.i18n('player.not_rostered', 'Not currently rostered')

    bio_html = (pl['bio'] && !pl['bio'].to_s.strip.empty?) ? "<p class=\"prose\">#{V.esc(pl['bio'])}</p>" : ''
    contact_html = (pl['contact'] && !pl['contact'].to_s.strip.empty?) ? "<p class=\"profile-sub\">#{V.i18n('player.contact', "Contact: #{V.esc(pl['contact'])}", { 'contact' => V.esc(pl['contact']) })}</p>" : ''

    singles_played = stats ? stats['singlesPlayed'] : 0
    singles_won = stats ? stats['singlesWon'] : 0
    win_pct = stats ? stats['winPct'].round : 0
    doubles_played = stats ? stats['doublesPlayed'] : 0
    doubles_won = stats ? stats['doublesWon'] : 0
    doubles_win_pct = stats ? stats['doublesWinPct'].round : 0
    clearances = stats ? stats['clearances'] : 0

    past_html = ''
    unless past_seasons.empty?
      rows = past_seasons.map do |s, team_id|
        tm = team_id ? data['teamsById'][team_id] : nil
        cell = tm ? V.team_link(data, site, tm['displayName']) : V.i18n('common.dash', '&mdash;')
        "<tr><td>#{V.esc(s)}</td><td>#{cell}</td></tr>"
      end.join
      past_html = <<~HTML
        <div class="section">
          <h2>#{V.i18n('player.past_teams', 'Past teams')}</h2>
          <div class="table-wrap"><table>
            <thead><tr><th>#{V.i18n('player.season_col', 'Season')}</th><th>#{V.i18n('player.team_col', 'Team')}</th></tr></thead>
            <tbody>#{rows}</tbody>
          </table></div>
        </div>
      HTML
    end

    <<~HTML
      <div class="profile-head">
        #{avatar_html}
        <div>
          <h1>#{V.esc(pl['displayName'])}</h1>
          <div class="profile-sub">#{sub_line}</div>
        </div>
      </div>

      #{bio_html}
      #{contact_html}

      <div class="stat-row">
        <div class="stat-pill"><span class="num">#{singles_played}</span><span class="label">#{V.i18n('player.games_played', 'Games played')}</span></div>
        <div class="stat-pill"><span class="num">#{singles_won}</span><span class="label">#{V.i18n('player.games_won', 'Games won')}</span></div>
        <div class="stat-pill"><span class="num">#{win_pct}%</span><span class="label">#{V.i18n('player.games_win_pct', 'Games win %')}</span></div>
        <div class="stat-pill"><span class="num">#{doubles_played}</span><span class="label">#{V.i18n('player.doubles_games_played', 'Doubles games played')}</span></div>
        <div class="stat-pill"><span class="num">#{doubles_won}</span><span class="label">#{V.i18n('player.doubles_games_won', 'Doubles games won')}</span></div>
        <div class="stat-pill"><span class="num">#{doubles_win_pct}%</span><span class="label">#{V.i18n('player.doubles_win_pct', 'Doubles win %')}</span></div>
        <div class="stat-pill"><span class="num">#{clearances}</span><span class="label">#{V.i18n('player.clearances_count', '# of clearances')}</span></div>
      </div>

      #{past_html}
    HTML
  end

  def self.ranking_teams(data, site)
    <<~HTML
      <div class="page-header"><div class="eyebrow">#{V.i18n('ranking.full_table', 'Full table')}</div><h1>#{V.i18n('ranking.team_rankings', 'Team rankings')}</h1></div>
      #{V.team_rank_table(data, site, visible_team_standings(data), true)}
    HTML
  end

  def self.ranking_players(data, site)
    <<~HTML
      <div class="page-header"><div class="eyebrow">#{V.i18n('ranking.full_table', 'Full table')}</div><h1>#{V.i18n('ranking.player_rankings', 'Player rankings')}</h1></div>
      #{V.player_rank_table(data, site, data['playerStandings'], true)}
    HTML
  end

  def self.ranking_clearances(data, site)
    groups = {}
    order = []
    data['clearances'].each do |c|
      pid = c['player']['id']
      unless groups[pid]
        groups[pid] = { 'player' => c['player'], 'entries' => [] }
        order << pid
      end
      groups[pid]['entries'] << c
    end
    board = order.map { |pid| groups[pid] }
                 .sort_by { |g| [-g['entries'].length, g['player']['displayName']] }

    if board.empty?
      body = "<div class=\"empty-state\">#{V.i18n('home.no_clearances', 'No clearances recorded yet.')}</div>"
    else
      rows = board.each_with_index.map do |c, i|
        links = c['entries'].map do |e|
          url = "#{V.match_url(site, e['match']['homeTeamName'], e['match']['awayTeamName'])}#game-#{e['gameIndex']}"
          "<a href=\"#{url}\" title=\"Week #{e['week']['number']}\">\u{1F3B1}</a>"
        end.join(' ')
        <<~HTML
          <tr>
            <td>#{i + 1}</td>
            <td>#{V.player_link(data, site, c['player']['id'])}</td>
            <td class="num">#{c['entries'].length}</td>
            <td class="clearance-emoji">#{links}</td>
          </tr>
        HTML
      end.join
      body = <<~HTML
        <div class="table-wrap"><table>
          <thead><tr><th>#{V.i18n('table.hash', '#')}</th><th>#{V.i18n('table.player', 'Player')}</th><th class="num">#{V.i18n('ranking.total', 'Total')}</th><th>#{V.i18n('ranking.games', 'Games')}</th></tr></thead>
          <tbody>#{rows}</tbody>
        </table></div>
      HTML
    end

    <<~HTML
      <div class="page-header"><div class="eyebrow">#{V.i18n('ranking.full_table', 'Full table')}</div><h1>#{V.i18n('ranking.clearances_title', 'Clearances')}</h1></div>
      #{body}
    HTML
  end
end
