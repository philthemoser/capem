const { chromium } = require('playwright');
const path = require('path');
const EXE = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const url = 'file://' + path.join(__dirname,'..','index.html');
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const shots = [
    ['landing-desktop', 1280, 900, null, null, 'light'],
    ['match-desktop',   1280, 900, 'coord','coord-match', 'light'],
    ['donor-desktop',   1280, 900, 'donor','donor-give', 'light'],
    ['match-dark',      1280, 900, 'coord','coord-match', 'dark'],
    ['landing-mobile',   360, 740, null, null, 'light'],
    ['donor-mobile',     360, 740, 'donor','donor-give', 'light'],
    ['match-mobile',     360, 740, 'coord','coord-match', 'light'],
    ['intake-mobile',    360, 740, 'intake','intake-scan', 'light'],
  ];
  for (const [name,w,h,r,s,scheme] of shots) {
    const p = await b.newPage({ viewport:{width:w,height:h}, colorScheme:scheme, deviceScaleFactor:2 });
    await p.goto(url); await p.waitForTimeout(300);
    if (r) { await p.evaluate(([a,c]) => location.hash='#/'+a+'/'+c, [r,s]); await p.waitForTimeout(220); }
    await p.screenshot({ path: path.join(__dirname,'..','shots',name+'.png'), fullPage: !r });
    // check for horizontal overflow — the classic mobile failure
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    console.log(name.padEnd(18), `${w}x${h}`, overflow > 2 ? `HORIZONTAL OVERFLOW ${overflow}px` : 'no overflow');
    await p.close();
  }
  await b.close();
})();
