# Hadsi Words

A word-guessing game for phones (iPhone and Android). Guess the hidden word in six tries: green means right letter, right spot; gold means right letter, wrong spot; grey means not in the word.

It's a static web app (PWA). It needs no app store, works offline once loaded, and can be added to the home screen.

## Features
- **Unlimited games.** Tap *Next word* whenever you like.
- **Family profiles.** Each player keeps their own stats, win streak, settings and unfinished game. A *Family* table compares players.
- **Word pools:** Easy (everyday words for kids), Normal (similar to the classic game), Tricky. **Word length:** 4, 5, 6 or 7 letters.
- **Fair answers.** Answers are common words with no plurals, past tenses or -ing forms, and family-safe. Guesses accept Australian, British and American spellings.
- **Hints** (optional per player): reveal a letter, rule out 4 letters, or get a definition clue. Hints are counted in results.
- **Challenge codes and links.** Send the word you just played to someone, or type in your own word (such as a spelling-list word) for the kids to guess.
- **Meanings.** See what the word means when the game ends (needs internet), and browse recent words.
- **Hard mode**, colour-blind colours, dark mode, an option to put Enter on the right, a solve timer, vibration on Android, share grids, and saved progress.
- No ads, accounts or tracking. Everything is stored on the phone.

## Put it on your phones (GitHub Pages)
1. In the GitHub repo, go to **Settings → Pages**.
2. Under *Build and deployment*, choose **Deploy from a branch**, pick the branch with these files and the **/ (root)** folder, and save.
3. After a minute, open `https://<owner>.github.io/<repo>/` on each phone.
   - **iPhone (Safari):** Share → **Add to Home Screen**.
   - **Android (Chrome):** ⋮ menu → **Install app** / **Add to Home screen**.

GitHub Pages on a private repository needs a paid GitHub plan. You can also host this folder on any static host (Netlify, Cloudflare Pages and so on).

## Development
- `index.html` contains the whole game. `words.json` holds the word lists. `sw.js` provides offline support.
- `npm install && npm run build:words` rebuilds `words.json` from SCOWL (`tools/build-words.js`, which also has the blocklist).
- `npm test` runs a Playwright smoke test on a phone-sized screen.
- `npm run build:artifact` builds a single-page version in `dist-artifact/`.

Word lists come from SCOWL via the `wordlist-english` package (see its copyright notice).
