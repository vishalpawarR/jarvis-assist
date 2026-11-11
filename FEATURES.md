# Jarvis feature list

This is the working backlog for Jarvis. Keep new ideas here, and update each
item's status as it is planned, built, and tested.

## Core ideas

- [~] **Floating Jarvis button** — Show a Jarvis-branded icon that can be opened
  on supported websites without taking over the page.
- [~] **Quick-copy details** — Show the relevant text/details in a floating
  panel and let the user copy an individual item with one click. Show clear
  confirmation when copying succeeds.
- [~] **Resume shortcut** — Provide a button to locate and open the user's
  resume. Let the user choose the resume file or location; browsers generally
  do not allow a website to silently browse arbitrary folders.
- [~] **Job application tracker** — Keep a list of job-search/application
  websites and let the user record applications, companies, roles, dates, and
  current status.
- [~] **Last-visited information** — Show when each tracked website was last
  opened and how many days ago. Let the user edit or remove tracked entries.
- [x] **Site icons and deletion** — Show each tracked website's browser favicon
  (with a letter fallback) and let the user delete it from the tracker.
- [~] **Save and retrieve information** — Save useful details from a website
  and find them later, with an explicit user action before saving.
- [x] **Personal details and quick copy** — Save contact fields locally and
  copy an individual saved value, such as a mobile number, with one click.
- [x] **Resume folder shortcut** — Allow the user to save a resume copy under
  Downloads/Jarvis Resume and reveal that copy's folder. The original source
  folder cannot be revealed by a normal browser extension.
- [x] **Separate floating panel from job-site list** — Keep tracked website
  links in the extension popup; let the floating panel explicitly save the
  current page as a job site or save it as a page/article.
- [x] **Popup default and floating-panel shortcut** — Open the extension popup
  on My details and provide a keyboard shortcut to toggle the floating panel.

## Suggested additions

- [ ] **Application notes and activity** — Add notes, follow-up dates, contact
  details, and an optional history of status changes for each application.
- [ ] **Reminders** — Offer optional reminders for follow-ups or applications
  that have not been updated recently.
- [~] **Search, filters, and export** — Find saved jobs quickly, filter by
  status/date, and export the user's data for backup or migration.
- [ ] **Privacy controls** — Make it clear what is saved, provide edit/delete
  controls, and never save or sync page content without the user's action.
- [ ] **Accessible and unobtrusive panel** — Support keyboard navigation,
  screen readers, resizing, and a way to hide or disable the floating button.

## Data storage direction

Start with **local storage on the user's device** so the first version can work
without an account or sending job-search data to a server. If access across
devices is needed later, add **optional account-based sync** with clear
consent, secure authentication, and a way to delete synced data. The product
should identify which information is captured from a page and ask before
saving it.

## Product decisions for this prototype

- [x] Is Jarvis intended to be a browser extension, a web app, or both? Start
  with a Chrome/Edge Manifest V3 extension.
- [x] Which browsers should be supported first? Chrome and Edge.
- [x] Should tracking happen automatically when a tracked site is visited, or
  only after the user logs it? Visits are updated automatically only for sites
  the user explicitly adds to the tracker.
- [x] Should the resume shortcut open a chosen file, or open its containing
  folder where the browser/operating system permits it? Choose a PDF in a file
  picker and open it in a Jarvis browser tab; native folder opening is not
  available to a regular extension.
- [x] Is local-only storage sufficient for the first version, or is account
  sync required? Keep data local for the prototype.
- [ ] Which application sites and which job details are most important for the
  first release?

## Status key

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
