// Run with Playwright installed: node tests/coloring-regression.cjs <site-url>
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const seeds = JSON.parse(fs.readFileSync(path.join(__dirname, 'coloring-seeds.json')));
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/coloring/catalog.json')));
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.argv[2] || 'http://localhost:8080');
  await page.waitForFunction(() => ready);
  await page.evaluate(() => document.body.classList.remove('at-home'));
  for (const item of catalog) {
    await page.evaluate(async id => {
      await restore({ scene: id, fills: [] });
      chooseColor('#ff7399');
      setTool('fill');
    }, item.id);
    await page.mouse.click(5, 5);
    const body = await page.evaluate(points => {
      if (svg.querySelector('[data-region="sky"]').getAttribute('fill') !== '#ff7399') throw Error('background was not filled');
      return points.map(([x, y]) => {
        const screen = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM());
        const r = canvas.getBoundingClientRect();
        const id = startRegion({ x: (screen.x-r.left)/r.width*canvas.width, y: (screen.y-r.top)/r.height*canvas.height });
        if (id === 'sky') throw Error(`background leaked into character at ${x},${y}`);
        if (svg.querySelector(`[data-region="${id}"]`).getAttribute('fill') !== 'white') throw Error(`character changed with background at ${x},${y}`);
        return { id, x: screen.x, y: screen.y };
      });
    }, (seeds[item.id]||seeds[item.simpleOf])).catch(error => { throw Error(`${item.id}: ${error.message}`); });
    await page.evaluate(() => chooseColor('#74b9ed'));
    await page.mouse.click(body[0].x, body[0].y);
    const independent = await page.evaluate(id => svg.querySelector(`[data-region="${id}"]`).getAttribute('fill') === '#74b9ed' && svg.querySelector('[data-region="sky"]').getAttribute('fill') === '#ff7399', body[0].id);
    if (!independent) throw Error(`${item.id}: character/background fills are coupled`);
    console.log('PASS', item.id);
  }
  if (errors.length) throw Error(errors.join('; '));
  console.log('PASS all 37 semantic character/background regressions');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
