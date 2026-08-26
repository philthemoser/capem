/* ============================================================================
 * SHELL — roles, navigation, routing, and the landing page.
 *
 * Routing is hash-based (#/role/screen) so that every screen has an address.
 * Reviewers send each other links to specific screens; a demo where the only
 * way to describe a view is "click the third thing" wastes their time.
 * ==========================================================================*/

const ICON_CASH = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v10M9.5 9.5c0-1 1-1.7 2.5-1.7s2.5.7 2.5 1.7c0 2.6-5 1.6-5 4.4 0 1 1 1.7 2.5 1.7s2.5-.7 2.5-1.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const ICON_BAG = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none"><path d="M5 8h14l-1.2 12H6.2L5 8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 8V6a3 3 0 016 0v2" stroke="currentColor" stroke-width="2"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"><path d="M4 12l5 5L20 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_IN = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const BRAND_MARK = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2 3 6.5v5.8c0 5 3.8 9.2 9 9.7 5.2-.5 9-4.7 9-9.7V6.5L12 2z" fill="currentColor" opacity=".18"/><path d="M12 7.5v9M7.5 12h9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
const BRAND_MARK_SM = BRAND_MARK.replace('width="18" height="18"', 'width="15" height="15"');

/* Role → screens. Each screen names its renderer. */
const ROLES = {
  donor:    { screens: [['donor-give', renderDonorGive], ['donor-needs', renderDonorNeeds], ['donor-impact', renderDonorImpact]] },
  intake:   { screens: [['intake-scan', renderIntakeScan], ['intake-walkin', renderIntakeWalkin], ['intake-people', renderIntakePeople]] },
  gate:     { screens: [['gate', renderGate]] },
  coord:    { screens: [['coord-dash', renderCoordDash], ['coord-match', renderCoordMatch], ['coord-needs', renderCoordNeeds], ['coord-people', renderCoordPeople], ['coord-whatsapp', renderCoordWhatsapp], ['coord-offline', renderOffline]] },
  inv:      { screens: [['inv-stock', renderInvStock], ['inv-log', renderInvLog], ['inv-alerts', renderInvAlerts]] },
  vm:       { screens: [['vm-roster', renderVmRoster]] },
  network:  { screens: [['network', renderNetwork]] },
  setup:    { screens: [['setup', renderSetup]] },
  config:   { screens: [['config', renderConfig]] },
  training: { screens: [['training', renderTraining]] },
  about:    { screens: [['about', renderAbout], ['about-data', renderAboutData], ['about-questions', renderAboutQuestions]] }
};

function screenRenderer(role, id) {
  const r = ROLES[role];
  if (!r) return null;
  const hit = r.screens.find(x => x[0] === id);
  return hit ? hit[1] : null;
}

function go(role, screen) {
  location.hash = '#/' + role + '/' + (screen || ROLES[role].screens[0][0]);
}

function route() {
  const raw = (location.hash || '').replace(/^#\/?/, '');
  const [role, screen] = raw.split('/');
  if (!role || !ROLES[role]) { showLanding(); return; }
  const id = screen && screenRenderer(role, screen) ? screen : ROLES[role].screens[0][0];
  Store.update(s => { s.role = role; s.screen = id; });
  showApp();
}

function showLanding() {
  Store.update(s => { s.role = null; s.screen = null; });
  document.getElementById('landing').hidden = false;
  document.getElementById('app').hidden = true;
  document.getElementById('topbar').hidden = true;
  renderLanding();
  window.scrollTo(0, 0);
}

function showApp() {
  document.getElementById('landing').hidden = true;
  document.getElementById('app').hidden = false;
  document.getElementById('topbar').hidden = false;
  render();
  window.scrollTo(0, 0);
}

/* ---- Render loop --------------------------------------------------------*/
let renderScheduled = false;
function render() {
  const s = Store.get();
  if (!s.role) { renderLanding(); return; }

  renderTopbar();
  renderNav();
  const fn = screenRenderer(s.role, s.screen);
  const main = document.getElementById('main');
  if (fn) main.innerHTML = fn();
  renderCoach();
}

function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => { renderScheduled = false; render(); });
}

