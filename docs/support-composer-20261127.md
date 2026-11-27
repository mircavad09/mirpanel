# Support composer — 2026-11-27

Scope: customer support composer, shared emoji/attachment UI, local public emoji assets.

- Removed permanent password/card/code warning and file-format hint from the composer. Bot/server privacy guidance and upload authorization/validation remain unchanged.
- Added filled right-facing send SVG, empty/busy disabling, retained failed drafts and idempotent retry. Preserve failed-send feedback during background polling.
- Self-hosted Unicode emoji data (emoji-picker-element-data 1.9.0, Apache-2.0), accessible search/category/recent/tone panel. No third-party runtime requests, IndexedDB dependency, Apple artwork, paid service or message schema change.
- Apple platforms use native Apple emoji. Other platforms show self-hosted Noto SVG (Google Apache-2.0); sprite-derived files from @svgmoji/noto 3.2.0 retain MIT license. Remaining newer SVGs from Google Noto main/2D/svg. One new Sark flag falls back to the device's Unicode rendering.
- SVGs are individual emoji extractions without shape changes. Sources: https://github.com/googlefonts/noto-emoji and https://github.com/svgmoji/svgmoji . License files ship beside assets. Base data: https://github.com/nolanlawson/emoji-picker-element-data .
- Emoji stays Unicode in transport, DB and copied message text. Artwork is a presentation layer with accessible text preserved.
- Topic scrollbar hidden; touch/trackpad and bounded mouse-wheel horizontal scrolling remain.
- Public asset route is limited to named data/license files and hex-only SVG filenames. Existing support ACL/CSRF/file checks retained.

Verification: Chrome/WebKit 320/390/430/1440 local UI fixtures; real isolated PostgreSQL customer/admin transport including PDF/PNG/reply and sound tests; no production customer messages or financial writes. Physical iPhone not tested. Live asset/read-only proof recorded separately in outputs, with synthetic API interception clearly identified.
