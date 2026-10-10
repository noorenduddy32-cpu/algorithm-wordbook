# Article workspace feature audit

Baseline: the full article engine and `notes.html` at `1e939f9`, with the earlier rich editor controls checked against `446127c^`. The former SPA replacement had redirected `notes.html` and bypassed this engine.

## Preserved and accessible

- Search title, tags and body; algorithm topic filters; published/draft tabs and counts.
- List, grid, adjustable grid columns and board layouts; creation/update/view sorting and direction.
- Checkbox selection, select all current results and bulk Word export.
- Board column creation, ordering and deletion; administrator drag-to-file between columns.
- Public/private visibility, drafts, publish/update/delete, visitor read-only access, private content exclusion.
- Rich HTML body, metadata, summary, tag input, searchable preset algorithm tag library.
- Undo/redo, modification timestamps, body and H1–H5 formats, bold, italic, underline, strike, clear formatting, text/highlight colors, alignment, lists, quote and divider.
- Inline code and formula text, selected-language code block modal, Tab indentation, syntax highlighting, line numbers, copy, wrap and long-block expand/collapse.
- Keyboard accessible 6 × 8 table size picker; editable table cells; table alignment and saved HTML round trip.
- Links and images by URL, pasted rich HTML, pasted/dropped embedded images; local image picker added.
- Problem/algorithm templates plus the original full problem-solution template.
- AI continue, improve, outline, explain, summarize and title actions, connected to the existing authenticated cloud AI API.
- Markdown/HTML/text import and HTML export; current-article Word export added alongside bulk export.
- Reading outline, word count, reading time, reading font preference, public article deep links and visit reporting.
- Local draft snapshot, 15-second cloud autosave, unsaved changes guard, Ctrl+B/I/K/S shortcuts.

No original `id` from the baseline article HTML was removed. There are no duplicate element IDs.

## Layout and performance changes

- Rebuilt the library as a compact 224px filtering rail and full-width result workspace; 32px heading, quiet list rows, metadata separated from title and summary.
- Rebuilt the editor as a document surface with visible formatting/insertion controls, a 760px reading column and a separate outline.
- Added edit/split/preview modes; all use the same sanitized saved content.
- JSZip and the article Word exporter load only when a user requests Word output.
- Editor preview work is debounced by 140ms. Hidden previews are not rebuilt/highlighted on each keystroke.
- Search rendering is debounced by 100ms. Role-verified session data still renders before background refresh.
- Preserved toolbar selection across popovers/dialogs, fixed copy to use the current edited code, and prevented async image/import/AI results from entering a different editor session.
- Word output now preserves code line breaks, heading sizes/styles, real list numbering and exact table column widths.

## Local verification

Executed against `scripts/demo.cjs`, which uses an in-memory fixture and no production data. The Python Playwright package was unavailable, so the bundled Node Playwright runtime was used with the managed local demo helper.

Passed browser checks:

- Publish and reopen a 3 × 4 editable table with cell content.
- Publish and reopen a 14-line C++ block; line numbers, highlighting, expand/collapse and wrap.
- Split preview contains the same table and code as the editor.
- AI action picker enables the requested action; the actual remote AI service was not called in the fixture.
- Generate/download the current article as a `.docx`.
- Create a board column; search reduces the visible result set correctly.
- 390px mobile layout has no horizontal document overflow.
- Visitor session sees only four public fixture notes, cannot see the editor toolbar or publish/new controls.
- No browser JavaScript errors in the checked flow.

Word package checks: all XML and relationship files parse; one 3 × 4 table is present; 13 code line breaks are retained; table grid widths total 9638 DXA; styles and numbering package parts are present. A desktop Word/LibreOffice renderer was unavailable, so a native Word visual rendering was not performed.

Syntax checks passed for `notes.js` and `notes_docx.js`.
