require_relative 'league_data'
require_relative 'view_helpers'
require_relative 'page_views'

class LeagueGenerator < Jekyll::Generator
  safe true
  priority :normal

  def generate(site)
    data = LeagueData.build(site)

    add_page(site, '', 'index.html', 'Home', PageViews.home(data, site))
    add_page(site, 'fixtures', 'index.html', 'Fixtures', PageViews.fixtures(data, site))
    add_page(site, 'teams', 'index.html', 'Teams', PageViews.teams_list(data, site))

    data['teams'].each do |t|
      slug = LeagueData.slugify(t['displayName'])
      add_page(site, "teams/#{slug}", 'index.html', t['displayName'], PageViews.team(data, site, t))
    end

    data['players'].each do |p|
      slug = LeagueData.slugify(p['displayName'])
      add_page(site, "player/#{slug}", 'index.html', p['displayName'], PageViews.player(data, site, p))
    end

    data['weeks'].each do |w|
      add_page(site, "week/#{w['number']}", 'index.html', "Week #{w['number']}", PageViews.week(data, site, w))
      # Legacy aliases from the original spec (url.com/match/Week1, url.com/matches/Week1) -
      # kept as tiny redirect stubs so old links/bookmarks still land somewhere real.
      add_redirect(site, "match/Week#{w['number']}", "/week/#{w['number']}/")
      add_redirect(site, "matches/Week#{w['number']}", "/week/#{w['number']}/")
    end

    data['matchesByPair'].each_value do |matches|
      m = matches.last # most recent meeting, if the same pair played more than once
      slug = "#{LeagueData.slugify(m['homeTeamName'])}-#{LeagueData.slugify(m['awayTeamName'])}"
      title = "#{m['homeTeamName']} vs #{m['awayTeamName']}"
      add_page(site, "match/#{slug}", 'index.html', title, PageViews.match(data, site, m))
    end

    add_page(site, 'ranking/teams', 'index.html', 'Team rankings', PageViews.ranking_teams(data, site))
    add_page(site, 'ranking/players', 'index.html', 'Player rankings', PageViews.ranking_players(data, site))
    add_page(site, 'ranking/clearances', 'index.html', 'Clearances', PageViews.ranking_clearances(data, site))
  end

  private

  def add_page(site, dir, name, title, body)
    page = Jekyll::PageWithoutAFile.new(site, site.source, dir, name)
    page.content = body
    page.data['layout'] = 'default'
    page.data['title'] = title
    site.pages << page
  end

  def add_redirect(site, dir, target_route)
    target = ViewHelpers.base_url(site, target_route)
    page = Jekyll::PageWithoutAFile.new(site, site.source, dir, 'index.html')
    page.content = <<~HTML
      <!doctype html>
      <meta charset="utf-8">
      <title>Redirecting&hellip;</title>
      <meta http-equiv="refresh" content="0; url=#{target}">
      <link rel="canonical" href="#{target}">
      <p>Redirecting to <a href="#{target}">#{target}</a>&hellip;</p>
    HTML
    site.pages << page
  end
end
