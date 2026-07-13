# RM-7 · Folders to group documents and scope chat

**Status:** done · **Effort:** L · Roadmap: [../ROADMAP.md](../ROADMAP.md) → RM-7

> **ID note:** the roadmap reuses `RM-7` for two features. The earlier
> [rm-7-chat-history.md](./rm-7-chat-history.md) documents per-scope chat persistence;
> **this** doc is the folders feature the current roadmap entry describes (and it builds
> directly on that persistence).

Group a user's documents into folders and run a conversation scoped to a folder, alongside
the existing single-document and all-documents scopes.

---

## 1. What it's for

A flat file list doesn't scale. Folders let a user keep, say, "Benefits" vs "Onboarding"
policies separate and ask questions against just one set.

User-visible behaviour:

- A **New folder** control in the documents panel header; folders render as **collapsible
  groups** in the same list, with an **Unfiled** section for documents in no folder.
- A folder's header row is **selectable as a chat scope** — retrieval and the persisted
  thread are then limited to that folder's documents.
- Each document row has a **Move to folder** action; a folder's **⋯** opens rename/delete.
- Deleting a folder **keeps its documents** (they become unfiled) and removes only the
  folder's chat thread.

---

## 2. How it was implemented

### 2.1 Data model

Prisma ([../../prisma/schema.prisma](../../prisma/schema.prisma)) + migration
[../../prisma/migrations/20260713140000_folders/migration.sql](../../prisma/migrations/20260713140000_folders/migration.sql):

- New **`folders`** table (`id, user_id, name, created_at`).
- **`documents.folder_id`** — nullable FK to `folders`, `ON DELETE SET NULL` (deleting a
  folder unfiles its documents rather than deleting them). One folder per document.
- **`chat_messages.folder_id`** — nullable FK to `folders`, `ON DELETE CASCADE`. The thread
  scope key is now **orthogonal**: both null = all-documents thread; `document_id` set = a
  document thread; `folder_id` set = a folder thread. A second index
  `(user_id, folder_id, created_at)` backs folder-thread reads.

RLS + the auth FK (which Prisma can't model) live in
[../../prisma/sql/folderSetup.sql](../../prisma/sql/folderSetup.sql): `folders.user_id →
auth.users` (cascade) and a "Users manage own folders" policy on `auth.uid()`. **This file
must be pasted into the Supabase SQL Editor** after `prisma migrate deploy`.

### 2.2 Folder actions

[../../src/features/folders/actions.ts](../../src/features/folders/actions.ts) —
`createFolder`, `renameFolder`, `deleteFolder`, `moveDocumentToFolder`. All run under the
Supabase client (RLS scopes them to the caller). `moveDocumentToFolder` additionally
re-checks that the target folder is owned by the caller (RLS returns it only if owned)
before filing a document into it. Names are validated with `folderNameSchema`
([validators.ts](../../src/features/folders/validators.ts)).

### 2.3 Chat scope (retrieval + persistence)

`match_chunks` is **unchanged** — it already accepts `document_ids` and filters by
`auth.uid()`. The route resolves the scope instead of the client dictating chunk ids:

[../../src/app/api/chat/route.ts](../../src/app/api/chat/route.ts) now takes
`{ documentId?, folderId? }` and computes a `targetIds: string[] | null`:

- **folder** → the folder's **ready** documents (`null`-safe empty array ⇒ retrieves
  nothing, so an empty folder answers "I don't know");
- **document** → `[documentId]`;
- **neither** → `null` (all ready documents).

`retrieveChunks`/`getFallbackChunks` were generalised around `targetIds` (balanced
per-document retrieval now covers folders too). The message is persisted under the matching
orthogonal key (`scopeDocumentId` / `scopeFolderId`).

[../../src/features/chat/actions.ts](../../src/features/chat/actions.ts) `getChatMessages` /
`clearChatMessages` take a `ChatScope` ([types.ts](../../src/features/chat/types.ts)) and
filter the thread by the orthogonal key.

### 2.4 UI

