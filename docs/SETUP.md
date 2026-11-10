# RedHawks F&B Scheduler: setup and demo

The app runs on Google Sheets. The sheet is the database; a web page on top of it is what you and your staff use.

Sheet: https://docs.google.com/spreadsheets/d/1g__pB_WyjE1m87DZCNbBPAfpec0wlyEHbABRBUwLDFE/edit

## One-time setup (about 10 minutes, on a computer)

1. Open the sheet. Go to **Extensions > Apps Script**.
2. In the editor, replace everything in `Code.gs` with the contents of **Code.gs** from this folder. Click Save.
3. Click the **+** next to Files, choose **HTML**, and name it exactly `App`. Replace its contents with **App.html** from this folder. Save.
4. Click **Deploy > New deployment**. Click the gear next to "Select type" and choose **Web app**.
   - Description: RedHawks Scheduler
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click Deploy, then **Authorize access**. Google warns that the app isn't verified because it's your own script: click **Advanced > Go to RedHawks F&B Scheduler (unsafe) > Allow**.
5. Copy the **Web app URL**. That link is the app.
   - Manager screens: the link as is.
   - Staff phone page: the same link with `?page=staff` on the end. The Staff screen in the app shows it with a Copy button.
6. Back in the sheet, reload the page. A **RedHawks Scheduler** menu appears. Choose **Set admin PIN for the web app** and pick a PIN. Until you do, the PIN is `redhawks`.

After changing the code later, use **Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy** so the same link picks up the change.

## What's in the sheet

| Tab | What it holds |
|---|---|
| Schedule | Your grid: one row per person, one column per home game. Same colors as your old sheet. Rows 6-8 are the party decks: type the group's name when a deck sells. |
| Availability | Y or N per person per game. Staff fill this in from their phones. |
| Staff | Home spot, "only works home spot" (grandfathered), roles they can work, spots they won't work, spots they prefer, phone. |
| Spots | Every stand and how many people it needs. "Party deck" spots only count when the deck is sold. |
| Games | Home schedule. Swap in the 2027 dates here when you have them; everything else follows. |

Rows on Schedule, Availability and Staff line up by position. Add new people at the bottom of Staff, then run **RedHawks Scheduler > Add rows for new staff**.

## How auto-fill decides

1. People locked to their stand get it whenever they're available.
2. Everyone else with a home spot gets it if they're available and it has room.
3. Remaining open spots are filled hardest-first (the spot with the fewest people who could work it), picking whoever prefers that spot, then alternates, then whoever has worked the fewest games so far.
4. Nobody is ever placed where they said they won't work, on a game they marked N, or in a role they can't do.
5. Anything you've already typed in a cell (including OFF) is left alone.

## Demo script for Thursday

1. **Game day:** pick Fri 5/22 (home opener). Show the yellow "available" people, then press **Auto-fill this game**. Point out the badge showing what's still open and why.
2. **Someone drops:** tap a name > **Dropped: find a replacement**. The list shows only people who are free, qualified and willing, ranked. Tap **Text & ask** (opens a pre-written text on your phone, marks them blue) or **Assign**.
3. **Party deck sells:** tap **Deck sold**, type the group, and let it fill the pourers.
4. **Season:** the whole grid in your colors. **Auto-fill every game** builds the season in seconds.
5. **Staff phone page:** open the `?page=staff` link on a phone, pick a name, enter the last 4 of their phone (demo: Taylor Brekke, 6568). Show availability, preferred and no-go spots, and their shifts.
6. **Problems:** checks for anyone scheduled while unavailable, in a no-go spot, or outside their locked stand.

## Demo data

Games are your real 2026 home schedule. Staff names and phone numbers are made up (701-555 numbers), and availability is random. Replace the Staff and Games tabs with real data when you're ready.

## Working with ChatGPT and Gemini

- **ChatGPT:** Settings > Connectors > Google Drive, then point it at this sheet.
- **Gemini** (formerly Duet AI) works inside Google Sheets directly.
- Everyone works in the same sheet, so there's one file of record.

## Later, not needed for Thursday

- Automatic texts (needs a Twilio account, a few cents per text).
- GPT inside the app, such as drafting shift messages (needs an OpenAI API key).
- Separate data per team for other clubs.
