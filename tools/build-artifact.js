// Turns index.html into a page fragment for a claude.ai Artifact (which adds its own
// <html>/<head>/<body>). Sections between ARTIFACT:PAUSE and ARTIFACT:RESUME are dropped.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let on = false, out = [];
for (const line of src.split('\n')) {
  if (/<!--ARTIFACT:(START|RESUME)-->/.test(line)) { on = true; continue; }
  if (/<!--ARTIFACT:(END|PAUSE)-->/.test(line)) { on = false; continue; }
  if (on) out.push(line);
}
const dist = path.join(root, 'dist-artifact');
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), out.join('\n'));
fs.copyFileSync(path.join(root, 'words.json'), path.join(dist, 'words.json'));
console.log('wrote dist-artifact/index.html');
