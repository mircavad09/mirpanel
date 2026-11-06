# Cart grouping and customer WhatsApp details — 2026-11-06

Scope: protected cart metadata/grouping and the existing customer send action.
No visual, payment transaction, inventory, wallet, employee or Gmail changes.
No migration is required.

Before-change reproduction (`test-cart-details-summary.mjs --baseline`, released
120afc9 cart): two identical additions made two rows; submitted WhatsApp omitted
the saved Netflix PIN. Protected draft persistence itself already worked.

Draft saves/listing now provide a keyed opaque comparison identifier. Client
metadata tracks source draft IDs so deliberate identical additions increase the
quantity, while retries of the same save do not. Different details stay separate.
Old cart references are restored/enriched without copying plaintext values into
browser storage. Editing/deleting grouped lines retires superseded references.
Late restoration cannot overwrite a newer local edit. Field definitions, labels,
PIN validation and encryption continue to use the existing catalog contract.

The customer submit action builds the requested numbered summary from the saved
order snapshot, including only declared checkout fields and the bank's name/last4.
Ordinary reads/admin lists do not generate plaintext WhatsApp messages; the
existing fallback button resolves via an owner-checked no-store redirect. Stock
passwords, 2FA and employee notes are not sources for this summary.

Verification (isolated PostgreSQL + loopback browser/private receipt storage):
- 32 targeted checks, including baseline proof, identical/different details,
  masked browser storage, legacy restore, edits, ownership and one order/slot.
- 49 end-to-end Chrome viewport checks at 390/1440: normal order entry, draft and
  submit response loss/retry, refresh/edit PIN 0012, grouped quantity, receipt
  upload/storage, one parent order and outgoing synthetic WhatsApp field contents.
- 40 existing cart transaction/encryption/inventory/wallet checks.
- 72 warning/normal entry checks at 320/360/390/430/1440 and 7 field-editor checks.
- Payment proxy regression and existing single-product WhatsApp formatter pass.

No real customer order, receipt, reservation, balance or Gmail queue mutation was
used for testing. Viewport tests are not physical Android/iPhone tests.
