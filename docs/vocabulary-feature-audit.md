# Vocabulary restoration audit

Baseline: `1e939f9:wordbook.html`, with its complete `app.js` and `docx.js` engines. The prior SPA had replaced `wordbook.html` with a redirect. This change restores the complete vocabulary workflow in a new library layout.

## Feature parity

- All 117 original vocabulary HTML control IDs are present. No original editor, picker, practice, dictionary or export controls were removed.
- Collection: select words from pasted problem statements; join copied line wraps; hide basic words; select all/clear; identify the dictionary lemma, part of speech and Chinese meaning; review candidates; change candidate inclusion, lemma, meaning, part of speech and notes; preserve the original sentence; merge repeated examples into the existing word.
- Manual collection and editing: dictionary link, inflection hint, AI Chinese interpretation, spelling, part of speech, meaning, multiple examples and notes. Delete remains explicit and confirmed.
- Batch input accepts pipe or tab columns and multiple examples. JSON import supports both existing field names and the legacy `spelling`/`cn`/`example` aliases. JSON backup includes the full vocabulary.
- Word export uses the original OOXML renderer without simplifying its design. It retains title, scope, sorting and direction, classic versus complete layout, 1–4 columns, fixed rows per column, meaning/part of speech/notes/examples/index switches, checkboxes and page numbers.
- Reading: search word/meaning/example; weak-word filter; time/alphabetical/frequency/random sorting and direction; cards/list; per-row count; hide meaning/examples; word detail; pronunciation and US/UK accents; IPA, English definitions, spelling segments, roots, derivations, synonyms/antonyms and Cambridge dictionary links.
- Practice: English→Chinese and Chinese→English; random/sequential order; all/filtered/weak scopes; reveal; known/unknown judgement; keyboard shortcuts; saved review counts; clear review history. Existing activity storage is preserved.
- New controls: selected-word export; compact/comfortable density; explicit automatic-toolbar-hide setting (off by default); spelling practice; manual selected-word interpretation when AI is unavailable.

## Performance and correctness

- Word export's ZIP library is loaded only when exporting.
- New words use a single write when the full library has loaded; a duplicate conflict is resolved by fetching and merging the current server record. Known duplicates are refreshed before merging to protect examples added on another device.
- Successful saves update the displayed library and authenticated session cache directly, without reloading the entire word table.
- Batch/picker/JSON writes use up to three parallel requests, grouped by normalized word. Failed records are retained for retry or downloaded as retry JSON; successful records are shown immediately after the group finishes.
- Fixed the original batch/picker/JSON counter bug that compared a returned object with the string `created`.
- In-flight initial reads cannot overwrite newer successful local mutations. Session resets clear selections and state.
- Search renders on the next animation frame. The initial list is bounded to 96 cards with an explicit load-more control; filtering, practice and export still use the entire result set.
- Alphabetical ascending/descending now matches the direction labels. Empty export or weak-word scopes no longer silently export/practice all words.

## Local verification

Verified against the in-memory demo server at port 8791, without production database writes:

- New-word save makes one insert and no duplicate read after the initial load.
- Duplicate merge preserves two exact example sentences.
- Batch duplicates merge correctly, preserve nonempty metadata and report the correct created count.
- Sentence AI receives original context; the returned lemma can be edited before saving; the saved example remains the user's original text.
- Selected-word DOCX is a valid ZIP/OOXML document containing the configured title, selected word, original example and footer; unselected words are absent.
- Spelling exercise gives correct feedback and updates the known counter; restarting re-enables the answer input.
- Desktop rendering and a 390px mobile layout have no browser script errors or horizontal overflow.
- Visitors have no edit/add controls, and the server rejects a visitor write with HTTP 403.

AI interaction used a local deterministic response to validate the UI and request contract. Live model availability, pronunciation voices and external dictionary availability depend on their existing services/browser support. The actual DOCX download was inspected as OOXML, not opened in desktop Microsoft Word.
