# Jarvis Job Assistant

Jarvis is a local-first Chrome/Edge extension prototype for keeping job-search
activity and useful job-page details together.

## Install for development

1. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this project folder.
4. Open a regular website to see the floating **J** button. Pin the extension
   and click its toolbar icon to manage tracked sites and your resume.

After changing extension files, reload Jarvis from the browser's extensions
page and refresh the website tab.

## Included in this first version

- Floating Jarvis button on regular web pages.
- Copy page title or URL, and copy selected text when present.
- Explicitly save the current page and selected text for later.
- Search saved pages and reopen them from the extension menu.
- Track a website and display its last-visited age in days.
- Pick a PDF resume and reopen it in an extension viewer.
- Export tracked-site and saved-page data as JSON.
- Store extension data in local browser storage; there is no account or server.

## Browser limitations and privacy

Browser extensions cannot silently inspect arbitrary folders or open a native
file-explorer window at a chosen path. Choose your resume through the file
picker; Jarvis stores the selected PDF locally in extension storage. The
floating page button is unavailable on browser-internal pages, extension
stores, and some protected pages. Page details are only saved when you click
**Save this page**.

The extension requests access to all regular websites to show the floating
button and update visits for sites you explicitly track. Visit tracking stores
the tracked site's most recent visit and page title in local browser storage.
