# RM-7 · Chat history persistence

## What it's for

Before this, the chat lived only in React state: refreshing the page or coming
back later wiped every question and answer. Now a signed-in user's conversation
is **persisted per scope**, so it survives reloads and returns exactly as it was
left — including the source citations under each answer.

"Per scope" means the thread is keyed to what the chat is asking against:

- The **all-documents** thread (no specific document selected).
- A **separate thread per document** — selecting a document shows that
  document's own history, switching back to "all" restores the all-documents
  thread.

Guests get the same behaviour within their session; their history is removed
when the guest account is cleaned up (RM-4).

## How it was implemented

**Storage.** A new `chat_messages` table (`prisma/schema.prisma` →
`prisma/migrations/20260713120000_chat_messages/`) holds one row per message:
`user_id`, a nullable `document_id` (the thread scope — `NULL` is the
all-documents thread), `role`, and `parts` as `JSONB`. Storing the raw UIMessage
`parts` (the text part plus the `data-sources` citation part) lets a thread
rehydrate verbatim without reshaping. The index is
`(user_id, document_id, created_at)` so a thread loads in insertion order off one
index. The `document_id` FK to `documents` (cascade) is Prisma-modelled; the FK
to the Supabase-managed `auth.users` (cascade) plus RLS live in
`prisma/sql/chatSetup.sql` and are applied by hand. RLS grants a user
select/insert/delete on their **own** rows only — there is no update path.

**Saving (server).** `src/app/api/chat/route.ts` persists both sides of a turn.
The incoming user message is inserted before retrieval (only the newest one —
history is already stored), tagged with the scope
`documentIds?.length === 1 ? documentIds[0] : null`. The assistant reply is
inserted in `streamText`'s `onFinish`, rebuilt as `parts`: a `text` part with
the full answer plus, when there were citations, the same `data-sources` part
the client rendered. Writes go through the RLS Supabase client as the user.

**Loading (server + client).** `getChatMessages(documentId)`
(`src/features/chat/actions.ts`) reads a scope's rows under RLS, ordered by
`created_at`, and maps them back to `ChatMessage[]`. `WorkspaceContent` fetches
the all-documents thread and passes it down as `initialMessages`, which seeds
`useChat({ messages })` in `ChatZone` — so the opening scope hydrates with no
flash. When the selected document changes, a `useEffect` in `ChatZone` refetches
that scope and calls `setMessages`; the very first run is skipped (a ref guard)
because `initialMessages` already covers the starting scope. A per-effect
`active` flag drops stale responses from fast scope switching.

**Usage-meter correction.** The optimistic usage bump previously derived the
request count from `messages.filter(role === "user")`. Once `messages` includes
loaded history, that would double-count questions already reflected in the
server usage snapshot. It was switched to explicit session counters —
`sentThisSession` (incremented on submit) and `sessionTokens` (accumulated from
each answer's token metadata) — so the meter only adds work done **since page
load** on top of the persisted snapshot.

**Guest cleanup.** No new logic: the `auth.users` cascade from
`chat_messages_user_id_fkey` removes a guest's messages when
`cleanup_anonymous_users()` (RM-4) deletes the account.

## Components / queries / hooks

| File                                                     | Role                                                                          |
| -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `prisma/schema.prisma`                                   | `ChatMessage` model + `Document.chatMessages` relation                        |
| `prisma/migrations/20260713120000_chat_messages/`        | Table, index, `documents` FK                                                  |
| `prisma/sql/chatSetup.sql`                               | `auth.users` FK (cascade) + RLS select/insert/delete policies (manual)        |
| `src/features/chat/actions.ts`                           | `getChatMessages(documentId)` — load a scope's thread under RLS               |
| `src/app/api/chat/route.ts`                              | Insert user message (pre-retrieval) + assistant message (`onFinish`)          |
| `src/features/workspace/components/WorkspaceContent.tsx` | Fetches the all-documents thread → `initialMessages`                          |
| `src/features/workspace/components/PreviewContainer.tsx` | Threads `initialMessages` down to `ChatZone`                                  |
| `src/features/chat/components/ChatZone.tsx`              | Hydrates `useChat`; refetches + `setMessages` on scope change; session meters |
| `src/features/chat/types.ts`                             | `ChatMessage` (also carries `{ tokens }` metadata for the live meter)         |

**Manual step:** after `pnpm prisma:deploy` + `pnpm prisma:generate`, paste
`prisma/sql/chatSetup.sql` into the Supabase SQL Editor (FK + RLS).
