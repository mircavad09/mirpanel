# Netflix Şəxsi room sheet

Add rooms in **Admin → Hazır hesab stoku → Netflix Şəxsi — hazır otaq stoku**.
In the normal Netflix delivery form, enter the matching account email and room
name/PIN. This binds the existing stock UUID to the delivery atomically.
Renewal uses the existing **Abunəliklərim → Yenilə** flow for that delivery.
The sheet shows a paid renewal until its fulfilled period starts in Baku.

Apply `mirpanel-admin/community/netflix-room-sheets.sql` and
`mirpanel-admin/community/netflix-room-restock.sql` after the room stock
migration. The worker starts only when `NETFLIX_ROOM_SHEET_ID` is set.

1. Create an empty, single-tab Google Sheet in the personal owner's My Drive.
   The server sets the title and A–F headers and hides the stable row ID in G.
2. Enable Google Sheets API and Google Drive API for the dedicated service
   account's project. Under **Share**, set **General access → Restricted**.
   Grant **Editor** to the service account only, apart from the file owner.
3. Test the service account against a separate private copy with a synthetic
   room and no live credentials. Verify the eight headers, leading zero,
   row movement and status color. Then point `NETFLIX_ROOM_SHEET_ID` at the
   production sheet, set `NETFLIX_ROOM_SHEET_OWNER_EMAIL` to the personal
   owner's address, and store the service account JSON in Render's secret
   environment variable `NETFLIX_ROOM_SHEET_SERVICE_ACCOUNT`. Keep the
   JSON out of chat, source code and logs.

The writer validates sharing, title and headers before sending room data.
The workbook contains account secrets after activation. Use filter views for
sorting while the worker runs, or pause the worker before physically moving rows.
The stock record, payment and renewal are authoritative in MirPanel.
Retries use the stock UUID in hidden column G. Expiry does not automatically
release the room. The admin can choose **Yenidən satışa çıxar** and enter a
future date. That clears the current assignment without changing order history.
The sync checkpoint contains operational fields only.
