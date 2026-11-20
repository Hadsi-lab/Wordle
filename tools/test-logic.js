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
  // ---- Hangman
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('guesswork.v1')).players[0]);
  await page.click('#modes [data-mode="hangman"]');
  assert(await page.isVisible('#hang') && !(await page.isVisible('#board')), 'hangman mode shows the drawing, hides the board');
  let hg = (await state()).hang.game;
  assert(hg && hg.lives === 8 && hg.guessed.length === 0, 'hangman game starts with 8 lives by default');
  assert(await page.locator('.hp.on').count() === 3, '8 lives: base, post and beam pre-drawn');
  const wrongLetter = [...'zqxjkvwy'].find(c => !hg.word.includes(c));
  await page.click(`.key[data-k="${wrongLetter}"]`);
  assert(await page.locator('.hp.on').count() === 4, 'a wrong letter draws one more part');
  assert(await page.isDisabled(`.key[data-k="${wrongLetter}"]`), 'used letter key is disabled');
  for (const c of new Set(hg.word)) await page.click(`.key[data-k="${c}"]`);
  await page.waitForSelector('dialog[open] #rNext', { timeout: 5000 });
  let hs = (await state()).hang.stats;
  assert(hs.won === 1 && hs.misses === 1 && hs.streak === 1, 'hangman win recorded with 1 mistake');
  assert((await state()).history[0].m === 'hang', 'hangman game in recent words');
  // lose with classic 6 lives
  await page.click('#dlgClose');
  await page.click('#btnSettings');
  await page.click('[data-seg="lives"] [data-v="6"]');
  await page.click('#dlgClose');
  await page.click('#aNext');
  hg = (await state()).hang.game;
  assert(hg.lives === 6 && await page.locator('.hp.on').count() === 5, '6 lives: whole gallows pre-drawn ' + hg.lives + ' ' + await page.locator('.hp.on').count() + ' ' + hg.guessed.join(''));
  const wrongs = [...'abcdefghijklmnopqrstuvwxyz'].filter(c => !hg.word.includes(c)).slice(0, 6);
  for (const c of wrongs) await page.click(`.key[data-k="${c}"]`);
  await page.waitForSelector('dialog[open] #rNext', { timeout: 5000 });
  assert(/Not this time/.test(await page.textContent('#dlgTitle')), 'losing after 6 mistakes');
  assert(await page.locator('.hp.on').count() === 11 && await page.isVisible('#faceLost'), 'full figure drawn on loss');
  hs = (await state()).hang.stats;
  assert(hs.played === 2 && hs.streak === 0, 'hangman loss resets streak');
  await page.click('#dlgClose');
  // switching back keeps the words game
  await page.click('#modes [data-mode="words"]');
  assert(await page.isVisible('#board') && (await state()).game.word === 'tiger', 'switching back to Words resumes that game');
  // hangman challenge link with a long custom word
  await page.goto(url + '#hang-' + await page.evaluate(() => window.__guesswork.encodeWord('dinosaurs')));
  await page.waitForSelector('dialog[open] [data-pl]');
  await page.click('dialog[open] [data-pl]');
  const after = await state();
  assert(after.mode === 'hangman' && after.hang.game.word === 'dinosaurs' && after.hang.game.challenge, 'hangman challenge link loads a 9-letter word');
  await page.screenshot({ path: (process.env.SHOT || path.join(root, 'dist-artifact', 'win.png')).replace('.png', '-hang.png') });

  // ---- Set a word on this phone, then hand it over
  await page.click('#aSet');
  await page.fill('#swWord', 'gir4ffe');
  await page.click('#swGo');
  assert(/3 to 12 letters/.test(await page.textContent('#swErr')), 'set a word: rejects non-letters');
  await page.fill('#swWord', 'Giraffe');
  await page.fill('#swClue', 'An animal with a very long neck');
  await page.click('#swLives [data-v="10"]');
  await page.click('#swGo');
  await page.waitForSelector('#hoGo');
  assert(!/giraffe/i.test(await page.textContent('#dlgBody')), 'hand-off screen does not reveal the word');
  await page.click('#hoGo');
  let sg = (await state()).hang.game;
  assert(sg.word === 'giraffe' && sg.lives === 10 && sg.challenge, 'set word starts with chosen lives');
  assert(/very long neck/.test(await page.textContent('#hangClue')), 'clue is shown under the word');
  assert(await page.locator('.hp.on').count() === 1, '10 lives: only the base is pre-drawn');
  for (const c of 'girafe') await page.click(`.key[data-k="${c}"]`);
  await page.waitForSelector('dialog[open] #rNext', { timeout: 5000 });
  assert(/Flawless/.test(await page.textContent('#dlgTitle')), 'set word can be solved');
  await page.click('#dlgClose');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert(!overflow, 'no horizontal scroll');
  assert(!errors.length, 'no page errors ' + errors.join('; '));
  await browser.close(); server.close();
})();
