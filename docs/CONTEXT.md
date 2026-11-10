# Project context (shared memory)

This file is the shared memory for everyone working on the scheduler: Will, Claude, ChatGPT and Gemini. Read it before planning work. **If you learn something new about how RedHawks F&B scheduling works, or Will tells you a new pain point or decision, add it here in the same pull request** (or in a small PR of its own), with the date.

No phone numbers, emails or other private details of real staff go in this file.

## Who and what
- Owner: Will, Director of Food & Beverage, Fargo-Moorhead RedHawks (American Association, independent baseball), Newman Outdoor Field, Fargo ND.
- Goal: an app to schedule part-time F&B staff for home games. Beta during the 2027 season, then possibly offered to other teams.
- Users: Will (admin) plus all scheduled staff, mostly on phones.
- Runtime: Google Sheets is the database, Google Apps Script web app on top. This repo is the source of truth for the code.

## 2027 season
- May 7 to Sep 5, 2027. 102 games, about 51 at home. Opener vs Lincoln Saltdogs.
- Game times and promotions not released yet (as of 2026-10-08). Full schedule: fmredhawks.com/schedule.
- The demo sheet uses the real 2026 home schedule until 2027 dates are entered on the Games tab.

## How scheduling works today (before the app)
- Staff send availability by text or email, ideally for the whole season. Will types it into one big spreadsheet and fits people in like a puzzle.
- Spreadsheet layout: rows are staff (grouped), columns are home dates (56 in 2026 including exhibitions; doubleheader dates appear twice). Header rows: date, day, first pitch, staff report time (2 hours before), opponent/promo.
- Fill colors: green = scheduled, yellow = available but not used, red = not available, blue = reached out / asked. Purple "?" = unknown.
- Each person has a default stand/role. Text in a cell overrides it for that game (for example "Conc. Beer 6", "OFF", "Sick", "Start 7:30", "w/ Bud").
- A contact block at the top lists area leads (3rd base stands, suites, stand manager). Will covers everything.

## Areas, stands and roles
- Concourse quick-serve stands.
- Suite level: bartender, servers, full-service kitchen (cook plus backup).
- Party decks (UND Deck, Surfside Patio, Picnic): beer pourers needed only if the deck sells, often known only 1-2 days ahead. In the old sheet these are rows marked X or the buying group's name.
- Groups seen in the 2026 sheet (about 85 people): grandfathered beer-stand owners (Beer Garden, Leines, CAPS, Coors, Captains Corner, Kona, Drekker, Satellite); about 20 Alternates (Beer or Beer/Mixer) who float; Concession Beer 3-6; Concession Tills (1-13); about 17 Food Runners; Ice Cream; Dippin' Dots 1st/3rd base; Hot Dog Cart/Float; Pizza; Suites (about 9 servers/bar); Kitchen; Interns.
- Typical weekend: most alternates unavailable. When a stand owner is out (for example the Beer Garden owner), an alternate fills it with the stand name typed in the cell.

## Rules and constraints
- Some staff are grandfathered into "their" stand (usually the best people) and only work there.
- Others have spot preferences and may not show up if put somewhere they dislike.
- No-go spots are not written down anywhere; Will keeps them in his head (confirmed 2026-11-07). The app has to capture them: staff self-report on the availability form, Will reviews and edits.
- Role qualifications matter (a food runner can't be dropped in as a bartender).

## Pain points Will has named
- Collecting availability by text and email, then retyping it.
- Last-minute changes (drops, sick calls) are the biggest pain: finding someone free, qualified and willing, fast.
- Party decks selling 1-2 days out and needing pourers on short notice.
- Keeping owned stands, preferences and unwritten no-gos straight across a whole season.
- (ChatGPT: add pain points from your own chats with Will here, with dates.)

## MVP direction
- Core feature: constraint-based auto-fill that respects availability, owned stands, hard no-go spots, preferences and role qualifications, and never overwrites what Will typed.
- Fast replacement finder for drops, with a pre-written text to the candidate.
- Staff phone page for availability and seeing shifts.
- Keep data scoped per organization so other teams later are configuration, not a rewrite.

## Status and decisions log
- 2026-11-07: Will shared the 2026 spreadsheet ("8.28 Scenerio 1.xlsx"); layout above comes from it.
- 2026-11-09: Built the Google Sheet "RedHawks F&B Scheduler" plus the Apps Script web app. Demo uses real 2026 home games and made-up staff (701-555 numbers).
- 2026-11-10: Code moved to this repo. Deploys to Apps Script are manual (Actions tab) and stay off until after the demo.
- 2026-11-10: Will says the app is not complete or demo-ready yet. Demo is Thursday 2026-11-12. Gap list in progress.
- The stockroom/inventory tool is a separate project and not part of this repo.
