const { chromium } = require('playwright');
const path = require('path');
const EXE = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let pass=0, fail=0;
const check=(n,ok,d)=>{ok?pass++:fail++; console.log((ok?'OK   ':'FAIL ')+n+(d?'  — '+d:''));};
(async()=>{
  const b = await chromium.launch({ executablePath: EXE });
  const url='file://'+path.join(__dirname,'..','index.html');

  // ---- Desktop: stable order, expand in place ----
  const d = await b.newPage({ viewport:{width:1280,height:900} });
  const errs=[]; d.on('pageerror',e=>errs.push(e.message));
  await d.goto(url); await d.waitForTimeout(300);
  const order = async () => d.evaluate(()=>[...document.querySelectorAll('#sidebar .nav-role')].map(a=>a.textContent.trim()));

  await d.evaluate(()=>location.hash='#/donor/donor-give'); await d.waitForTimeout(150);
  const o1 = await order();
  const sub1 = await d.evaluate(()=>[...document.querySelectorAll('#sidebar .nav-sub-item')].map(a=>a.textContent.trim()));

  await d.evaluate(()=>location.hash='#/network/network'); await d.waitForTimeout(150);
  const o2 = await order();

  await d.evaluate(()=>location.hash='#/coord/coord-match'); await d.waitForTimeout(150);
  const o3 = await order();
  const sub3 = await d.evaluate(()=>[...document.querySelectorAll('#sidebar .nav-sub-item')].map(a=>a.textContent.trim()));
  const expandedUnder = await d.evaluate(()=>{
    const g=[...document.querySelectorAll('#sidebar .nav-group')];
    const i=g.findIndex(x=>x.classList.contains('open'));
    return { index:i, total:g.length, role:g[i].querySelector('.nav-role').textContent.trim() };
  });

  check('role order is identical across navigations',
        JSON.stringify(o1)===JSON.stringify(o2) && JSON.stringify(o2)===JSON.stringify(o3),
        o1.join(' › '));
  check('only the active role expands',
        sub1.length===3 && sub3.length===6, `donor ${sub1.length} children, coord ${sub3.length}`);
  check('expansion happens in place, not at the top',
        expandedUnder.index===3, `coord is item ${expandedUnder.index+1} of ${expandedUnder.total}`);
  const singleNoCaret = await d.evaluate(()=>{
    const g=[...document.querySelectorAll('#sidebar .nav-group')];
    return g.filter(x=>x.querySelector('.nav-caret')).length;
  });
  check('only multi-screen roles show a caret', singleNoCaret===5, `${singleNoCaret} of 11`);

  // ---- Mobile: sheet ----
  const m = await b.newPage({ viewport:{width:390,height:780} });
  m.on('pageerror',e=>errs.push(e.message));
  await m.goto(url); await m.waitForTimeout(300);
  await m.evaluate(()=>location.hash='#/coord/coord-match'); await m.waitForTimeout(250);

  const barVisible = await m.isVisible('#menubar');
  const barText = await m.textContent('#menubar');
  check('menu bar shows current location', barVisible && /Coordinator/i.test(barText), barText.replace(/\s+/g,' ').trim());
  check('sheet is hidden initially', await m.evaluate(()=>document.getElementById('sheet').hidden));

  await m.click('#menubar'); await m.waitForTimeout(400);
  const openState = await m.evaluate(()=>({
    shown: document.getElementById('sheet').classList.contains('shown'),
    y: document.getElementById('sheet').getBoundingClientRect().top,
    locked: document.body.classList.contains('sheet-open'),
    roles: document.querySelectorAll('#sheetNav .nav-role').length,
    subs: document.querySelectorAll('#sheetNav .nav-sub-item').length
  }));
  check('sheet slides up and shows the full tree',
        openState.shown && openState.y < 780 && openState.roles===11 && openState.subs===6,
        `top=${Math.round(openState.y)}px, ${openState.roles} roles, ${openState.subs} sub-items`);
  check('background scroll is locked while open', openState.locked);

  // choosing a destination closes it AND navigates
  await m.click('#sheetNav a[href="#/inv/inv-stock"]'); await m.waitForTimeout(500);
  const after = await m.evaluate(()=>({ hash: location.hash, hidden: document.getElementById('sheet').hidden,
                                        locked: document.body.classList.contains('sheet-open') }));
  check('choosing a destination navigates and closes the sheet',
        after.hash==='#/inv/inv-stock' && after.hidden && !after.locked, after.hash);

  await m.click('#menubar'); await m.waitForTimeout(350);
  await m.keyboard.press('Escape'); await m.waitForTimeout(400);
  check('Escape closes the sheet', await m.evaluate(()=>document.getElementById('sheet').hidden));

  await m.click('#menubar'); await m.waitForTimeout(350);
  await m.click('.sheet-backdrop', { position:{x:195,y:60} }); await m.waitForTimeout(400);
  check('tapping the backdrop closes the sheet', await m.evaluate(()=>document.getElementById('sheet').hidden));

  // ---- Light theme regardless of OS preference ----
  const dk = await b.newPage({ viewport:{width:1280,height:900}, colorScheme:'dark' });
  await dk.goto(url); await dk.waitForTimeout(250);
  await dk.evaluate(()=>location.hash='#/coord/coord-dash'); await dk.waitForTimeout(200);
  const bg = await dk.evaluate(()=>getComputedStyle(document.body).backgroundColor);
  check('light theme even when the OS asks for dark', bg==='rgb(247, 247, 245)', bg);

  check('no runtime errors', errs.length===0, errs.slice(0,2).join(' | '));
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})();
