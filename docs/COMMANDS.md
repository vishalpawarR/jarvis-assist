# Windows PowerShell and Git command reference

This is a short guide to commands used in this repository. Commands are shown
for PowerShell, from the repository root unless stated otherwise.

## Commands used for the auth-aware logo fix and merge

| Command                                      | What it does                                                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git status --short`                         | Shows changed and untracked files; check this before committing.                                                                                  |
| `git branch --show-current`                  | Prints the current branch name.                                                                                                                   |
| `git branch --list master`                   | Confirms the local `master` branch exists.                                                                                                        |
| `git --no-pager log --oneline --decorate -5` | Shows the five latest commits without opening a pager.                                                                                            |
| `git add <file...>`                          | Stages only the named files for a commit.                                                                                                         |
| `git diff --cached --check`                  | Checks staged changes for whitespace errors.                                                                                                      |
| `git diff --cached --stat`                   | Summarizes the staged change sizes by file.                                                                                                       |
| `git commit -m "<subject>"`                  | Creates a commit using the staged changes.                                                                                                        |
| `git switch master`                          | Changes the current working branch to `master`.                                                                                                   |
| `git merge --ff-only <branch>`               | Moves the current branch forward only when a merge commit is unnecessary. It stops rather than creating a merge commit if branches have diverged. |

For the latest merge, the branch was `fix/auth-aware-brand-navigation`.
The change was committed as `9dbc965`, then `master` was fast-forwarded to
that commit.

## Everyday PowerShell commands

| Command                                           | What it does                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `Get-Location`                                    | Prints the current folder.                                                            |
| `Set-Location web` or `cd web`                    | Moves into the `web` subfolder.                                                       |
| `Push-Location web`                               | Moves into `web` while remembering the current folder.                                |
| `Pop-Location`                                    | Returns to the folder saved by `Push-Location`.                                       |
| `Get-ChildItem`                                   | Lists files and folders in the current folder.                                        |
| `Get-Content README.md`                           | Prints a text file in the terminal.                                                   |
| `;`                                               | Separates PowerShell commands; the next command runs even if the previous one failed. |
| `if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }` | Stops a chained PowerShell check if the last native command failed.                   |

Windows paths in PowerShell normally use backslashes, such as
`web\src\app\page.tsx`. In Markdown links, this repository uses forward slashes.

## Project checks

Run web commands from `web`; run extension commands from the repository root.

```powershell
# From the repository root
npm run check:syntax
npm run test:sync

# From the repository root, enter the web app and run its checks
Push-Location web
npm run lint
npm run typecheck
npm run build
Pop-Location
```

- `npm run lint` checks source code for lint issues.
- `npm run typecheck` checks TypeScript types without emitting files.
- `npm run build` makes a production build; it also runs TypeScript validation.
- `git diff --check` checks unstaged edits; use `git diff --cached --check`
  for staged edits.

If a command reports a missing script, first make sure you are in the right
folder. The web app has its own `package.json`.

## Safe commit and merge sequence

```powershell
git status --short
git add <only-the-files-for-this-change>
git diff --cached --check
git diff --cached --stat
git commit -m "type(area): short description"
git switch master
git merge --ff-only <feature-branch>
git status --short
```

`git add` stages work; `git commit` saves it in local history. The final
`git status --short` should print nothing when the worktree is clean. Do not
use `git reset --hard` or `git checkout --` to clean up changes you did not
create.
