require 'csv'

# Loads and computes everything the site needs from _data/*.yml and the raw
# CSVs under _league_source/. Runs once per build, in LeagueGenerator.
module LeagueData
  def self.slugify(str)
    s = str.to_s.downcase.strip
    s = s.gsub('&', 'and')
    s = s.gsub(/[^a-z0-9]+/, '-')
    s = s.gsub(/\A-+/, '').gsub(/-+\z/, '')
    s
  end

  # CSV files may reference a team by its id ("black-cats") or its display
  # name ("Black Cats") - resolve either to the canonical display name.
  def self.resolve_team_name(teams, raw)
    return raw if raw.nil?
    val = raw.strip
    return raw if val.empty?
    team = teams.find { |t| t['id'] == val || t['displayName'].to_s.downcase == val.downcase }
    team ? team['displayName'] : raw
  end

  def self.build(site)
    config = site.data['config']
    teams = site.data['teams']
    players = site.data['players']
    season = config['currentSeason']

    teams_by_id = {}
    teams.each { |t| teams_by_id[t['id']] = t }

    players_by_id = {}
    players.each { |p| players_by_id[p['id']] = p }

    weeks = parse_fixtures(site, teams, season)
    weeks.each { |week| merge_report_into_week(site, teams, season, week) }
    weeks.sort_by! { |w| w['number'] }

    matches_by_pair = index_matches_by_team_pair(weeks)
    team_standings = compute_team_standings(teams, weeks)
    player_standings = compute_player_standings(players, weeks)
    clearances = compute_clearances(weeks, players_by_id)

    {
      'season' => season,
      'config' => config,
      'teams' => teams,
      'players' => players,
      'teamsById' => teams_by_id,
      'playersById' => players_by_id,
      'weeks' => weeks,
      'matchesByPair' => matches_by_pair,
      'teamStandings' => team_standings,
      'playerStandings' => player_standings,
      'clearances' => clearances,
    }
  end

  def self.parse_fixtures(site, teams, season)
    path = File.join(site.source, '_league_source', 'fixtures', "#{season}.csv")
    weeks = []
    return weeks unless File.exist?(path)

    current_week = nil
    CSV.foreach(path) do |row|
      next if row.nil? || row.empty? || row[0].nil?
      marker = row[0].to_s.strip.downcase
      if marker == 'week'
        number = row[1].to_s.strip.to_i
        current_week = {
          'id' => "week-#{number.to_s.rjust(2, '0')}",
          'number' => number,
          'date' => row[2].to_s.strip,
          'fixtures' => [],
          'matches' => [],
          'played' => false,
        }
        weeks << current_week
      elsif current_week && !row[0].to_s.strip.empty?
        home = resolve_team_name(teams, row[0].to_s.strip)
        away = resolve_team_name(teams, row[1].to_s.strip)
        postponed = row[2].to_s.strip.downcase == 'postponed'
        current_week['fixtures'] << { 'home' => home, 'away' => away, 'postponed' => postponed }
      end
    end
    weeks
  end

  def self.parse_report(site, teams, season, week_id)
    path = File.join(site.source, '_league_source', 'reports', season, "#{week_id}.csv")
    return [] unless File.exist?(path)

    rows = CSV.read(path)
    rows.shift # header row

    matches = []
    current = nil

    rows.each do |row|
      next if row.nil? || row.empty? || row[0].nil?
      type = row[0].to_s.strip.upcase
      next if type.empty?

      a1 = row[1].to_s.strip
      a2 = row[2].to_s.strip
      b1 = row[3].to_s.strip
      b2 = row[4].to_s.strip
      score_a = row[5].to_s.strip.to_i
      score_b = row[6].to_s.strip.to_i
      clearance = row[7].to_s.strip

      if type == 'MATCH'
        matches << current if current
        current = {
          'homeTeamName' => resolve_team_name(teams, a1),
          'awayTeamName' => resolve_team_name(teams, b1),
          'played' => true,
          'games' => [],
        }
      elsif current
        current['games'] << {
          'type' => type,
          'sideA' => [a1, a2].reject { |x| x.nil? || x.empty? },
          'sideB' => [b1, b2].reject { |x| x.nil? || x.empty? },
          'scoreA' => score_a,
          'scoreB' => score_b,
          'clearance' => clearance.empty? ? nil : clearance,
        }
      end
    end
    matches << current if current

    matches.each do |m|
      games_a = m['games'].inject(0) { |sum, g| sum + g['scoreA'] }
      games_b = m['games'].inject(0) { |sum, g| sum + g['scoreB'] }
      m['scoreA'] = games_a
      m['scoreB'] = games_b
      m['pointsA'] = games_a + (games_a > games_b ? 1 : 0)
      m['pointsB'] = games_b + (games_b > games_a ? 1 : 0)
    end
    matches
  end

  def self.merge_report_into_week(site, teams, season, week)
    reported = parse_report(site, teams, season, week['id'])
    week['played'] = !reported.empty?

    reported_by_pair = {}
    reported.each { |m| reported_by_pair["#{m['homeTeamName']}|#{m['awayTeamName']}"] = m }

    week['matches'] = week['fixtures'].map do |fx|
      match = reported_by_pair["#{fx['home']}|#{fx['away']}"]
      if match
        match['week'] = week['id']
        match['weekNumber'] = week['number']
        match['date'] = week['date']
        match['postponed'] = false
        match
      else
        {
          'week' => week['id'],
          'weekNumber' => week['number'],
          'date' => week['date'],
          'homeTeamName' => fx['home'],
          'awayTeamName' => fx['away'],
          'played' => false,
          'postponed' => fx['postponed'],
          'games' => [],
          'scoreA' => 0, 'scoreB' => 0, 'pointsA' => 0, 'pointsB' => 0,
        }
      end
    end
  end

  def self.index_matches_by_team_pair(weeks)
    index = {}
    weeks.each do |week|
      week['matches'].each do |m|
        slug_a = slugify(m['homeTeamName'])
        slug_b = slugify(m['awayTeamName'])
        key = [slug_a, slug_b].sort.join('__')
        (index[key] ||= []) << m
      end
    end
    index
  end

  def self.find_match_by_team_slugs(matches_by_pair, slug_a, slug_b)
    key = [slug_a, slug_b].sort.join('__')
    list = matches_by_pair[key] || []
    list.last
  end

  # Given a combined "teamA-teamB" URL slug, figure out which two known team
  # slugs it's made of (team slugs may themselves contain hyphens).
  def self.split_team_pair_slug(teams, combined)
    slugs = teams.map { |t| slugify(t['displayName']) }
    slugs.each do |s|
      next if combined == s
      if combined.start_with?(s + '-')
        rest = combined[(s.length + 1)..-1]
        return [s, rest] if slugs.include?(rest)
      end
      if combined.end_with?('-' + s)
        rest = combined[0...(combined.length - s.length - 1)]
        return [rest, s] if slugs.include?(rest)
      end
    end
    nil
  end

  def self.compute_team_standings(teams, weeks)
    stats = {}
    teams.each do |t|
      stats[t['id']] = {
        'team' => t, 'matchesPlayed' => 0, 'matchesWon' => 0, 'gamesWon' => 0, 'gamesPlayed' => 0,
        'points' => 0, 'homePlayed' => 0, 'homeWon' => 0, 'awayPlayed' => 0, 'awayWon' => 0,
      }
    end

    id_for_name = {}
    teams.each { |t| id_for_name[t['displayName']] = t['id'] }

    weeks.each do |week|
      week['matches'].each do |m|
        next unless m['played']
        id_a = id_for_name[m['homeTeamName']]
        id_b = id_for_name[m['awayTeamName']]
        next unless id_a && id_b
        sa = stats[id_a]
        sb = stats[id_b]

        sa['matchesPlayed'] += 1
        sb['matchesPlayed'] += 1
        sa['gamesPlayed'] += 9
        sb['gamesPlayed'] += 9
        sa['gamesWon'] += m['scoreA']
        sb['gamesWon'] += m['scoreB']
        sa['points'] += m['pointsA']
        sb['points'] += m['pointsB']
        sa['homePlayed'] += 1
        sb['awayPlayed'] += 1

        if m['scoreA'] > m['scoreB']
          sa['matchesWon'] += 1
          sa['homeWon'] += 1
        elsif m['scoreB'] > m['scoreA']
          sb['matchesWon'] += 1
          sb['awayWon'] += 1
        end
      end
    end

    stats.values.sort_by { |s| [-s['points'], -s['gamesWon'], s['team']['displayName']] }
  end

  def self.compute_player_standings(players, weeks)
    stats = {}
    players.each do |p|
      stats[p['id']] = {
        'player' => p, 'singlesPlayed' => 0, 'singlesWon' => 0,
        'doublesPlayed' => 0, 'doublesWon' => 0, 'clearances' => 0,
      }
    end

    weeks.each do |week|
      week['matches'].each do |m|
        next unless m['played']
        m['games'].each do |g|
          a_won = g['scoreA'] > g['scoreB']
          if g['type'] == 'SINGLES'
            pa = g['sideA'][0]
            pb = g['sideB'][0]
            if stats[pa]
              stats[pa]['singlesPlayed'] += 1
              stats[pa]['singlesWon'] += 1 if a_won
            end
            if stats[pb]
              stats[pb]['singlesPlayed'] += 1
              stats[pb]['singlesWon'] += 1 unless a_won
            end
          elsif g['type'] == 'DOUBLES'
            g['sideA'].each do |pid|
              next unless stats[pid]
              stats[pid]['doublesPlayed'] += 1
              stats[pid]['doublesWon'] += 1 if a_won
            end
            g['sideB'].each do |pid|
              next unless stats[pid]
              stats[pid]['doublesPlayed'] += 1
              stats[pid]['doublesWon'] += 1 unless a_won
            end
          end
          if g['clearance'] && stats[g['clearance']]
            stats[g['clearance']]['clearances'] += 1
          end
        end
      end
    end

    stats.each_value do |s|
      s['winPct'] = s['singlesPlayed'] > 0 ? (s['singlesWon'].to_f / s['singlesPlayed'] * 100) : 0.0
      s['doublesWinPct'] = s['doublesPlayed'] > 0 ? (s['doublesWon'].to_f / s['doublesPlayed'] * 100) : 0.0
      s['totalPoints'] = s['singlesWon']
    end

    stats.values.sort_by { |s| [-s['singlesWon'], -s['winPct'], s['player']['displayName']] }
  end

  def self.compute_clearances(weeks, players_by_id)
    entries = []
    weeks.each do |week|
      week['matches'].each do |m|
        next unless m['played']
        m['games'].each_with_index do |g, gi|
          next unless g['clearance']
          player = players_by_id[g['clearance']]
          next unless player
          entries << { 'player' => player, 'week' => week, 'match' => m, 'gameIndex' => gi }
        end
      end
    end
    entries
  end

  def self.team_active_this_season?(team, season)
    active = team['activeSeasons']
    in_list = active.nil? || active.empty? || active.include?(season)
    in_list && !team['hiddenFromCurrentSeason']
  end

  # The season whose roster/stats should be shown on a team's page: the
  # current season if the team is active in it, otherwise the most recent
  # season the team was actually active in (per activeSeasons, ordered by
  # config['seasons']). Falls back to the team's players' own seasons data
  # if activeSeasons isn't set, then finally to the current season.
  def self.team_display_season(team, players, config)
    season = config['currentSeason']
    return season if team_active_this_season?(team, season)

    active = team['activeSeasons']
    if active && !active.empty?
      candidates = active
    else
      candidates = []
      players.each do |p|
        (p['seasons'] || {}).each do |s, tid|
          candidates << s if tid == team['id']
        end
      end
      candidates.uniq!
    end

    most_recent = nil
    (config['seasons'] || []).each do |s|
      most_recent = s if candidates.include?(s)
    end
    most_recent || season
  end

  def self.roster_for_team(players, team, season)
    players.select { |p| (p['seasons'] || {})[season] == team['id'] }
  end
end
