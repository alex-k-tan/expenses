# Expenses app: put it online and install it on your iPhone

The app is 6 files in this folder (`index.html`, `manifest.json`, `sw.js`, and 3 icons). `google-sheet-sync.gs` is only for the optional sync in Step 3; it doesn't go on GitHub.
It needs to live at a web address once, then you add it to your Home Screen and it works like an app, offline too.

**The website only holds the empty app.** Your entries are stored on the phone, and in your own Google Sheet if you turn on sync (Step 3).

## Step 1: Put it online with GitHub Pages (free, about 5 minutes, on your laptop)

1. Go to https://github.com and sign up (or sign in).
2. Click the **+** at the top right, then **New repository**.
   - Name: `expenses` (anything works)
   - Choose **Public** (free Pages needs public; it's fine, no data is in the files)
   - Click **Create repository**.
3. On the new repo page, click **uploading an existing file**.
   Drag in all 6 files from this folder (not SETUP.md, though it doesn't hurt), then click **Commit changes**.
4. Go to **Settings** (tab at the top of the repo), then **Pages** in the left menu.
   Under **Branch**, pick `main` and `/ (root)`, then **Save**.
5. Wait 1 to 2 minutes and refresh. It shows your address, like
   `https://YOUR-USERNAME.github.io/expenses/`

## Step 2: Install on your iPhone

1. Open that address in **Safari** (it has to be Safari).
2. Tap the **Share** button (square with an arrow), scroll, tap **Add to Home Screen**, then **Add**.
3. Open **Expenses** from your Home Screen from now on, not from Safari.
   (The Home Screen app keeps its own data, separate from Safari, so always log from the icon.)

## Step 3 (optional): Same data on phone and laptop, via your Google Sheet

Free, about 5 minutes, on your laptop. Do this once.

1. Go to https://sheets.new to make a new Google Sheet. Name it **Expenses**.
2. In the Sheet: **Extensions > Apps Script**. Delete what's in the editor, then paste in everything from `google-sheet-sync.gs`.
3. On the line `const SECRET = '...'`, replace the text between the quotes with your own sync key, like a password (e.g. `blue-mango-4821`). Click the save icon.
4. Click **Deploy > New deployment**. Click the gear next to "Select type" and choose **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**, then **Authorize access** and pick your Google account.
   - Google warns "Google hasn't verified this app". That's normal for your own script: click **Advanced**, then **Go to ... (unsafe)**, then **Allow**.
5. Copy the **Web app URL** (ends in `/exec`).
6. In the Expenses app on your phone: **Export tab > Sync with Google Sheet**. Paste the URL, type your sync key, tap **Connect**.
7. On your laptop, open your GitHub Pages link in any browser and connect the same way. Both now share the same data.

Good to know:
- Entries sync within seconds when online, and the app checks for changes every minute while open. Offline, entries are kept and sent later.
- The Sheet has tabs **Expenses**, **Reimbursements** and **Settings**. You can edit amounts, descriptions, categories, dates and the Reimbursed on column in the Sheet; the app picks it up. You can also type a new row (Date, Time, Amount, Description, Category) and it gets added.
- Delete expenses in the app, not by deleting Sheet rows. Deleted ones stay in the Sheet in grey strikethrough so every device knows they're gone.
- Keep the URL and sync key private.
- New phone? Install the app, connect with the same URL and key, done.

## Using it

- **Log:** type the amount, a few words, tap *Log it*. Date and time are added automatically and the category is guessed.
  Shortcut: just type `45k nasi goreng` in the description box. `k`, `rb`, `jt` all work.
  Tap a category chip to override the guess; the app remembers your correction next time.
- **Spending:** totals by category for this month, last month, this year, or all time.
- **Reimburse:** shows what Dad still owes. Tick the expenses he paid back (or *Select all*), set the date, tap *Mark selected as reimbursed*. Past batches are listed with an *Undo*.
- **All:** every entry line by line, with search and filters. Tap any line to edit amount, description, category, date, time, reimbursable status, or delete it.
- **Export:** *Export all to Excel (CSV)* opens the share sheet. AirDrop or email it to your laptop and open it in Excel. Columns: Date, Time, Amount, Currency, Description, Category, Reimbursable, Reimbursed, Reimbursed on, Month (handy for pivot tables).
  Mark a personal expense as not reimbursable in its edit screen and it stays out of Dad's total.

## Keep a backup

Without sync, everything lives only on the phone. Once a month, tap **Export > Save backup file** and save it to iCloud Drive / Files.
If you ever change phones, install the app again and use **Restore from backup**.

## Updating the app later

Replace the changed files in the GitHub repo (Add file > Upload files). Open the app twice and it picks up the new version. Your data stays.
