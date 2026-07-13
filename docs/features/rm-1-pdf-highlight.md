# RM-1 · PDF viewer — highlight the cited chunk

**Status:** done · **Effort:** M · Roadmap: [../ROADMAP.md](../ROADMAP.md) → RM-1

Step 2 of the react-pdf migration. Step 1 (render the PDF + jump to the cited page) was
already shipped; this step highlights the exact retrieved chunk text(s) on that page.

---

## 1. What it's for

When the assistant answers, every answer carries **source citations** (file + page). Before
this feature, clicking a citation only scrolled the PDF to the cited page — the user still had
to hunt for the relevant paragraph. RM-1 closes the citation loop: clicking a citation now
**paints a translucent highlight over the precise chunk text** that was fed to the model, and
scrolls the first highlight into the centre of the viewport.

User-visible behaviour:

- Click a citation chip in the chat → the preview opens the cited document, jumps to the page,
  and highlights **every retrieved chunk on that page** (not just the top match).
- The **full chunk text** is highlighted, not a snippet.
- The highlight **persists until the next citation is clicked** (or the document is switched).
- Matching is **best-effort**. If no confident text match is found on the page, it silently
  falls back to a plain page-jump — no error, no empty state.

---

## 2. How it was implemented

### 2.1 Carry chunk text through the RAG pipeline

The retrieval side already returned "sources" but **deduped them by `(document, page)` and
dropped the chunk `content`**. To highlight, the viewer needs the actual text, so the pipeline
was reshaped to **group by page and keep every chunk's text**:

- The `Source` type gained a `snippets: string[]` field — the full text of every retrieved
  chunk that lives on that `(document, page)`.
- In the chat route, the old "seen `Set` + push once" dedup was replaced by a `Map` keyed on
  `${document_id}:${page}`. The first chunk for a key creates the `Source`; later chunks for the
  same key **append their `content` to `snippets`**. Order of first appearance (relevance order
  from `match_chunks`) is preserved because `Map` keeps insertion order.

Nothing else in retrieval changed — `match_chunks` (RLS-scoped, `user_id`-filtered), the
embedding model, the prompt, and the "answer only from context / say I don't know" instruction
are all untouched. The `content` was already being selected by the RPC; it was just being
discarded, so **no SQL / `match_chunks` change was needed**.

### 2.2 Thread the highlight text to the viewer

`snippets` rides along on each `Source`, so it reaches the client inside the existing
`data-sources` message part. The click handler chain was widened to carry it:

`ChatZone` citation button → `onSourceClick(documentId, page, snippets)` →
`Workspace/Container` stores it in `selectedHighlights` state → passed to `FilePreview` →
forwarded to `PdfViewer` as `highlights`.

`selectedHighlights` is **cleared when the user switches documents** (in `handleSelectDocument`)
and **replaced on every citation click** (in `handleSourceClick`), which is what gives the
"persists until the next citation" behaviour.

### 2.3 Render the highlight (react-pdf)

The highlight is drawn on react-pdf's **text layer**, which is an invisible, selectable layer of
absolutely-positioned spans sitting on top of the rendered page canvas. Two `<Page>` props do
the work, and **only on the cited page**:

- **`customTextRenderer`** — react-pdf calls this per text run and uses the returned string as
  the run's HTML. For each run we:
  1. HTML-escape the original text (`escapeHtml`) — the string becomes `innerHTML`, so escaping
     is required to avoid markup injection from PDF text.
  2. Normalize whitespace + lowercase both the run and the chunk texts (`normalizeWhitespace`).
  3. If the normalized run is contained in any normalized chunk text, wrap it in
     `<mark class="…">`; otherwise return it as-is.
  - Runs shorter than `MIN_MATCH_LENGTH` (2 chars) are skipped so stray single characters /
    punctuation (which trivially appear inside any chunk) aren't marked.
  - The `<mark>` uses a translucent Tailwind class (`bg-yellow-300/45 dark:bg-yellow-400/30`)
    so the underlying glyphs stay readable.

