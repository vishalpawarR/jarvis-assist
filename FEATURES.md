# Jarvis feature list

This is the working backlog for Jarvis. Keep new ideas here, and update each
item's status as it is planned, built, and tested.

## Core ideas

- [ ] **Floating Jarvis button** — Show a Jarvis-branded icon that can be opened
  on supported websites without taking over the page.
- [ ] **Quick-copy details** — Show the relevant text/details in a floating
  panel and let the user copy an individual item with one click. Show clear
  confirmation when copying succeeds.
- [ ] **Resume shortcut** — Provide a button to locate and open the user's
  resume. Let the user choose the resume file or location; browsers generally
  do not allow a website to silently browse arbitrary folders.
- [ ] **Job application tracker** — Keep a list of job-search/application
  websites and let the user record applications, companies, roles, dates, and
  current status.
- [ ] **Last-visited information** — Show when each tracked website was last
  opened and how many days ago. Let the user edit or remove tracked entries.
- [ ] **Save and retrieve information** — Save useful details from a website
  and find them later, with an explicit user action before saving.

## Suggested additions

- [ ] **Application notes and activity** — Add notes, follow-up dates, contact
  details, and an optional history of status changes for each application.
- [ ] **Reminders** — Offer optional reminders for follow-ups or applications
  that have not been updated recently.
- [ ] **Search, filters, and export** — Find saved jobs quickly, filter by
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

## Decisions to make before implementation

- [ ] Is Jarvis intended to be a browser extension, a web app, or both?
- [ ] Which browsers should be supported first?
- [ ] Should tracking happen automatically when a tracked site is visited, or
  only after the user logs it?
- [ ] Should the resume shortcut open a chosen file, or open its containing
  folder where the browser/operating system permits it?
- [ ] Is local-only storage sufficient for the first version, or is account
  sync required?
- [ ] Which application sites and which job details are most important for the
  first release?

## Status key

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
