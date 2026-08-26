/* ============================================================================
 * SETUP, CONFIGURATION, TRAINING, AND THE HONEST-SCOPE SCREENS
 * ==========================================================================*/

/* ---- Centre setup wizard ------------------------------------------------*/
function renderSetup() {
  const s = Store.get();
  const step = s.wizStep || 1;
  const TOTAL = 5;

  const body = {
    1: () => `<h3>${esc(t('wiz.s1title'))}</h3>
      <label class="f-label" for="wname">${esc(t('wiz.centreName'))}</label>
      <input id="wname" type="text" value="${esc(Sel.sites()[0].name)}">
      <div class="grid g2">
        <div><label class="f-label" for="wtype">${esc(t('wiz.type'))}</label>
          <select id="wtype">${['church', 'school', 'sports', 'warehouse', 'collection', 'shelter']
            .map(k => `<option${k === 'church' ? ' selected' : ''}>${esc(t('siteKind.' + k))}</option>`).join('')}</select></div>
        <div><label class="f-label" for="wmun">${esc(t('wiz.municipality'))}</label>
          <input id="wmun" type="text" value="${esc(Sel.sites()[0].municipality)}"></div>
      </div>
      <label class="f-label" for="wevent">${esc(t('wiz.whatsHappening'))}</label>
      <select id="wevent"><option>${esc(pick(Sel.event().name))} — ${esc(t('wiz.joinExisting'))}</option>
        <option>${esc(t('wiz.newLocal'))}</option><option>${esc(t('wiz.ordinaryDrive'))}</option></select>
      <p class="f-hint">${esc(t('wiz.joinHint'))}</p>`,

    2: () => `<h3>${esc(t('wiz.s2title'))}</h3>
      <p class="lede">${esc(t('wiz.s2lede'))}</p>
      ${[['donations', true, 'wiz.modDonationsSub'], ['people', true, 'wiz.modPeopleSub'],
         ['matching', true, 'wiz.modMatchingSub'], ['ops', false, 'wiz.modOpsSub'],
         ['network', null, 'wiz.modNetworkSub']].map(([id, on, sub]) => `
        <div class="modtile">
          <div><b>${esc(t('module.' + id))}</b><span>${esc(t(sub))}</span></div>
          ${on === null ? pill('neutral', t('wiz.auto'))
            : toggleSwitch(s.wizMods ? s.wizMods[id] : on, `wizToggleMod('${id}')`, t('module.' + id))}
        </div>`).join('')}`,

    3: () => `<h3>${esc(t('wiz.s3title'))}</h3>
      <p class="lede">${esc(t('wiz.s3lede'))}</p>
      <div class="chips">${Sel.needs({ site: Sel.sites()[0].id }).slice(0, 6).map(n =>
        chip(Sel.itemName(n.item) + ' · ' + num(n.target), true)).join('')}</div>
      <div class="steer" role="note"><b>${esc(t('wiz.blockedTitle'))}</b>
        <p>${esc(t('wiz.blockedBody'))}</p></div>`,

    4: () => `<h3>${esc(t('wiz.s4title'))}</h3>
      <div class="grid g2">
        <div class="poster">
          <h4>${esc(Sel.sites()[0].name)}</h4>
          <p>${esc(t('wiz.posterLine1'))}<br>${esc(t('wiz.posterLine2'))}</p>
          ${QR.svg('https://capem.org/c/' + Sel.sites()[0].slug, 116, { label: t('wiz.qrLabel') })}
          <p class="poster-url">capem.org/c/${esc(Sel.sites()[0].slug)}</p>
        </div>
        <div>
          <p>${esc(t('wiz.posterExplain'))}</p>
          <div class="row-actions">
            ${btn(t('wiz.printPoster'), "flash(this, t('wiz.sentToPrinter'))", { block: true })}
            ${btn(t('wiz.copyWa'), "copyBroadcast(this)", { block: true })}
          </div>
          <p class="f-hint">${esc(t('wiz.sameQr'))}</p>
        </div>
      </div>`,

    5: () => `<div class="wiz-done">
        ${pill('good', t('wiz.live'))}
        <h3>${esc(t('wiz.liveTitle', { name: Sel.sites()[0].name }))}</h3>
        <p>${esc(t('wiz.liveBody'))}</p>
        <p class="wiz-clock">9:40</p>
        <p class="f-hint">${esc(t('wiz.minutes'))}</p>
        <div class="row-actions">
          ${btn(t('wiz.restart'), "Store.update(s=>{s.wizStep=1})", {})}
          ${btn(t('wiz.openDash'), "go('coord','coord-dash')", { primary: true })}
        </div>
      </div>`
  }[step]();

  return screenHead(t('crumb.setup'), t('wiz.title'), t('wiz.lede'))
    + `<div class="wiz">
        <div class="wiz-progress" role="progressbar" aria-valuenow="${step}" aria-valuemin="1" aria-valuemax="${TOTAL}"
          aria-label="${esc(t('wiz.stepOf', { n: step, total: TOTAL }))}">
          ${Array.from({ length: TOTAL }, (_, i) => `<i class="${i < step ? 'done' : ''}"></i>`).join('')}
        </div>
        <p class="wiz-step-label">${esc(t('wiz.stepOf', { n: step, total: TOTAL }))}</p>
        <div class="card">${body}
          <div class="wiz-foot">
            ${step > 1 ? btn(t('common.back'), `Store.update(s=>{s.wizStep=${step - 1}})`, {}) : '<span></span>'}
            ${step < TOTAL ? btn(step === 4 ? t('wiz.goLive') : t('common.continue'),
                `Store.update(s=>{s.wizStep=${step + 1}})`, { primary: true }) : '<span></span>'}
          </div>
        </div>
      </div>`;
}

