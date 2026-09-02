/* ---- base path detection ----
 * On a GitHub Pages project site the whole app lives under
 * /<repo-name>/ instead of the domain root, so every internal link and
 * every history.pushState() call needs that prefix or the address bar
 * drifts up to the real domain root (and a refresh 404s there for real).
 * We detect it automatically from the resolved <script src="...js/app.js">
 * URL, so nothing needs to be hand-configured per repo. */
function detectBasePath() {
  const scripts = document.getElementsByTagName('script');
  for (const s of scripts) {
    if (s.src && /\/js\/app\.js(\?.*)?$/.test(s.src)) {
      return new URL(s.src, window.location.href).pathname.replace(/\/js\/app\.js.*$/, '');
    }
  }
  return ''; // fallback: assume domain root
}

const BASE_PATH = detectBasePath(); // '' at domain root, '/repo-name' under a subfolder

/** Route-relative path ("/fixtures") -> real path for the address bar / href
 *  ("/repo-name/fixtures", or unchanged if there's no base path). */
function withBase(path) {
  if (!BASE_PATH) return path;
  return path === '/' ? BASE_PATH + '/' : BASE_PATH + path;
}

/** Real browser pathname -> route-relative path, undoing withBase(). */
function stripBase(pathname) {
  if (BASE_PATH && pathname.startsWith(BASE_PATH)) {
    pathname = pathname.slice(BASE_PATH.length) || '/';
  }
  return pathname;
}

const ROUTES = [];

function route(pattern, handler) {
  // pattern like '/player/:slug' -> regex with named groups
  const paramNames = [];
  const regexStr = '^' + pattern.replace(/:[^/]+/g, (m) => {
    paramNames.push(m.slice(1));
    return '([^/]+)';
  }) + '/?$';
  ROUTES.push({ regex: new RegExp(regexStr, 'i'), paramNames, handler });
}

function currentPath() {
  const path = stripBase(window.location.pathname).replace(/\/index\.html$/, '');
  return path || '/';
}

async function renderRoute() {
  const path = currentPath();
  const main = document.getElementById('app-main');
  for (const r of ROUTES) {
    const match = r.regex.exec(path);
    if (match) {
      const params = {};
      r.paramNames.forEach((name, i) => { params[name] = decodeURIComponent(match[i + 1]); });
      try {
        main.innerHTML = '<div class="empty-state">Loading…</div>';
        const html = await r.handler(params);
        main.innerHTML = html;
      } catch (err) {
        console.error(err);
        main.innerHTML = notFoundView();
      }
      updateActiveNav(path);
      window.scrollTo({ top: 0 });
      return;
    }
  }
  main.innerHTML = notFoundView();
  updateActiveNav(path);
}

function notFoundView() {
  return `
    <div class="page-header">
      <div class="eyebrow">${t('notfound.eyebrow')}</div>
      <h1>${t('notfound.title')}</h1>
      <p>${t('notfound.subtitle')}</p>
    </div>
    <a class="btn" href="${withBase('/')}" data-link>${t('notfound.back_home')}</a>
  `;
}

/** Navigate to a route-relative path (e.g. '/fixtures') - always writes the
 *  base-prefixed real path to the address bar. */
function navigate(path) {
  if (path !== currentPath()) {
    window.history.pushState({}, '', withBase(path));
  }
  renderRoute();
}

function updateActiveNav(path) {
  document.querySelectorAll('.nav-links a').forEach(a => {
    const target = stripBase(new URL(a.href, window.location.href).pathname);
    const isActive = target === '/' ? path === '/' : path.startsWith(target);
    a.classList.toggle('active', isActive);
  });
}

document.addEventListener('click', (e) => {
  const link = e.target.closest('a[data-link]');
  if (!link) return;
  const url = new URL(link.href);
  if (url.origin !== window.location.origin) return;
  e.preventDefault();
  navigate(stripBase(url.pathname));
});

window.addEventListener('popstate', renderRoute);
