// Smoke test: serves the folder, plays games in a phone-sized headless browser.
//   npm test   (needs Playwright with Chromium installed)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium, devices } = require('playwright');
const root = path.join(__dirname, '..');
const types = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(data); });
}).listen(0);
const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };

(async () => {
  const url = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => !document.getElementById('loading'));

  const L = await page.evaluate(() => {
    const { score, encodeWord, decodeWord, hardModeProblem } = window.__guesswork;
    return {
      dup1: score('speed', 'abide').join(','),
      dup2: score('eerie', 'there').join(','),
      dup3: score('lolly', 'hello').join(','),
      code: decodeWord(encodeWord('plant')),
      badCode: decodeWord('ABCDEF'),
      hard: hardModeProblem('crane', { word: 'plant', guesses: ['plush'] })
    };
  });
  assert(L.dup1 === 'miss,miss,near,miss,near', 'scoring: speed vs abide ' + L.dup1);
  assert(L.dup2 === 'near,miss,near,miss,hit', 'scoring: eerie vs there ' + L.dup2);
  assert(L.dup3 === 'miss,near,hit,hit,miss', 'scoring: lolly vs hello ' + L.dup3);
  assert(L.code === 'plant', 'challenge code round-trips');
  assert(L.badCode === null, 'bad challenge code rejected');
  assert(/1st letter must be P/.test(L.hard || ''), 'hard mode enforces greens: ' + L.hard);

  // close help, play a game to a win by cheating the stored word
  await page.click('#hPlay');
  // tap-to-edit: type MOUSE, tap square 1, press H -> HOUSE; tap square 3, Delete clears only that square
  for (const c of 'mouse') await page.click(`.key[data-k="${c}"]`);
  const rowText = () => page.evaluate(() => [...document.querySelectorAll('.row.current .tile')].map(t => t.textContent || '_').join(''));
  await page.click('.row.current .tile >> nth=0');
  await page.click('.key[data-k="h"]');
  assert(await rowText() === 'house', 'tap a square and retype one letter: ' + await rowText());
  await page.click('.row.current .tile >> nth=2');
  await page.click('.key[data-k="back"]');
  assert(await rowText() === 'ho_se', 'delete clears just the selected square: ' + await rowText());
  await page.click('.key[data-k="u"]');
  assert(await rowText() === 'house', 'typing fills the cleared square');
  for (let i = 0; i < 5; i++) await page.click('.key[data-k="back"]');
  assert(await rowText() === '_____', 'delete still clears the row from the end');
  const word = await page.evaluate(() => JSON.parse(localStorage.getItem('guesswork.v1')).players[0].game.word);
  const type = async w => { for (const c of w) await page.click(`.key[data-k="${c}"]`); await page.click('.key[data-k="enter"]'); };
  await type('zzzzz');
  await page.waitForTimeout(300);
  assert((await page.locator('.toast').allTextContents()).some(t => /Not in our word list/.test(t)), 'invalid word rejected');
  for (let i = 0; i < 5; i++) await page.click('.key[data-k="back"]');
  await type(word === 'about' ? 'house' : 'about');
  await page.waitForTimeout(2000);
  await type(word);
  await page.waitForSelector('dialog[open] #rNext', { timeout: 6000 });
  const title = await page.textContent('#dlgTitle');
  assert(/!/.test(title), 'win dialog shown: ' + title);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('guesswork.v1')).players[0].stats[5]);
  assert(st.won === 1 && st.dist[1] === 1 && st.streak === 1, 'stats recorded');
  await page.screenshot({ path: process.env.SHOT || path.join(root, 'dist-artifact', 'win.png') });
  await page.click('#rNext');
  const w2 = await page.evaluate(() => JSON.parse(localStorage.getItem('guesswork.v1')).players[0].game.word);
  assert(w2 && w2 !== word, 'next word started');

  // reload resumes; challenge link prompts
  await page.goto(url + '#play-' + await page.evaluate(() => window.__guesswork.encodeWord('tiger')));
  await page.waitForSelector('dialog[open] [data-pl]');
  await page.click('dialog[open] [data-pl]');
  const w3 = await page.evaluate(() => JSON.parse(localStorage.getItem('guesswork.v1')).players[0].game);
  assert(w3.word === 'tiger' && w3.challenge, 'challenge link loads the word');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert(!overflow, 'no horizontal scroll');
  assert(!errors.length, 'no page errors ' + errors.join('; '));
  await browser.close(); server.close();
})();