function wizToggleMod(id) {
  Store.update(s => {
    if (!s.wizMods) s.wizMods = { donations: true, people: true, matching: true, ops: false };
    s.wizMods[id] = !s.wizMods[id];
  });
}

/* ---- Configuration ------------------------------------------------------*/
function renderConfig() {
  const s = Store.get();
  const tab = s.configTab || 'catalog';

  const panels = {
    catalog: () => card(t('cfg.catalogTitle'), `
        <p class="lede">${esc(t('cfg.catalogLede'))}</p>`
      + table([t('cfg.colCode'), t('cfg.colItem'), t('cfg.colUnit'), t('cfg.colCategory'), t('cfg.colAliases')],
          CATALOG.map(c => `
            <td class="code">${esc(c.code)}</td>
            <td><b>${esc(Sel.itemName(c.code))}</b>${c.blocked ? ' ' + pill('serious', t('cfg.blocked')) : ''}
              ${c.contents ? `<div class="sub">${esc(c.contents.join(', '))}</div>` : ''}</td>
            <td>${esc(Sel.itemUnit(c.code))}</td>
            <td>${esc(t('cat.' + c.cat))}</td>
            <td>${c.aliases.slice(0, 4).map(a => chip(a, false)).join('')}</td>`),
          { caption: t('cfg.catalogCaption') })),

    rules: () => card(t('cfg.rulesTitle'), `
        <p class="lede">${esc(t('cfg.rulesLede'))}</p>`
      + table([t('cfg.colRule'), t('cfg.colItem'), t('cfg.colPer'), { label: t('cfg.colQty'), num: true }, { label: t('cfg.colCap'), num: true }],
          ENTITLEMENTS.map(r => `
            <td>${esc(pick(r.rule))}</td>
            <td>${esc(Sel.itemName(r.item))}</td>
            <td>${esc(t('cfg.per.' + r.per))}</td>
            <td class="num">${num(r.qty)}</td>
            <td class="num">${num(r.cap)}</td>`),
          { caption: t('cfg.rulesCaption') })
      + `<p class="card-note">${esc(t('cfg.rulesNote'))}</p>`),

    channels: () => card(t('cfg.channelsTitle'), `
        <p class="lede">${esc(t('cfg.channelsLede'))}</p>
        ${s.data.cashRails.map((r, i) => `<div class="modtile">
          <div><b>${esc(r)}</b><span>${esc(t('cfg.railSub'))}</span></div>
          ${toggleSwitch(true, "void 0", r)}</div>`).join('')}
        <div class="modtile"><div><b>${esc(t('cfg.pooled'))}</b><span>${esc(t('cfg.pooledSub'))}</span></div>
          ${toggleSwitch(true, "void 0", t('cfg.pooled'))}</div>
        <div class="modtile"><div><b>${esc(t('cfg.walkins'))}</b><span>${esc(t('cfg.walkinsSub'))}</span></div>
          ${toggleSwitch(true, "void 0", t('cfg.walkins'))}</div>
        <div class="modtile"><div><b>${esc(t('cfg.rejectOff'))}</b><span>${esc(t('cfg.rejectOffSub'))}</span></div>
          ${toggleSwitch(true, "void 0", t('cfg.rejectOff'))}</div>
        <p class="card-note">${esc(t('cfg.channelsNote'))}</p>`)
  };

  return screenHead(t('crumb.config'), t('cfg.title'), t('cfg.lede'))
    + `<div class="toolbar">` + seg([
        { id: 'catalog', label: t('cfg.tabCatalog') },
        { id: 'rules', label: t('cfg.tabRules') },
        { id: 'channels', label: t('cfg.tabChannels') }
      ], tab, "Store.update(s=>{s.configTab='{id}'})") + `</div>`
    + panels[tab]();
}