- Scope became a `ChatScope` in
  [../../src/features/workspace/components/PreviewContainer.tsx](../../src/features/workspace/components/PreviewContainer.tsx).
  A scope whose target disappeared (folder deleted, document removed) transparently falls
  back to all-documents via a **render-derived `effectiveScope`** (no setState-in-effect).
- [../../src/features/documents/components/UploadZone.tsx](../../src/features/documents/components/UploadZone.tsx)
  renders the "All documents" row, a `FolderGroup` per folder, then the Unfiled documents.
  The per-document row was extracted to
  [DocumentListItem.tsx](../../src/features/documents/components/DocumentListItem.tsx)
  (+ [DocumentStatusBadge.tsx](../../src/features/documents/components/DocumentStatusBadge.tsx)).
- Folder components ([../../src/features/folders/components](../../src/features/folders/components)):
  `NewFolderButton`, `FolderGroup` (collapsible, selectable header), `FolderManageDialog`
  (rename/delete), `MoveToFolderDialog`. All reuse the existing `Dialog` primitive (no new
  UI dependency) and `router.refresh()` + toasts.

---

## 3. Components, routes, actions, types

| File                                                                                                                                                                                                                                                                                           | Role                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [prisma/schema.prisma](../../prisma/schema.prisma)                                                                                                                                                                                                                                             | `Folder` model; `folderId` on `Document` (SetNull) and `ChatMessage` (Cascade).             |
| [prisma/migrations/20260713140000_folders/migration.sql](../../prisma/migrations/20260713140000_folders/migration.sql)                                                                                                                                                                         | Creates `folders`, adds the two `folder_id` columns + FKs + indexes.                        |
| [prisma/sql/folderSetup.sql](../../prisma/sql/folderSetup.sql)                                                                                                                                                                                                                                 | Auth FK + RLS for `folders` (hand-paste into Supabase).                                     |
| [src/features/folders/actions.ts](../../src/features/folders/actions.ts)                                                                                                                                                                                                                       | `createFolder`, `renameFolder`, `deleteFolder`, `moveDocumentToFolder`.                     |
| [src/features/folders/service.ts](../../src/features/folders/service.ts) · [validators.ts](../../src/features/folders/validators.ts)                                                                                                                                                           | `FolderRow` type; `folderNameSchema`.                                                       |
| [src/features/folders/components/*](../../src/features/folders/components)                                                                                                                                                                                                                     | `NewFolderButton`, `FolderGroup`, `FolderManageDialog`, `MoveToFolderDialog`.               |
| [src/features/chat/types.ts](../../src/features/chat/types.ts)                                                                                                                                                                                                                                 | `ChatScope` type.                                                                           |
| [src/features/chat/actions.ts](../../src/features/chat/actions.ts)                                                                                                                                                                                                                             | `getChatMessages`/`clearChatMessages` keyed by `ChatScope`.                                 |
| [src/app/api/chat/route.ts](../../src/app/api/chat/route.ts)                                                                                                                                                                                                                                   | `{ documentId?, folderId? }` contract; folder→targetIds resolution; orthogonal persistence. |
| [src/features/documents/components/UploadZone.tsx](../../src/features/documents/components/UploadZone.tsx) · [DocumentListItem.tsx](../../src/features/documents/components/DocumentListItem.tsx) · [DocumentStatusBadge.tsx](../../src/features/documents/components/DocumentStatusBadge.tsx) | Grouped documents panel.                                                                    |
| [src/features/workspace/components/PreviewContainer.tsx](../../src/features/workspace/components/PreviewContainer.tsx) · [WorkspaceContent.tsx](../../src/features/workspace/components/WorkspaceContent.tsx)                                                                                  | Scope state + folders fetch.                                                                |
| [src/shared/config/i18n/messages/en.json](../../src/shared/config/i18n/messages/en.json)                                                                                                                                                                                                       | `Folders.*` strings + `Workspace.chatScopedFolder` / `remove`.                              |

### Not touched

No new dependencies. `match_chunks` (`prisma/sql/ragSetup.sql`) unchanged.
