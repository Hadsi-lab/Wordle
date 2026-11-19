// Builds words.json from the SCOWL word lists (npm package "wordlist-english").
//
//   npm install && npm run build:words
//
// Answers come only from common words (SCOWL levels 10-50) and skip plurals,
// past tenses, -ing forms and anything on the family-safe blocklist.
// Guesses accept a much larger list, in American, British, Canadian and
// Australian spellings, so real words are not rejected.

const fs = require('fs');
const path = require('path');

const dir = path.dirname(require.resolve('wordlist-english/package.json'));
const load = (dialect, level) => {
  try { return JSON.parse(fs.readFileSync(path.join(dir, `${dialect}-words-${level}.json`), 'utf8')); }
  catch { return []; }
};

const LENGTHS = [4, 5, 6, 7];
const LEVELS = [10, 20, 35, 40, 50, 55, 60, 70];
const DIALECTS = ['english', 'american', 'british', 'canadian', 'australian'];
const ANSWER_DIALECTS = ['english', 'australian'];

// Tier for answers: easy = levels 10-20, normal adds 35, tricky adds 40-50.
const TIER_OF_LEVEL = { 10: 0, 20: 0, 35: 1, 40: 2, 50: 2 };

// Words never used as answers or accepted as guesses: profanity, slurs and
// topics we don't want a 10-year-old to be handed as the answer.
const BLOCK = new Set(`
anal anus arse arses arsed bitch bitchy boob boobs booby bonk butt butts cock cocks coon crap crappy cum cunt
damn damned dick dicks dildo dyke fag fags faggot fanny feck fuck fucks fucked fucker gook homo hooker horny
jizz kike kinky knob lesbo milf nazi nazis negro nigga nigger nympho orgy orgasm penis penile pimp piss pissed
poof poofs poofter porn porno prick pube pubes pubic queer rape raped raper rapes rapist screw scrot scrotum
semen sexy shag shags shit shits shitty skank slag slut sluts smut spic spunk tit tits titty tosser turd twat
vagina vulva wank wanks wanker whore whores wog wop
booze drunk drunks heroin cocaine stoned stoner opium suicide murder killer slave slaves sexist sexual sexes
coitus erotic erect erotica lust lusty bimbo hussy harlot strip stripper incest fetish pervert perv pervy
bloody bugger buggers sod sodding bollock bollocks bastard bastards dammit hell hells corpse gonad gonads
gonna gimme wanna gotta dunno kinda sorta outta lotta goodo yeah nope dude
tampon breast breasts nipple nipples crotch condom condoms bra bras viagra
`.split(/\s+/).filter(Boolean));

const clean = w => /^[a-z]+$/.test(w);

const all = new Set();
for (const d of DIALECTS) for (const lv of LEVELS) for (const w of load(d, lv)) if (clean(w)) all.add(w);

// Every word at its most common level (answers dialects only).
const answerLevel = new Map();
for (const d of ANSWER_DIALECTS) for (const lv of LEVELS) for (const w of load(d, lv)) {
  if (!clean(w)) continue;
  if (!answerLevel.has(w) || answerLevel.get(w) > lv) answerLevel.set(w, lv);
}

const isWord = w => all.has(w);
const VOWEL = /[aeiou]/;
function inflected(w) {
  // plural / third person
  if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) {
    if (isWord(w.slice(0, -1))) return true;
    if (w.endsWith('es') && isWord(w.slice(0, -2))) return true;
    if (w.endsWith('ies') && isWord(w.slice(0, -3) + 'y')) return true;
  }
  // past tense
  if (w.endsWith('ed')) {
    const b = w.slice(0, -2);
    if (isWord(b) || isWord(b + 'e') || isWord(w.slice(0, -1))) return true;
    if (b.length > 2 && b.at(-1) === b.at(-2) && isWord(b.slice(0, -1))) return true;
    if (w.endsWith('ied') && isWord(w.slice(0, -3) + 'y')) return true;
  }
  // -ing
  if (w.endsWith('ing') && w.length >= 6) {
    const b = w.slice(0, -3);
    if (isWord(b) || isWord(b + 'e')) return true;
    if (b.length > 2 && b.at(-1) === b.at(-2) && isWord(b.slice(0, -1))) return true;
  }
  // -er / -est comparatives of short adjectives (bigger, nicest)
  if (w.endsWith('est') && (isWord(w.slice(0, -3)) || isWord(w.slice(0, -2)))) return true;
  return false;
}
function plausible(w) {
  if (!VOWEL.test(w) && !w.includes('y')) return false; // "crwth", "nth"
  return true;
}

const out = { v: 1, a: {}, g: {} };
const stats = {};
for (const len of LENGTHS) {
  const tiers = [[], [], []];
  for (const [w, lv] of answerLevel) {
    if (w.length !== len || !(lv in TIER_OF_LEVEL)) continue;
    if (BLOCK.has(w) || inflected(w) || !plausible(w)) continue;
    tiers[TIER_OF_LEVEL[lv]].push(w);
  }
  tiers.forEach(t => t.sort());
  const answers = new Set(tiers.flat());
  const guesses = [...all].filter(w => w.length === len && !answers.has(w) && !BLOCK.has(w)).sort();
  out.a[len] = tiers.map(t => t.join(''));
  out.g[len] = guesses.join('');
  stats[len] = { easy: tiers[0].length, normal: tiers[1].length, tricky: tiers[2].length, extraGuesses: guesses.length };
}

const file = path.join(__dirname, '..', 'words.json');
fs.writeFileSync(file, JSON.stringify(out));
console.table(stats);
console.log(`wrote ${file} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