/* ---- Training academy ---------------------------------------------------*/
const COURSES = [
  { id: 'intake', steps: 4, mins: 3, screen: 'intake-scan', role: 'intake' },
  { id: 'gate', steps: 3, mins: 2, screen: 'gate', role: 'gate' },
  { id: 'coordinator', steps: 4, mins: 4, screen: 'coord-match', role: 'coord' }
];

function renderTraining() {
  const s = Store.get();
  return screenHead(t('crumb.training'), t('train.title'), t('train.lede'))
    + grid('g3', COURSES.map(c => `
        <article class="course">
          <span class="course-role">${esc(t('role.' + c.id))}</span>
          <b>${esc(t('course.' + c.id + '.title'))}</b>
          <p>${esc(t('course.' + c.id + '.desc'))}</p>
          <span class="course-meta">${esc(t('train.stepsMins', { steps: c.steps, mins: c.mins }))}</span>
          <div class="course-foot">
            ${s.trained[c.id] ? pill('good', t('train.trained')) : ''}
            ${btn(s.trained[c.id] ? t('train.retake') : t('train.start'), `startCourse('${c.id}')`, { primary: !s.trained[c.id], small: true })}
          </div>
        </article>`))
    + `<div class="two-col-wide">`
    + why(t('train.whyTitle'), [
        `<b>${esc(t('train.why1t'))}</b> ${esc(t('train.why1'))}`,
        `<b>${esc(t('train.why2t'))}</b> ${esc(t('train.why2'))}`,
        `<b>${esc(t('train.why3t'))}</b> ${esc(t('train.why3'))}`
      ])
    + card(t('train.honestTitle'), `<p>${esc(t('train.honestBody'))}</p>`, { cls: 'card-warn' })
    + `</div>`;
}

function startCourse(id) {
  const c = COURSES.find(x => x.id === id);
  Store.update(s => { s.course = { id: id, step: 0 }; });
  go(c.role, c.screen);
  renderCoach();
}

function renderCoach() {
  const s = Store.get();
  const panel = document.getElementById('coach');
  if (!panel) return;
  if (!s.course) { panel.className = 'coach'; panel.innerHTML = ''; return; }

  const c = COURSES.find(x => x.id === s.course.id);
  const total = c.steps + 1;
  const i = s.course.step;
  const isQuiz = i >= c.steps;
  panel.className = 'coach open';

  if (!isQuiz) {
    panel.innerHTML = `
      <div class="coach-head">
        <b>${esc(t('course.' + c.id + '.title'))}</b>
        <span class="coach-step">${i + 1} / ${total}</span>
        <button class="coach-x" onclick="exitCourse()" aria-label="${esc(t('train.exit'))}">✕</button>
      </div>
      <div class="coach-body">
        <h4>${esc(t('course.' + c.id + '.s' + i + '.h'))}</h4>
        <p>${esc(t('course.' + c.id + '.s' + i + '.p'))}</p>
        <div class="coach-behind"><b>${esc(t('train.behindScenes'))}</b>
          ${esc(t('course.' + c.id + '.s' + i + '.b'))}</div>
        <div class="coach-foot">
          ${i > 0 ? btn(t('common.back'), "coachStep(-1)", { small: true }) : '<span></span>'}
          ${btn(i === c.steps - 1 ? t('train.toScenario') : t('common.next'), "coachStep(1)", { primary: true, small: true })}
        </div>
      </div>`;
  } else {
    const picked = s.course.picked;
    panel.innerHTML = `
      <div class="coach-head">
        <b>${esc(t('train.scenarioCheck'))}</b>
        <span class="coach-step">${total} / ${total}</span>
        <button class="coach-x" onclick="exitCourse()" aria-label="${esc(t('train.exit'))}">✕</button>
      </div>
      <div class="coach-body">
        <p>${esc(t('course.' + c.id + '.q'))}</p>
        ${[0, 1, 2].map(n => {
          const correct = t('course.' + c.id + '.q' + n + '.ok') === 'yes';
          const state = picked === n ? (correct ? ' right' : ' wrong') : '';
          return `<button class="quiz-opt${state}" onclick="coachPick(${n},${correct})">
              ${esc(t('course.' + c.id + '.q' + n))}</button>
            ${picked === n ? `<p class="quiz-fb">${esc(t('course.' + c.id + '.q' + n + '.fb'))}</p>` : ''}`;
        }).join('')}
        <div class="coach-foot">
          ${btn(t('common.back'), "coachStep(-1)", { small: true })}
          ${btn(t('train.finish'), "finishCourse()", { primary: true, small: true, disabled: !s.course.passed })}
        </div>
      </div>`;
  }
}

