# Working on the RedHawks F&B Scheduler

Read this before changing anything. It applies to every AI assistant (Claude, ChatGPT/Codex, Gemini) and every person.

## What this is
A staff scheduling tool for the Fargo-Moorhead RedHawks food and beverage department. Google Sheets is the database; a Google Apps Script web app on top of it is what the manager and staff use (staff mostly on phones). Will (Director of F&B) owns it.

- `src/Code.gs`: server side (Apps Script, V8). Sheet menus, auto-fill, replacement finder, problem checks, the web app's API (`doGet` and the functions `App.html` calls with `google.script.run`).
- `src/App.html`: the whole web app (manager screens plus the `?page=staff` phone page) in one file.
- `src/appsscript.json`: Apps Script manifest (time zone, web app access).
- `docs/SETUP.md`: how the sheet and web app are set up, and the demo script.

## Sheet layout the code depends on
Tabs: Schedule, Availability, Staff, Spots, Games. Rows on Schedule, Availability and Staff line up by position. Column and row positions live in `CFG` at the top of `Code.gs`. If you change the sheet layout, change `CFG` in the same pull request and say so.

## Scheduling rules (do not weaken these)
1. Never place someone on a game they marked N, in a spot they won't work, or in a role they can't do.
2. Staff locked to their home spot only ever work that spot.
3. Never overwrite a cell someone typed by hand (including OFF).
4. Party deck spots only count when the deck is sold.

## How to work
- Never commit to `main` directly. Make a branch, open a pull request, and explain in plain words what changes for Will and the staff.
- Keep `Code.gs` and `App.html` as single files: Apps Script has no build step here and the files are copied as they are.
- Run `bash scripts/check.sh` before opening a pull request (CI runs it too).
- Don't add libraries, external services, API keys or new Google permissions without asking Will in the pull request first.
- Staff names and phone numbers in the demo sheet are made up. Never commit real staff phone numbers or emails to this repo.
- Merging to `main` does not change the live app. Will deploys from the Actions tab (Deploy to Apps Script).
