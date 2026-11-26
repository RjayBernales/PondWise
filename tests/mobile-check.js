/* Optional Playwright regression checks. Use an isolated browser and a local static
   server; provide Playwright on NODE_PATH if it is not installed locally. */
'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const axePath = process.env.AXE_CORE_PATH;
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_BIN || '/opt/brave-bin/brave', headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on('dialog', dialog => dialog.accept());
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const go = async route => { await page.evaluate(r => { location.hash = r; }, route); await page.waitForFunction(r => document.querySelector('main').dataset.page === r, route); };
  const dateInput = '#entry-tasks [name=date]';
  try {
    await page.goto(process.env.PONDWISE_TEST_URL || 'http://127.0.0.1:8877');
    await page.locator('#account-field-name').fill('Test Keeper');
    await page.locator('#account-field-email').fill('keeper@example.test');
    await page.locator('#account-field-password').fill('unique-test-password');
    await page.locator('#account-field-confirm').fill('unique-test-password');
    await page.locator('[name=consent]').check();
    await page.locator('#account-signup [type=submit]').click();
    await page.locator('.overview-heading').waitFor();
    assert.match(await page.locator('.start-pond').innerText(), /Create your first pond/);
    await go('settings'); await page.locator('[data-tab=help]').click(); await page.locator('button[data-action=workspace]').click();
    await go('overview'); assert.match(await page.locator('.pond-stats').innerText(), /Elite/);
    await go('plans'); await page.locator('[data-action=plan][data-tier=elite]').click(); await go('overview');
    assert.match(await page.locator('.pond-stats').innerText(), /3.60 kg/);
    assert.match(await page.locator('.agenda-panel').innerText(), /Observe fish appetite/);
    const before = await page.evaluate(() => localStorage.getItem('pondwise_demo_v2'));
    for (const width of [320, 375, 390, 480, 700, 1440]) {
      await page.setViewportSize({width, height:900});
      for (const route of ['overview','ponds','tasks','records','money','tools','profile','settings','plans','more']) {
        await go(route);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} overflow at ${width}`);
        assert(await page.evaluate(() => { const ids = [...document.querySelectorAll('[id]')].map(e => e.id); return ids.length === new Set(ids).size; }), 'unique IDs');
        if (['overview','tasks'].includes(route)) await page.screenshot({path:`/tmp/pondwise-${route}-${width}.png`,fullPage:true});
        if (route === 'tasks') {
          assert(await page.locator('.calendar').isVisible(), `visible calendar at ${width}`);
          assert.equal(await page.locator('.weekday').count(), 7);
          if (width <= 700) {
            const box = await page.locator('[data-action=day]').first().boundingBox();
            assert(box.width >= 43.9 && box.height >= 44, '44px calendar targets');
            assert((await page.locator('.calendar-panel').boundingBox()).y < (await page.locator('.task-agenda').boundingBox()).y, 'calendar leads on mobile');
          }
        }
      }
      console.log(`PASS all routes and calendar: ${width}px`);
    }
    assert.equal(await page.evaluate(() => localStorage.getItem('pondwise_demo_v2')), before, 'navigation never writes data');
    await page.setViewportSize({width:390,height:844}); await go('tasks');
    const today = await page.locator('[aria-current=date]').getAttribute('data-date');
    await page.locator('[data-action=day]').first().click();
    let selected = await page.locator('[aria-pressed=true]').getAttribute('data-date');
    assert.equal(await page.locator(dateInput).inputValue(), selected, 'date selection prefills task');
    await page.locator('[data-action=month][data-step="1"]').click();
    assert.equal(await page.locator(dateInput).inputValue(), selected, 'browsing month preserves draft date');
    await page.locator('[data-action=today]').click();
    assert.equal(await page.locator(dateInput).inputValue(), today);
    assert.equal(await page.locator('.task-dot').count(), 1, 'live task indicator');
    await page.locator('[aria-current=date]').focus();
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
    selected = await page.locator('[aria-pressed=true]').getAttribute('data-date');
    assert.notEqual(selected, today); assert.equal(await page.locator(dateInput).inputValue(), selected, 'keyboard selection prefills');
    await page.locator('#entry-tasks [name=title]').fill('Calendar regression task');
    await page.locator('#entry-tasks [type=submit]').click();
    assert(await page.evaluate(d => JSON.parse(localStorage.getItem('pondwise_demo_v2')).data.tasks.some(t => t.title === 'Calendar regression task' && t.date === d), selected), 'task persists selected date');
    await page.locator('[data-action=day][data-date="'+selected+'"]').click();
    assert.match(await page.locator('.selected-tasks').innerText(), /Calendar regression task/);
    await page.locator('.selected-tasks [data-action=task-toggle]').click();
    assert.match(await page.locator('.selected-tasks').innerText(), /Completed/);
    // Browsing dates must never silently move the date of a correction.
    await page.locator('.selected-tasks [data-action=edit]').click();
    await page.locator('[data-action=today]').click();
    assert.equal(await page.locator(dateInput).inputValue(), selected, 'calendar preserves correction date');
    await page.locator('#entry-tasks [data-action=discard]').click();
    await page.locator('[data-action=today]').click();
    await page.locator('.calendar-panel').screenshot({path:'/tmp/pondwise-calendar.png'});
    await go('overview'); await page.screenshot({path:'/tmp/pondwise-mobile.png',fullPage:true});
    await page.locator('#mobileNav .nav-add').click(); await page.waitForFunction(() => location.hash === '#records');
    assert.equal(await page.locator('#mobileNav [aria-current=page]').innerText(), 'Add record');
    await page.locator('#entry-feedLogs [name=kg]').fill('-1'); await page.locator('#entry-feedLogs [type=submit]').click();
    assert.equal(await page.locator('#entry-feedLogs [name=kg]').getAttribute('aria-invalid'), 'true');
    assert.equal(await page.locator('#entry-feedLogs [name=kg]').inputValue(), '-1');
    // Simulate a visual viewport reduced by the software keyboard.
    await page.evaluate(() => { Object.defineProperty(window.visualViewport, 'height', { configurable:true, value:400 }); document.querySelector('#entry-feedLogs [name=kg]').focus(); window.visualViewport.dispatchEvent(new Event('resize')); });
    assert.equal(await page.locator('#mobileNav').isVisible(), false, 'nav yields to software keyboard');
    await page.evaluate(() => { delete window.visualViewport.height; document.activeElement.blur(); window.visualViewport.dispatchEvent(new Event('resize')); });
    await page.setViewportSize({width:1440,height:900}); await go('overview');
    assert(await page.locator('.overview-grid').isVisible()); assert(await page.locator('.chat-shell').isVisible());
    await page.screenshot({path:'/tmp/pondwise-desktop.png',fullPage:true});
    await page.setViewportSize({width:700,height:390}); await go('records');
    await page.evaluate(() => { document.documentElement.style.fontSize='200%'; });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'landscape and enlarged text fit');
    await page.evaluate(() => { document.documentElement.style.fontSize=''; });
    if (axePath) {
      for (const width of [390,1440]) {
        await page.setViewportSize({width,height:900});
        for (const route of ['overview','ponds','tasks','records','money','tools','profile','settings','plans','more']) {
          await go(route); await page.addScriptTag({path:axePath});
          const violations = await page.evaluate(async () => (await axe.run()).violations);
          assert.deepEqual(violations.map(v => ({id:v.id, nodes:v.nodes.map(n=>n.target)})), [], `${route} axe violations at ${width}`);
        }
        console.log(`PASS axe accessibility audit, all routes: ${width}px`);
      }
    }
    // Invalid startup data remains explicit and does not turn into a usable empty farm.
    await page.evaluate(() => localStorage.setItem('pondwise_v2','invalid JSON')); await page.reload();
    assert.match(await page.locator('#workspaceBanner').innerText(), /Recovery required/);
    await go('tasks'); assert(await page.locator('#entry-tasks [type=submit]').isDisabled());
    assert.deepEqual(errors, []);
    console.log('PASS calendar selection, keyboard, drafts, persistence, validation, recovery, desktop and software-keyboard checks');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
