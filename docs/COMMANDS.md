# Windows PowerShell and Git command reference

This is a short guide to commands used in this repository. Commands are shown
for PowerShell, from the repository root unless stated otherwise.

## Commands used for the auth-aware logo fix and merge

| Command                                                                                                                                                                                                       | What it does                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `git status --short`                                                                                                                                                                                          | Shows changed and untracked files; check this before committing.                             |
| `git branch --show-current`                                                                                                                                                                                   | Prints the current branch name.                                                              |
| `git branch --list master`                                                                                                                                                                                    | Confirms the local `master` branch exists.                                                   |
| `git --no-pager log --oneline --decorate -5`                                                                                                                                                                  | Shows the five latest commits without opening a pager.                                       |
| `git switch -c fix/auth-aware-brand-navigation`                                                                                                                                                               | Creates and switches to a new feature branch from the current branch.                        |
| `npx prettier --write web/src/app/page.tsx web/src/app/login/page.tsx web/src/app/signup/page.tsx web/src/features/auth/redirect-if-authenticated.ts`                                                         | Formats the changed web files from the repository root.                                      |
| `Push-Location web; npm run lint; $result = $LASTEXITCODE; Pop-Location; exit $result`                                                                                                                        | Runs web lint from its package folder and returns the command's exit code.                   |
| `Push-Location web; npm run typecheck; $result = $LASTEXITCODE; Pop-Location; exit $result`                                                                                                                   | Runs the TypeScript check from the web package and preserves its result.                     |
| `Push-Location web; npm run build; $result = $LASTEXITCODE; Pop-Location; exit $result`                                                                                                                       | Builds the web app and preserves the build result.                                           |
| `Push-Location web; npx prettier --check src/app/page.tsx src/app/login/page.tsx src/app/signup/page.tsx src/features/auth/redirect-if-authenticated.ts; $result = $LASTEXITCODE; Pop-Location; exit $result` | Checks formatting for the changed web files.                                                 |
| `git diff --check`                                                                                                                                                                                            | Checks unstaged changes for whitespace errors.                                               |
| `git add <file...>`                                                                                                                                                                                           | Stages only the named files for a commit.                                                    |
| `git diff --cached --check`                                                                                                                                                                                   | Checks staged changes for whitespace errors.                                                 |
| `git diff --cached --stat`                                                                                                                                                                                    | Summarizes the staged change sizes by file.                                                  |
| `git commit -m "fix(web): make brand navigation auth-aware" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"`                                                                        | Commits the code fix and adds the repository's required co-author trailer.                   |
| `git commit -m "docs: add Windows command reference" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"`                                                                               | Commits this command guide with the required trailer.                                        |
| `git switch master`                                                                                                                                                                                           | Changes the current working branch to `master`.                                              |
| `git merge --ff-only fix/auth-aware-brand-navigation`                                                                                                                                                         | Moves `master` forward only if no merge commit is needed. It stops if the branches diverged. |

The logo fix is `9dbc965`; the command guide is `feb9773`. The feature branch
was fast-forwarded to `master`.

## Commands used for the PWA feature

| Command                                                                                                                                                                                                                      | What it does                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `git switch -c feature/web-pwa-notifications-widgets`                                                                                                                                                                        | Creates the feature branch from `master`.                                           |
| `npx prettier --write README.md web/README.md docs/features/PWA.md web/src/app/layout.tsx web/src/app/manifest.ts web/src/features/pwa/service-worker-registration.tsx web/public/service-worker.js web/public/offline.html` | Formats the PWA source and documentation.                                           |
| `Push-Location web; npm run lint; $result = $LASTEXITCODE; Pop-Location; exit $result`                                                                                                                                       | Lints the web application.                                                          |
| `Push-Location web; npm run typecheck; $result = $LASTEXITCODE; Pop-Location; exit $result`                                                                                                                                  | Type-checks the web application.                                                    |
| `Push-Location web; npm run build; $result = $LASTEXITCODE; Pop-Location; exit $result`                                                                                                                                      | Builds the production app, including its generated web manifest route.              |
| `node --check web\public\service-worker.js`                                                                                                                                                                                  | Checks service-worker JavaScript syntax.                                            |
| `Push-Location web; npm run start -- --hostname 127.0.0.1`                                                                                                                                                                   | Serves the production build locally for a browser check; press `Ctrl+C` to stop it. |

The app was opened at `http://127.0.0.1:3000` in a browser. The manifest,
worker registration, PNG icon responses, and offline navigation were checked;
turning the browser context offline and navigating to `/dashboard` displayed
the public offline page. This localhost test does not replace checking the
install prompt on an HTTPS deployment and a real mobile device.

The source logo was resized to web app icon dimensions with Windows
`System.Drawing`:

```powershell
Add-Type -AssemblyName System.Drawing
$source = [System.Drawing.Image]::FromFile((Resolve-Path 'assets\jarvis-128.png'))
foreach ($size in @(192, 512, 180)) {
  $bitmap = [System.Drawing.Bitmap]::new(
    $size,
    $size,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.DrawImage($source, 0, 0, $size, $size)
  $name = if ($size -eq 180) { 'apple-touch-icon.png' } else { "icon-$size.png" }
  $bitmap.Save(
    (Join-Path (Resolve-Path 'web\public') $name),
    [System.Drawing.Imaging.ImageFormat]::Png
  )
  $graphics.Dispose()
  $bitmap.Dispose()
}
$source.Dispose()
```

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
