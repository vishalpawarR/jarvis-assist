# Jarvis Job Assistant

Jarvis is a local-first Chrome/Edge extension prototype for keeping job-search
activity and useful job-page details together.

## Project structure

```text
assets/                     Shared extension assets
docs/
  features/                 Feature-spec guidance
  decisions/                Architecture and behavior decision log
src/
  background/               Manifest V3 service worker
  content/                  Self-contained floating-panel content script
  features/
    data-export/
    job-sites/
    navigation/
    personal-details/
    resume/
    saved-pages/
  popup/                    Extension popup shell and styles
  shared/                   Shared storage keys and small utilities
web/                        Independent Next.js web app and package
```

Each user-facing feature owns its popup behavior in `src/features/<feature>/`.
The popup shell composes these modules. The service worker and injected content
script remain separate browser entry points. Add a new feature folder, not a
new extension-feature `package.json`; the root package owns shared developer
tooling, while `web/` has its own package for Next.js dependencies and scripts.

The website's planner and architecture decisions stay in the shared root
[`docs/PLANNER.md`](docs/PLANNER.md) and
[`docs/decisions/README.md`](docs/decisions/README.md); see
[`web/README.md`](web/README.md) for running the website. Track web feature
status in [`docs/features/WEBSITE.md`](docs/features/WEBSITE.md). Follow
[`supabase/README.md`](supabase/README.md) to configure a personal Supabase
project; common Windows PowerShell, Git, and project commands are documented in
[`docs/COMMANDS.md`](docs/COMMANDS.md).
The PWA, notification, and mobile-widget plan is tracked in
[`docs/features/PWA.md`](docs/features/PWA.md).

## Web app (Next.js)

From the repository root, run:

```powershell
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). See the web app README for
its scripts and the current integration status. The website includes a
progressively installable PWA; its private dashboard still requires a network
connection.

## Install for development

1. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this project folder.
4. Open a regular website to see the floating **J** button. Pin the extension
   and click its toolbar icon to open **Job sites**; use the other tabs to
   manage personal details, saved pages, and your resume.

After changing extension files, reload Jarvis from the browser's extensions
page and refresh the website tab.

The extension's **Sync** tab can connect to the same Supabase project as the
website. Connecting only signs in; data transfer is separate and is not
enabled until sync consent and merge controls are implemented.

## Formatting and checks

Run `npm install` once, then install the **Prettier - Code formatter**
extension in VS Code. Workspace settings format JavaScript, CSS, HTML, JSON,
and Markdown on save.

- `npm run format` formats the project.
- `npm run format:check` checks formatting.
- `npm run check:syntax` checks the JavaScript entry points and feature modules.
- `npm run test:sync` tests the local metadata-only deletion queue.

## Included in this first version

- Floating Jarvis button on regular web pages.
- **Ctrl+Shift+Y** opens or closes the floating panel; change the shortcut at
  `chrome://extensions/shortcuts` or `edge://extensions/shortcuts`.
- Explicitly save the current page (such as a blog/article) and selected text.
- Save a page as a job site from the floating panel; the site list stays in the
  extension popup's **Job sites** tab.
- Click a saved personal detail in the floating panel to copy it.
- Search saved pages from the extension popup's dedicated **Saved pages** tab.
- Search saved pages and reopen them from the extension menu.
- Use top-level tabs for job sites, personal details, saved pages, management,
  and resume.
- Track a website, see its favicon and last-visited age, and delete it.
- The Job sites tab shows circular site icons only. Manage tracked-site and
  saved-page deletions from the separate **Manage** tab, with confirmation.
- See a day-count badge on each job-site icon; the icon gets a red outline
  after seven days without a visit. Jarvis sends one generic browser reminder
  when a site first becomes stale; visiting it starts a new reminder cycle.
- Save contact details and custom personal fields locally; click a saved value
  to copy it.
- Pick a PDF resume and reopen it in an extension viewer.
- Save a resume copy under Downloads/Jarvis Resume and open that folder.
- Export tracked-site, saved-page, and personal details as JSON.
- Store extension data in local browser storage; there is no account or server.

Feature priorities and progress are tracked in [docs/FEATURES.md](docs/FEATURES.md);
the longer-term product plan is in [docs/PLANNER.md](docs/PLANNER.md). Record
behavior and architecture choices in [docs/decisions/README.md](docs/decisions/README.md).

## Browser limitations and privacy

Browser extensions cannot silently inspect arbitrary folders or open a native
file-explorer window at the original file's path. Choose your resume through
the file picker; Jarvis stores the selected PDF locally in extension storage.
The resume viewer can create a copy under Downloads/Jarvis Resume and ask the
browser to reveal that downloaded copy in the file manager. Personal details
are stored in the browser profile's local extension storage and are not sent
to a Jarvis server. The
floating page button is unavailable on browser-internal pages, extension
stores, and some protected pages. Page details are only saved when you click
**Save this page**.

The extension requests access to all regular websites to show the floating
button and update visits for sites you explicitly track. Visit tracking stores
the tracked site's most recent visit and page title in local browser storage.
Jarvis requests browser notification and alarm permissions to provide
once-per-stale-cycle reminders. Notification text includes only a count, not
the tracked site names.
