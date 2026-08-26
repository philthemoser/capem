# Contributing

The most valuable contribution to this project is **telling us it is wrong**.

CAPEM is a concept prototype. Nobody has run it. Every efficiency claim in it is a hypothesis. If you have worked in disaster response, your disagreement is worth more than any pull request.

## Write in whichever language you prefer

**English, Español or Português.** Do not translate your thoughts into English for our benefit — precision matters more than convenience, and something will be lost.

## What is most useful, roughly in order

1. **You have run a relief centre, a collection point or a shelter,** and something here does not match what you saw. Especially the [allocation ordering](https://philthemoser.github.io/capem/#/coord/coord-match) — the scoring weights are invented and look reasonable only because nobody has argued with them yet.

2. **You know why Aidmatrix / NDMN failed.** It did roughly the same thing a decade earlier and no longer exists. We are building on a guess about why. See [open question 8](docs/open-questions.md).

3. **The data-protection position is legally or practically wrong** in your jurisdiction. This is the part of the design where being wrong causes real harm to people who cannot complain.

4. **You have run a donation drive** and can say what fraction of donors would ever pre-register before arriving. This is the load-bearing assumption of the whole design.

5. **Something in [docs/research.md](docs/research.md) is misattributed, overstated, or out of date.** We have marked our own weak evidence as weak, but we will have missed things.

## Reporting a problem in the prototype

Include the URL — every screen has one, like `#/coord/coord-match` — plus your language, scenario, and browser. Both scenarios and all fictional data are the same for everyone, so a screen reference is usually enough to reproduce.

## Code

If you want to change the prototype:

```bash
git clone <repo> && cd capem
# edit files under src/
node build.js              # regenerates index.html
node tools/check-i18n.js   # every key exists, every row has all three languages
node tools/smoke.js        # 24 screens × 3 languages × 2 scenarios
node tools/flow.js         # 21 end-to-end assertions
node tools/nav.js          # navigation behaviour, desktop and mobile
node tools/a11y.js         # axe-core WCAG 2.1 A/AA
```

`index.html` is generated and committed. Rebuild it and include it in your change, so anyone can open the repository and see the result without running anything.

Two rules that are not negotiable:

- **No hard-coded numbers in screens.** Everything renders from the scenario data through `Sel.*`. This is what makes the figures on different screens agree, and it is the specific failure this prototype was built to avoid.
- **No new user-visible string without all three languages.** `tools/check-i18n.js` will fail the build otherwise.

If you add a screen, add it to `tools/smoke.js`. If it does something interesting, add an assertion to `tools/flow.js`.

## What we will not add

- Anything that collects more personal data than the current design.
- Anything predictive built on data this project does not have.
- Analytics, tracking, or a network request of any kind. The prototype runs entirely in the browser and should stay that way.

## Tone

Blunt is fine. Rude to the people this is meant to serve is not.
