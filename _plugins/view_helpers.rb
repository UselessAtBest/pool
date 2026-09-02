require 'cgi'
require 'date'

module ViewHelpers
  def self.esc(s)
    CGI.escapeHTML(s.to_s)
  end

  def self.base_url(site, path)
    prefix = site.config['baseurl'].to_s
    return path if prefix.empty?
    path == '/' ? "#{prefix}/" : "#{prefix}#{path}"
  end

  # <span data-i18n="key">English fallback text</span>, with optional
  # data-i18n-<var>="value" attributes for interpolated strings (the client
  # i18n.js reads these back out to re-run t(key, vars) on language switch).
  def self.i18n(key, text, vars = {})
    attrs = vars.map { |k, v| " data-i18n-#{k}=\"#{esc(v)}\"" }.join
    "<span data-i18n=\"#{key}\"#{attrs}>#{text}</span>"
  end

  def self.fmt_date(iso)
    return 'TBC' if iso.nil? || iso.strip.empty?
    begin
      Date.parse(iso).strftime('%A, %B %-d, %Y')
    rescue ArgumentError
      iso
    end
  end

  def self.team_link(data, site, name)
    slug = LeagueData.slugify(name)
    "<a href=\"#{base_url(site, '/teams/' + slug + '/')}\">#{esc(name)}</a>"
  end

  def self.player_link(data, site, id)
    p = data['playersById'][id]
    return esc(id) unless p
    "<a href=\"#{base_url(site, '/player/' + LeagueData.slugify(p['displayName']) + '/')}\">#{esc(p['displayName'])}</a>"
  end

  # Venue owner may be a player's uniqueID (links to their profile, like
  # Captain does) or just plain text for someone who isn't a league player.
  def self.venue_owner_link(data, site, raw)
    return i18n('common.dash', '&mdash;') if raw.nil? || raw.to_s.strip.empty?
    return player_link(data, site, raw) if data['playersById'][raw]
    esc(raw)
  end

  def self.match_url(site, home_name, away_name)
    base_url(site, "/match/#{LeagueData.slugify(home_name)}-#{LeagueData.slugify(away_name)}/")
  end

  def self.week_url(site, n)
    base_url(site, "/week/#{n}/")
  end

  def self.match_card(data, site, m)
    if m['played']
      a_cls = m['pointsA'] > m['pointsB'] ? ' class="win"' : ''
      b_cls = m['pointsB'] > m['pointsA'] ? ' class="win"' : ''
      score_html = "<span#{a_cls}>#{m['pointsA']}</span> - <span#{b_cls}>#{m['pointsB']}</span>"
    else
      score_html = i18n('common.vs', 'vs')
    end

    if m['postponed']
      status_class = 'postponed'
      status_text = i18n('badge.postponed', 'Postponed')
    elsif m['played']
      status_class = 'played'
      status_text = i18n('badge.played', 'Played')
    else
      status_class = 'upcoming'
      status_text = i18n('badge.upcoming', 'Upcoming')
    end

    report_link = ''
    if m['played']
      report_link = "<a class=\"btn btn-ghost\" href=\"#{match_url(site, m['homeTeamName'], m['awayTeamName'])}\">#{i18n('common.match_report', 'Match report')}</a>"
    end

    <<~HTML
      <div class="match-card">
        <div class="match-teams">
          <span class="team">#{team_link(data, site, m['homeTeamName'])}</span>
          <span class="match-score mono">#{score_html}</span>
          <span class="team right">#{team_link(data, site, m['awayTeamName'])}</span>
        </div>
        <div class="match-meta">
          <span>#{fmt_date(m['date'])} &middot; #{i18n('common.week', "Week #{m['weekNumber']}", { 'n' => m['weekNumber'] })}</span>
          <span class="badge #{status_class}">#{status_text}</span>
        </div>
        #{report_link}
      </div>
    HTML
  end

  def self.week_line(data, site, m)
    score_html = m['played'] ? "#{m['pointsA']} - #{m['pointsB']}" : i18n('common.vs', 'vs')
    postponed_badge = m['postponed'] ? "<span class=\"badge postponed\">#{i18n('badge.postponed', 'Postponed')}</span>" : ''
    report_link = m['played'] ? "<a class=\"btn btn-ghost btn-sm\" href=\"#{match_url(site, m['homeTeamName'], m['awayTeamName'])}\">#{i18n('common.report', 'Report')}</a>" : ''

    <<~HTML
      <div class="week-line">
        <span class="wl-team">#{team_link(data, site, m['homeTeamName'])}</span>
        #{postponed_badge}
        <span class="wl-score mono">#{score_html}</span>
        <span class="wl-team wl-team-right">#{team_link(data, site, m['awayTeamName'])}</span>
        #{report_link}
      </div>
    HTML
  end

  def self.week_box(data, site, week)
    lines = week['matches'].map { |m| week_line(data, site, m) }.join
    status_class = week['played'] ? 'played' : 'upcoming'
    status_text = week['played'] ? i18n('badge.played', 'Played') : i18n('badge.upcoming', 'Upcoming')
    <<~HTML
      <div class="card week-box">
        <div class="week-box-date">
          <span>#{fmt_date(week['date'])}</span>
          <span class="badge #{status_class}">#{status_text}</span>
        </div>
        #{lines}
      </div>
    HTML
  end

  def self.game_row(data, site, g, index)
    side_a = g['sideA'].map { |id| player_link(data, site, id) }.join(' &amp; ')
    side_b = g['sideB'].map { |id| player_link(data, site, id) }.join(' &amp; ')
    a_won = g['scoreA'] > g['scoreB']
    clearance_on_a = g['clearance'] && g['sideA'].include?(g['clearance'])
    clearance_on_b = g['clearance'] && g['sideB'].include?(g['clearance'])
    clearance_mark = " <span class=\"clearance-emoji\" title=\"Clearance\">\u{1F3B1}</span>"

    a_name_cls = a_won ? ' won' : ''
    b_name_cls = a_won ? '' : ' won'

    <<~HTML
      <div class="game-row" id="game-#{index}">
        <div class="game-side game-side-a">#{clearance_on_a ? clearance_mark : ''}<span class="name#{a_name_cls}">#{side_a}</span></div>
        <div class="game-score mono">#{g['scoreA']} - #{g['scoreB']}</div>
        <div class="game-side game-side-b"><span class="name#{b_name_cls}">#{side_b}</span>#{clearance_on_b ? clearance_mark : ''}</div>
      </div>
    HTML
  end

  def self.match_report_block(data, site, m, show_full_link = true)
    unless m['played']
      status_text = m['postponed'] ? i18n('week.postponed', 'This match has been postponed.') : i18n('week.not_played_yet', "This match hasn't been played yet.")
      return <<~HTML
        <div class="card">
          <div class="match-teams">
            <span class="team">#{team_link(data, site, m['homeTeamName'])}</span>
            <span class="match-score mono">#{i18n('common.vs', 'vs')}</span>
            <span class="team right">#{team_link(data, site, m['awayTeamName'])}</span>
          </div>
          <p class="profile-sub" style="margin-top:10px;">#{status_text}</p>
        </div>
      HTML
    end

    singles = m['games'].select { |g| g['type'] == 'SINGLES' }
    doubles = m['games'].select { |g| g['type'] == 'DOUBLES' }
    singles_html = singles.map { |g| game_row(data, site, g, m['games'].index(g)) }.join
    doubles_html = doubles.map { |g| game_row(data, site, g, m['games'].index(g)) }.join

    winner = m['pointsA'] > m['pointsB'] ? m['homeTeamName'] : m['awayTeamName']
    summary = i18n('week.score_summary', "#{m['scoreA']}-#{m['scoreB']} on games, bonus point to #{esc(winner)}.",
                    { 'a' => m['scoreA'], 'b' => m['scoreB'], 'team' => esc(winner) })

    full_link = ''
    if show_full_link
      full_link = "<p style=\"margin-top:18px;\"><a href=\"#{match_url(site, m['homeTeamName'], m['awayTeamName'])}\">#{i18n('common.full_match_page', 'Full match page &rarr;')}</a></p>"
    end

    <<~HTML
      <div class="card">
        <div class="match-teams">
          <span class="team">#{team_link(data, site, m['homeTeamName'])}</span>
          <span class="match-score mono">#{m['pointsA']} - #{m['pointsB']}</span>
          <span class="team right">#{team_link(data, site, m['awayTeamName'])}</span>
        </div>
        <p class="profile-sub" style="margin:4px 0 18px;">#{summary}</p>

        <h3>#{i18n('common.singles', 'Singles')}</h3>
        #{singles_html}
        <h3 style="margin-top:20px;">#{i18n('common.doubles', 'Doubles')}</h3>
        #{doubles_html}

        #{full_link}
      </div>
    HTML
  end

  def self.team_rank_table(data, site, standings, detailed)
    detailed_head = detailed ? "<th class=\"num\">#{i18n('table.win_pct', 'Win %')}</th><th class=\"num\">#{i18n('table.home_win_pct', 'Home Win %')}</th><th class=\"num\">#{i18n('table.away_win_pct', 'Away Win %')}</th>" : ''
    rows = standings.each_with_index.map do |s, i|
      detailed_cells = ''
      if detailed
        win_pct = s['matchesPlayed'] > 0 ? ((s['matchesWon'].to_f / s['matchesPlayed']) * 100).round : 0
        home_pct = s['homePlayed'] > 0 ? ((s['homeWon'].to_f / s['homePlayed']) * 100).round : 0
        away_pct = s['awayPlayed'] > 0 ? ((s['awayWon'].to_f / s['awayPlayed']) * 100).round : 0
        detailed_cells = "<td class=\"num\">#{win_pct}%</td><td class=\"num\">#{home_pct}%</td><td class=\"num\">#{away_pct}%</td>"
      end
      <<~HTML
        <tr>
          <td>#{i + 1}</td>
          <td>#{team_link(data, site, s['team']['displayName'])}</td>
          <td class="num">#{s['matchesPlayed']}</td>
          <td class="num">#{s['gamesWon']}</td>
          <td class="num">#{s['matchesWon']}</td>
          #{detailed_cells}
          <td class="num"><span class="points-ball">#{s['points']}</span></td>
        </tr>
      HTML
    end.join

    <<~HTML
      <div class="table-wrap"><table>
        <thead><tr>
          <th>#{i18n('table.hash', '#')}</th><th>#{i18n('table.team', 'Team')}</th>
          <th class="num">#{i18n('table.matches', 'Matches')}</th><th class="num">#{i18n('table.games_won', 'Games Won')}</th><th class="num">#{i18n('table.matches_won', 'Matches Won')}</th>
          #{detailed_head}
          <th class="num">#{i18n('table.points', 'Points')}</th>
        </tr></thead>
        <tbody>#{rows}</tbody>
      </table></div>
    HTML
  end

  def self.player_rank_table(data, site, standings, detailed)
    detailed_head = detailed ? "<th class=\"num\">#{i18n('table.games_won', 'Games Won')}</th><th class=\"num\">#{i18n('table.doubles_played', 'Doubles Played')}</th><th class=\"num\">#{i18n('table.doubles_won', 'Doubles Won')}</th><th class=\"num\">#{i18n('table.doubles_win_pct', 'Doubles Win %')}</th><th class=\"num\">#{i18n('table.clearances_col', 'Clearances')}</th>" : ''
    season = data['season']

    rows = standings.each_with_index.map do |s, i|
      team_id = (s['player']['seasons'] || {})[season]
      team = team_id ? data['teamsById'][team_id] : nil
      team_cell = team ? team_link(data, site, team['displayName']) : i18n('common.dash', '&mdash;')

      detailed_cells = ''
      if detailed
        detailed_cells = "<td class=\"num\">#{s['singlesWon']}</td><td class=\"num\">#{s['doublesPlayed']}</td><td class=\"num\">#{s['doublesWon']}</td><td class=\"num\">#{s['doublesWinPct'].round}%</td><td class=\"num\">#{s['clearances']}</td>"
      end

      <<~HTML
        <tr>
          <td>#{i + 1}</td>
          <td>#{player_link(data, site, s['player']['id'])}</td>
          <td>#{team_cell}</td>
          <td class="num">#{s['singlesPlayed']}</td>
          #{detailed_cells}
          <td class="num">#{s['winPct'].round}%</td>
          <td class="num"><span class="points-ball">#{s['totalPoints']}</span></td>
        </tr>
      HTML
    end.join

    <<~HTML
      <div class="table-wrap"><table>
        <thead><tr>
          <th>#{i18n('table.hash', '#')}</th><th>#{i18n('table.player', 'Player')}</th><th>#{i18n('table.team', 'Team')}</th>
          <th class="num">#{i18n('table.games_played', 'Games Played')}</th>
          #{detailed_head}
          <th class="num">#{i18n('table.win_pct', 'Win %')}</th>
          <th class="num">#{i18n('table.points', 'Points')}</th>
        </tr></thead>
        <tbody>#{rows}</tbody>
      </table></div>
    HTML
  end

  def self.team_roster_table(data, site, standings)
    rows = standings.map do |s|
      <<~HTML
        <tr>
          <td>#{player_link(data, site, s['player']['id'])}</td>
          <td class="num">#{s['singlesPlayed']}</td>
          <td class="num">#{s['singlesWon']}</td>
          <td class="num">#{s['winPct'].round}%</td>
          <td class="num"><span class="points-ball">#{s['totalPoints']}</span></td>
        </tr>
      HTML
    end.join

    <<~HTML
      <div class="table-wrap"><table>
        <thead><tr>
          <th>#{i18n('table.player', 'Player')}</th>
          <th class="num">#{i18n('table.games_played', 'Games Played')}</th>
          <th class="num">#{i18n('table.games_won', 'Games Won')}</th>
          <th class="num">#{i18n('table.win_pct', 'Win %')}</th>
          <th class="num">#{i18n('table.points', 'Points')}</th>
        </tr></thead>
        <tbody>#{rows}</tbody>
      </table></div>
    HTML
  end
end
