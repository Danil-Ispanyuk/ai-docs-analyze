---
name: rag-pipeline
description: Work on document ingestion, chunking, embeddings, vector search, or the chat answer flow. Use for any task touching upload→ingest or question→answer paths, citations, or the match_chunks function.
---

# RAG pipeline map

Two pipelines over one vector store. The model never sees whole documents — only retrieved chunks.

## Ingestion (per document)

`UploadZone` uploads the file to Supabase Storage (bucket `documents`, `src/lib/documents.ts`) → `createDocument` then `ingestDocument` in `src/actions/documents.ts`:

1. `src/lib/pdf.ts` — `unpdf` extracts text per page (whitespace-normalized)
2. `src/lib/chunk.ts` — hand-written splitter, size 1000 / overlap 150, page-scoped (chunks never span pages)
3. `src/lib/embedding.ts` — `embedMany` with `text-embedding-3-small` (1536 dims)
4. Old chunks for the document are deleted, new ones inserted with denormalized `user_id`
5. `documents.status`: `pending → processing → ready | error` (`src/constants/documents.ts`)

## Query (per question)

`src/app/api/chat/route.ts`:

1. Auth check via Supabase server client — 401 if no user
2. Embed the last user message with the same embedding model
3. `supabase.rpc("match_chunks", ...)` — cosine similarity, **RLS-enforced and filtered by `auth.uid()`** (defined in `prisma/sql/ragSetup.sql`)
4. Build instructions: answer ONLY from context, say "don't know" otherwise
5. `streamText` (`gpt-4o-mini`) merged into `createUIMessageStream`; sources (unique file+page) are written first as a `data-sources` part of `ChatMessage` (`src/lib/chat.ts`)

Client side: `useChat` in `src/components/workspace/ChatZone.tsx`; clicking a citation drives `PdfViewer` (react-pdf) to the page.

## Invariants — check before finishing any change here

- **Security:** vector search must stay scoped to the current user (RLS + `user_id` filter in `match_chunks`). Anything that widens it is a data leak, not an optimization.
- `match_chunks` has three coupled definitions: the SQL in `prisma/sql/ragSetup.sql`, the deployed function in Supabase, and the `supabase.rpc(...)` call + `Matched` type in `route.ts`. Change one → update all three (the SQL Editor step is manual — tell the owner).
- Embedding model and `vector(1536)` must match; question and chunks must use the same model.
- Chunk metadata (`page`, `chunk_index`, document `name`) feeds citations — don't drop it when reshaping the pipeline.
- Answers must degrade to "I don't know", never invent facts; keep that instruction when editing the prompt.
