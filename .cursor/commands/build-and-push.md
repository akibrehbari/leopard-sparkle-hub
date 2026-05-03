# Build and push

Commit and push the current working changes. Run these steps in order. If any
step fails, stop and report the error before continuing.

## 1. Verify the build

Run `npm run build`. If it fails, fix the errors and re-run until the build is
clean. Do not proceed to commit while the build is broken.

## 2. Branch off if currently on `main`

Check the current branch with `git branch --show-current`.

- If it is `main`, create and check out a new branch using the table below.
- If it is already a feature/bugfix/hotfix/refactor branch, stay on it.

Pick the type that best matches the change:

| Type     | Format                  | Example                    |
| -------- | ----------------------- | -------------------------- |
| Feature  | `feature/<description>` | `feature/user-auth`        |
| Bugfix   | `bugfix/<description>`  | `bugfix/login-error`       |
| Hotfix   | `hotfix/<description>`  | `hotfix/security-patch`    |
| Refactor | `refactor/<description>`| `refactor/api-middleware`  |

Use kebab-case for `<description>`, keep it short (2–4 words).

## 3. Commit

- Stage only files that belong to this change. Never stage `.env`, build
  artifacts, or unrelated edits.
- Write a concise commit message that explains the *why*, not just the *what*.

## 4. Push

Push to `origin <branch>` (use `-u` if the upstream is not set yet).

If the push is rejected because the remote is ahead, run `git pull --no-rebase`
(a merge pull, **not** a rebase) and then push again.
