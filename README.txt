Memory cloud sync patch

1. In the GitHub repository tsta32/memory-app, add this file at the repository root as:
   sync-bootstrap.js
   Use the contents of this file.

2. Open index.html and find the existing line:
   <script src="app.js"></script>

3. Replace only that line with:
   <script src="sync-bootstrap.js"></script>

4. Commit the changes. Do not replace app.js or the rest of index.html.

The bootstrap uses the existing Worker:
https://toeic-cloud-sync.tsta32.workers.dev/

It syncs these localStorage keys:
- srs_cards_v2
- srs_chapters_v1
- srs_settings_v1
- srs_notes_v1
- srs_trends_v1
- srs_biz_sessions_v1

On the first device, enter a private shared sync code of 12–80 characters using letters, numbers, underscore, or hyphen. Enter the exact same code on the second device. The code is a bearer secret: anyone who knows it can access that shared data.

Local learning remains available if the network fails. Uploads are delayed briefly after changes; the other device checks for changes every 20 seconds and reloads to apply remote state. Avoid editing data on both devices simultaneously, because this simple snapshot sync can cause one device's recent changes to be overwritten.
