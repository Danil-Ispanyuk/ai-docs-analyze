---
name: commit
description: Create a git commit for the current changes using the project's commit format. Use when asked to commit, "make a commit", "закоміть", or after finishing a piece of work that should be recorded.
---

# Commit

Stage the relevant changes and create a single git commit in the project's fixed format.

## Message format

```
feat(<feature-name>): <what was added>
```

- **`<feature-name>`** — short, kebab-case name of the feature/area touched
  (e.g. `pdf-highlight`, `password-reset`, `toasts`). Matches the `docs/features/`
  file naming when the change maps to a roadmap feature.
- **`<what was added>`** — one short lower-case phrase, imperative mood, no trailing period.
- Subject line only. **No body, no `Co-Authored-By` trailer.**

Examples:

```
feat(pdf-highlight): highlight cited chunk on the PDF text layer
feat(toasts): add global Sonner toaster and toast wrapper
feat(password-reset): add forgot/reset password pages
```

The type is normally `feat`. If the change is clearly not a feature, keep the same
`type(scope): description` shape with the fitting conventional type — `fix`, `refactor`,
`docs`, `chore`, `style` — but default to `feat` unless it obviously isn't one.

## Steps

1. **Inspect the changes** — run `git status` and `git diff` (and `git diff --staged`) to see
   what changed. Read enough to name the feature and describe what was added.
2. **Stage the change** — `git add` the files that belong to this change. Do **not** sweep in
   unrelated or stray files; if the working tree mixes several unrelated changes, stage only
   the ones for this commit and tell the user what you left out.
3. **Compose the message** in the format above. If the user passed a scope/description hint as
   an argument, use it; otherwise infer both from the diff.
4. **Commit** — `git commit -m "feat(<feature-name>): <what was added>"`.
5. **Report** — print the resulting `git log --oneline -1` (hash + subject).

## Rules

- Commit to the **current branch**; do **not** push (the user pushes separately).
- One focused commit per invocation. If the diff is really two unrelated changes, say so and
  ask before splitting into multiple commits.
- If there is nothing to commit, say so instead of creating an empty commit.
- Never amend, rebase, or force-push from this skill.