function renderTopbar() {
  const s = Store.get();
  const site = Sel.site(s.siteId);
  document.getElementById('topbar').innerHTML = `
    <a class="brand" href="#/">${BRAND_MARK}<span>CAPEM</span></a>
    <span class="event-pill"><span class="event-dot" aria-hidden="true"></span>
      ${esc(pick(Sel.event().name))}</span>
    <div class="topbar-right">
      <label class="sr-only" for="scenarioSel">${esc(t('shell.scenario'))}</label>
      <select id="scenarioSel" onchange="Store.setScenario(this.value)" title="${esc(t('shell.scenario'))}">
        ${Object.keys(SCENARIOS).map(k => `<option value="${k}"${k === s.scenarioId ? ' selected' : ''}>${esc(pick(SCENARIOS[k].event.region))}</option>`).join('')}
      </select>
      <label class="sr-only" for="siteSel">${esc(t('shell.site'))}</label>
      <select id="siteSel" onchange="Store.update(s=>{s.siteId=this.value; s.invSite=this.value})" title="${esc(t('shell.site'))}">
        ${Sel.sites().map(x => `<option value="${x.id}"${x.id === s.siteId ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}
      </select>
      <div class="langs" role="group" aria-label="${esc(t('shell.language'))}">
        ${['en', 'es', 'pt'].map(l => `<button class="${l === s.lang ? 'on' : ''}"
          onclick="Store.setLang('${l}', true)" aria-pressed="${l === s.lang}">${l.toUpperCase()}</button>`).join('')}
      </div>
      ${!s.online ? `<span class="offline-badge">${esc(t('common.offline'))}${s.queue.length ? ' · ' + s.queue.length : ''}</span>` : ''}
    </div>`;
}

function renderNav() {
  const s = Store.get();
  const items = ROLES[s.role].screens.map(([id]) =>
    `<a class="navitem${id === s.screen ? ' active' : ''}" href="#/${s.role}/${id}"
      ${id === s.screen ? 'aria-current="page"' : ''}>${esc(t('screen.' + id))}</a>`).join('');

  document.getElementById('sidebar').innerHTML =
    `<p class="side-role">${esc(t('role.' + s.role))}</p>${items}
     <p class="side-role side-role-2">${esc(t('shell.otherRoles'))}</p>
     ${Object.keys(ROLES).filter(r => r !== s.role).map(r =>
        `<a class="navitem navitem-alt" href="#/${r}/">${esc(t('role.' + r))}</a>`).join('')}`;

  // Mobile: the sidebar disappears under 900px, so the current role's screens
  // move into a bottom bar. The previous prototype simply hid the nav, which
  // made every sub-screen unreachable on a phone.
  document.getElementById('bottomnav').innerHTML = ROLES[s.role].screens.map(([id]) =>
    `<a class="bn-item${id === s.screen ? ' active' : ''}" href="#/${s.role}/${id}"
      ${id === s.screen ? 'aria-current="page"' : ''}>${esc(t('screen.' + id))}</a>`).join('')
    + `<button class="bn-item bn-more" onclick="location.hash='#/'">${esc(t('shell.allRoles'))}</button>`;
}

/* ---- Landing ------------------------------------------------------------*/
function renderLanding() {
  const groups = [
    { key: 'public', roles: [['donor', 'donor-give'], ['donor', 'donor-needs'], ['donor', 'donor-impact']] },
    { key: 'field', roles: [['intake', 'intake-scan'], ['intake', 'intake-walkin'], ['gate', 'gate']] },
    { key: 'running', roles: [['coord', 'coord-match'], ['coord', 'coord-dash'], ['coord', 'coord-needs'], ['coord', 'coord-whatsapp'], ['coord', 'coord-offline'], ['network', 'network']] },
    { key: 'support', roles: [['inv', 'inv-stock'], ['vm', 'vm-roster'], ['setup', 'setup'], ['config', 'config'], ['training', 'training']] },
    { key: 'honest', roles: [['about', 'about'], ['about', 'about-data'], ['about', 'about-questions']] }
  ];

  document.getElementById('landing').innerHTML = `
    <div class="landing-inner">
      <header class="hero">
        <p class="hero-kicker">${esc(t('land.kicker'))}</p>
        <h1>${esc(t('land.h1'))}</h1>
        <p class="hero-lede">${esc(t('land.lede'))}</p>
        <p class="hero-expand">${esc(t('land.expand'))}</p>
        <div class="hero-controls">
          <div class="langs" role="group" aria-label="${esc(t('shell.language'))}">
            ${['en', 'es', 'pt'].map(l => `<button class="${l === Store.get().lang ? 'on' : ''}"
              onclick="Store.setLang('${l}', true)" aria-pressed="${l === Store.get().lang}">${l.toUpperCase()}</button>`).join('')}
          </div>
          <label class="sr-only" for="landScenario">${esc(t('shell.scenario'))}</label>
          <select id="landScenario" onchange="Store.setScenario(this.value)">
            ${Object.keys(SCENARIOS).map(k => `<option value="${k}"${k === Store.get().scenarioId ? ' selected' : ''}>${esc(pick(SCENARIOS[k].event.name))}</option>`).join('')}
          </select>
        </div>
      </header>

      <div class="fiction-banner" role="note">
        <b>${esc(t('land.fictionTitle'))}</b> ${esc(t('land.fictionBody'))}
      </div>

      <section class="loop" aria-label="${esc(t('land.loopLabel'))}">
        ${[1, 2, 3, 4, 5].map(n => `<div class="loop-step">
            <span class="loop-n">${n}</span>
            <b>${esc(t('land.loop' + n + 't'))}</b>
            <span>${esc(t('land.loop' + n))}</span>
          </div>`).join('')}
      </section>

      ${groups.map(g => `
        <h2 class="section-label">${esc(t('land.group.' + g.key))}</h2>
        <div class="rolegrid">
          ${g.roles.map(([role, screen]) => `
            <a class="rolecard" href="#/${role}/${screen}">
              <span class="rc-tag rc-${role}">${esc(t('role.' + role))}</span>
              <b>${esc(t('screen.' + screen))}</b>
              <span>${esc(t('card.' + screen))}</span>
            </a>`).join('')}
        </div>`).join('')}

      <footer class="landing-foot">
        <p>${esc(t('land.footer'))}</p>
        <p class="foot-links">${t('land.footerLinks')}</p>
      </footer>
    </div>`;
}

/* ---- Boot ---------------------------------------------------------------*/
function boot() {
  try {
    const saved = localStorage.getItem('capem.lang');
    if (saved && LANG_INDEX[saved] != null) { Store.get().lang = saved; Store.get().langPinned = true; }
  } catch (e) { /* private browsing */ }

  Store.subscribe(scheduleRender);
  window.addEventListener('hashchange', route);
  route();
}

document.addEventListener('DOMContentLoaded', boot);