- **`onRenderTextLayerSuccess`** — fires after the text layer (with our `<mark>` elements) is in
  the DOM. It reads a `pendingHighlightScrollRef` flag (armed whenever `page`/`highlights`
  change), finds the **first `<mark>` on the cited page**, and `scrollIntoView({ block:
"center" })`. If no `<mark>` matched, it falls back to scrolling the page to the top. Gating on
  the ref stops unrelated re-renders (e.g. a resize) from yanking the scroll position back.

Because both props are `undefined` for non-cited pages and flip to `undefined` on the previously
cited page when the citation changes, react-pdf re-renders that page's text layer **without**
marks — so the highlight is automatically cleared when a new citation is clicked.

### 2.4 Decisions & limitations

- **No coordinate / bbox storage.** Matching is purely text-based (normalized-whitespace
  compare). This is intentionally best-effort — a mismatch degrades to a page-jump.
- **Whole-page, all-chunks** highlighting (per the roadmap decision), full chunk text.
- Potential minor over-matching: a common word that appears both inside and outside the chunk on
  the same page could be marked in both places. Accepted as best-effort; in practice pdf.js emits
  fairly long text runs, so this is rare.
- `Spinner` extraction (TD-1) was left out of scope — still defined inline in the viewer.

---

## 3. Components, queries, hooks, types

### Changed files

| File                                                                                             | Role in this feature                                                                                                |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| [../../src/lib/chat.ts](../../src/lib/chat.ts)                                                   | `Source` type — added `snippets: string[]`.                                                                         |
| [../../src/app/api/chat/route.ts](../../src/app/api/chat/route.ts)                               | Group chunks by `(document_id, page)` into a `Map`, accumulate `snippets`.                                          |
| [../../src/components/workspace/ChatZone.tsx](../../src/components/workspace/ChatZone.tsx)       | `onSourceClick(documentId, page, snippets)` — passes `s.snippets` from the citation chip.                           |
| [../../src/containers/Workspace/Container.tsx](../../src/containers/Workspace/Container.tsx)     | `selectedHighlights` state; set in `handleSourceClick`, cleared in `handleSelectDocument`; passed to `FilePreview`. |
| [../../src/components/workspace/FilePreview.tsx](../../src/components/workspace/FilePreview.tsx) | Accepts `highlights?: string[]`, forwards to `PdfViewer`.                                                           |
| [../../src/components/workspace/PdfViewer.tsx](../../src/components/workspace/PdfViewer.tsx)     | Highlight rendering: `customTextRenderer` + `onRenderTextLayerSuccess`, mark-scroll, helpers.                       |

### Types

- `Source` (`src/lib/chat.ts`): `{ documentId, name, page, snippets }`.
- `ChatMessage = UIMessage<never, { sources: Source[] }>` — sources travel as the
  `data-sources` UI-message part.
- `Matched` (`route.ts`, local) — shape of a `match_chunks` row; `content` is what fills
  `snippets`.

### Queries / server

- **`match_chunks`** RPC (`supabase.rpc("match_chunks", …)` in `route.ts`) — unchanged. RLS +
  `user_id`-scoped cosine search defined in `prisma/sql/ragSetup.sql`. Already returned
  `content`; RM-1 just stops discarding it.
- No new server actions, no new DB columns, no migration.

### Hooks

- `useChat` (`@ai-sdk/react`, in `ChatZone`) — surfaces `data-sources` parts unchanged.
- `PdfViewer` internal hooks: `useState` (`numPages`, `width`), `useRef`
  (`containerRef`, `pageRefs`, `pendingHighlightScrollRef`), `useMemo` (`normalizedHighlights`),
  `useCallback` (`renderHighlightedText`, `handleCitedTextLayerRender`), `useEffect`
  (ResizeObserver for width; page-jump + arm-scroll). `useT` for i18n copy.

### Library props used (react-pdf 10.4.1)

- `<Page customTextRenderer={…}>` — type `CustomTextRenderer`
  (`{ pageIndex, pageNumber, itemIndex } & TextItem → string`).
- `<Page onRenderTextLayerSuccess={…}>` — fired after the text layer mounts.

### Not touched

No new dependencies. No i18n strings (highlight is purely visual). `prisma/sql/*` unchanged.
