/* ---- route table ---- */
route('/', () => homeView());
route('/fixtures', () => fixturesView());
route('/rules', () => rulesView());
route('/notice', () => noticeView());
route('/teams', () => teamsListView());
route('/teams/:slug', ({ slug }) => teamView(slug));
route('/player/:slug', ({ slug }) => playerView(slug));
route('/ranking/teams', () => rankingTeamsView());
route('/ranking/players', () => rankingPlayersView());
route('/ranking/clearances', () => rankingClearancesView());
route('/week/:n', ({ n }) => weekView(parseInt(n, 10)));
route('/match/Week:n', ({ n }) => weekView(parseInt(n, 10)));
route('/matches/Week:n', ({ n }) => weekView(parseInt(n, 10)));
route('/match/:pair', ({ pair }) => matchView(pair));

/* ---- theme ---- */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '☾' : '☀';
  try { localStorage.setItem('8ball-theme', theme); } catch (e) {}
}

function initTheme() {
  let theme = 'dark';
  try {
    theme = localStorage.getItem('8ball-theme')
      || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  } catch (e) {}
  applyTheme(theme);
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });
}

/* ---- mobile nav ---- */
function initMobileNav() {
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  toggle.addEventListener('click', () => links.classList.toggle('open'));
  links.addEventListener('click', (e) => {
    if (e.target.closest('a')) links.classList.remove('open');
  });
}

/* ---- base path: the nav/footer links in index.html are written as plain
 * route-relative paths ("/", "/fixtures", ...) since they're static markup
 * with no templating - rewrite them once at boot to include BASE_PATH so
 * hovering, right-click-open-in-new-tab, and first paint all point at the
 * real URL (client-side navigation itself doesn't depend on this, but
 * everything else does). */
function applyBaseHrefs() {
  document.querySelectorAll('nav a[data-link], footer a[data-link]').forEach(a => {
    a.setAttribute('href', withBase(a.getAttribute('href')));
  });
}

/* ---- language ---- */
const AVAILABLE_LANGS = Object.keys(I18N); // ['en', 'es'] by default — add more in i18n.js

function translateStaticDOM() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.documentElement.lang = getLang();
  const btn = document.getElementById('lang-toggle');
  if (btn) btn.textContent = getLang().toUpperCase();
  if (LEAGUE.config) {
    const footerDisclaimer = document.getElementById('footer-disclaimer');
    if (footerDisclaimer) footerDisclaimer.textContent = LEAGUE.config.disclaimer;
  }
}

function initLangToggle() {
  translateStaticDOM();
  document.getElementById('lang-toggle').addEventListener('click', async () => {
    const idx = AVAILABLE_LANGS.indexOf(getLang());
    const next = AVAILABLE_LANGS[(idx + 1) % AVAILABLE_LANGS.length];
    setLang(next);
    translateStaticDOM();
    await renderRoute(); // re-render the current page's dynamic content in the new language
  });
}

/* ---- boot ---- */
(async function init() {
  initLang();
  initTheme();
  initMobileNav();
  applyBaseHrefs();
  document.getElementById('league-name').textContent = 'Loading…';
  try {
    await loadLeagueData();
    document.getElementById('league-name').textContent = LEAGUE.config.leagueName;
    document.title = LEAGUE.config.leagueName;
  } catch (err) {
    console.error('Failed to load league data', err);
    document.getElementById('app-main').innerHTML = `
      <div class="empty-state">
        Couldn't load league data. If you're opening this file directly, run it through a local
        static server instead (see README.md) — browsers block file:// fetches.
      </div>`;
    return;
  }
  initLangToggle();
  await renderRoute();
})();