function coachStep(delta) {
  const s = Store.get();
  if (!s.course) return;
  const c = COURSES.find(x => x.id === s.course.id);
  s.course.step = Math.max(0, Math.min(c.steps, s.course.step + delta));
  renderCoach();
}

function coachPick(n, correct) {
  Store.update(s => { s.course.picked = n; if (correct) s.course.passed = true; });
  renderCoach();
}

function finishCourse() {
  Store.update(s => { s.trained[s.course.id] = true; s.course = null; });
  announce(t('train.completed'));
  go('training', 'training');
}

function exitCourse() {
  Store.update(s => { s.course = null; });
  renderCoach();
}

/* ---- About: scope, honesty, and the ask --------------------------------*/
function renderAbout() {
  return screenHead(t('crumb.about'), t('about.title'), t('about.lede'))
    + `<div class="two-col-wide">`
    + card(t('about.isTitle'), `<ul class="why-list">
        <li>${esc(t('about.is1'))}</li><li>${esc(t('about.is2'))}</li>
        <li>${esc(t('about.is3'))}</li><li>${esc(t('about.is4'))}</li></ul>`)
    + card(t('about.isNotTitle'), `<ul class="why-list">
        <li>${esc(t('about.isNot1'))}</li><li>${esc(t('about.isNot2'))}</li>
        <li>${esc(t('about.isNot3'))}</li><li>${esc(t('about.isNot4'))}</li></ul>`, { cls: 'card-warn' })
    + `</div>`
    + card(t('about.newTitle'), `
        <p>${esc(t('about.newBody'))}</p>
        <ul class="why-list">
          <li><b>${esc(t('about.n1t'))}</b> ${esc(t('about.n1'))}</li>
          <li><b>${esc(t('about.n2t'))}</b> ${esc(t('about.n2'))}</li>
        </ul>
        <p class="card-note">${esc(t('about.precedent'))}</p>`)
    + card(t('about.dataTitle'), `<p>${esc(t('about.dataBody'))}</p>
        <div class="row-actions">${btn(t('about.readResearch'), "void 0", { small: true, disabled: true })}</div>
        <p class="card-note">${esc(t('about.docsNote'))}</p>`);
}

function renderAboutData() {
  return screenHead(t('crumb.about'), t('dp.title'), t('dp.lede'))
    + `<div class="two-col-wide">`
    + card(t('dp.basisTitle'), `
        <p>${esc(t('dp.basisBody'))}</p>
        <blockquote>${esc(t('dp.quote'))}<cite>${esc(t('dp.cite'))}</cite></blockquote>
        <p>${esc(t('dp.basisAlt'))}</p>`)
    + card(t('dp.designTitle'), `<ul class="why-list">
        <li><b>${esc(t('dp.d1t'))}</b> ${esc(t('dp.d1'))}</li>
        <li><b>${esc(t('dp.d2t'))}</b> ${esc(t('dp.d2'))}</li>
        <li><b>${esc(t('dp.d3t'))}</b> ${esc(t('dp.d3'))}</li>
        <li><b>${esc(t('dp.d4t'))}</b> ${esc(t('dp.d4'))}</li></ul>`)
    + `</div>`
    + card(t('dp.unsolvedTitle'), `
        <p>${esc(t('dp.unsolvedBody'))}</p>
        <ul class="why-list">
          <li><b>${esc(t('dp.u1t'))}</b> ${esc(t('dp.u1'))}</li>
          <li><b>${esc(t('dp.u2t'))}</b> ${esc(t('dp.u2'))}</li>
          <li><b>${esc(t('dp.u3t'))}</b> ${esc(t('dp.u3'))}</li>
        </ul>`, { cls: 'card-warn' })
    + card(t('dp.askTitle'), `<p>${esc(t('dp.askBody'))}</p>`);
}

function renderAboutQuestions() {
  const QS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'];
  return screenHead(t('crumb.about'), t('oq.title'), t('oq.lede'))
    + QS.map(q => card(t('oq.' + q + 't'),
        `<p>${esc(t('oq.' + q))}</p>
         <p class="oq-want"><b>${esc(t('oq.weNeed'))}</b> ${esc(t('oq.' + q + 'w'))}</p>`)).join('')
    + card(t('oq.howTitle'), `<p>${esc(t('oq.howBody'))}</p>`, { cls: 'card-warn' });
}
