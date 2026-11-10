# Netflix Şəxsi room sheet

Add rooms in **Admin → Hazır hesab stoku → Netflix Şəxsi — hazır otaq stoku**.
In the normal Netflix delivery form, enter the matching account email and room
name/PIN. This binds the existing stock UUID to the delivery atomically.
Renewal uses the existing **Abunəliklərim → Yenilə** flow for that delivery.
The sheet shows a paid renewal until its fulfilled period starts in Baku.

Apply `mirpanel-admin/community/netflix-room-sheets.sql` after the room stock
migration. The worker starts only when `NETFLIX_ROOM_SHEET_ID` is set.

1. Import the empty workbook as a new native Google Sheet named
   **Netflix Şəxsi — Otaq stoku** in a private My Drive folder.
2. Enable Google Sheets API and Google Drive API for the dedicated service
   account's project. Under **Share**, set **General access → Restricted**.
   Grant **Editor** to the service account only, apart from the file owner.
3. Test the service account against a separate private copy with a synthetic
   room and no live credentials. Verify the eight headers, leading zero,
   row movement and status color. Then point `NETFLIX_ROOM_SHEET_ID` at the
   production sheet and store the service account JSON in Render's secret
   environment variable `NETFLIX_ROOM_SHEET_SERVICE_ACCOUNT`.

The writer validates sharing, title and headers before sending room data.
The workbook contains account secrets after activation. Use filter views for
sorting while the worker runs, or pause the worker before physically moving rows.
The stock record, payment and renewal are authoritative in MirPanel.
Retries use the stock UUID in column H. Expiry does not automatically release
the room. The sync checkpoint contains operational fields only.
