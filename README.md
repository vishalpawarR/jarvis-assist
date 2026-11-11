# Jarvis Job Assistant

Jarvis is a local-first Chrome/Edge extension prototype for keeping job-search
activity and useful job-page details together.

## Install for development

1. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this project folder.
4. Open a regular website to see the floating **J** button. Pin the extension
   and click its toolbar icon to open **Job sites**; use the other tabs to
   manage personal details, saved pages, and your resume.

After changing extension files, reload Jarvis from the browser's extensions
page and refresh the website tab.

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
- Use top-level tabs for job sites, personal details, and saved pages/resume.
- Track a website, see its favicon and last-visited age, and delete it.
- See a day-count badge on each job-site icon; the icon gets a red outline
  after seven days without a visit. Jarvis sends one generic browser reminder
  when a site first becomes stale; visiting it starts a new reminder cycle.
- Save contact details locally and click a saved value to copy it.
- Pick a PDF resume and reopen it in an extension viewer.
- Save a resume copy under Downloads/Jarvis Resume and open that folder.
- Export tracked-site, saved-page, and personal details as JSON.
- Store extension data in local browser storage; there is no account or server.

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
