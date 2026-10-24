# AGENTS.md

> Guidance for AI coding agents working in the `uit-25730067-chithanh/userscripts` repository.

---

## 1. Project Overview

`userscripts` is a collection of high-performance, lightweight browser userscripts (Violentmonkey / Tampermonkey) tailored for UIT academic workflows (Microsoft Teams, CITD Elearning).

```
userscripts/
├── scripts/
│   ├── teams-courses-filter.user.js          # MS Teams course card filter & timetable sorter
│   ├── citd-courses-filter.user.js           # CITD Elearning semester course filter
│   └── teams-lecture-comments-harvester.user.js # MS Teams lecture comments & reactions harvester
├── tests/
│   ├── mock-teams.html                       # Fluent UI v9 DOM mock
│   ├── test-filter.cjs                       # Playwright test for courses filter
│   └── test-harvester-v12.cjs                # Playwright test for comments harvester
├── tmp/                                      # Temporary test outputs & scratch files (gitignored)
└── README.md                                 # Minimal public documentation
```

---

## 2. Communication & Language Protocol

- **User Discussions & Reports:** Always communicate in **Vietnamese (Tiếng Việt)**.
- **Technical Output:** English only (commits, code, comments, variables, tests, PRs).
- **Conciseness:** Sacrifice grammar for the sake of concision when writing reports. List unresolved questions at the end, if any.

---

## 3. Engineering & Architecture Standards

### A. SPA & React Fiber Safety
- **Non-Destructive DOM:** Never call `element.remove()` or `removeChild()` on React-managed nodes; toggle visibility via `style.display = 'none'` or CSS classes.
- **TrustedTypes & CSP:** Zero `innerHTML`. Use `document.createElement`, pure DOM SVG nodes, and `new DOMParser().parseFromString(html, 'text/html')`.

### B. Teams Harvester Architecture
- **Primary Source:** Direct query to IndexedDB (`Teams:replychain-manager:...` -> `replychains-2`). Provides full reply chains, author MRIs, and authoritative reaction details (`properties.emotions`).
- **Secondary Source:** Scoped DOM inspection as fallback for live calls/chats without channel reply chains.
- **Non-Intrusive:** Never dispatch synthetic hover (`pointerover`) or `Escape` events to avoid canceling Teams internal fetches and throwing unhandled rejections.
- **Hot-Swap Support:** Always maintain `window.__<scriptName>.destroy()` cleanup handlers for clean zero-reload injection into active browser tabs.

---

## 4. Verification & Testing

Run Playwright test suites locally before committing:
```bash
# Test MS Teams courses filter
node tests/test-filter.cjs

# Test Teams lecture comments harvester
node tests/test-harvester-v12.cjs
```
- All test assertions must pass 100% with zero runtime console errors.

---

## 5. Git Discipline & Commit Policy

- **Author Profile:** `uit-25730067-chithanh <25730067@ms.uit.edu.vn>`.
- **Remote Alignment:** Use academic SSH host alias: `git@github.com-uit:uit-25730067-chithanh/userscripts.git`.
- **Direct Push:** Direct pushes to `main` are allowed and preferred.
- **Commit Format:** Conventional Commits (`feat:`, `fix:`, `refactor:`, `perf:`).
  - Header ≤ 72 characters (Imperative, English).
  - Body ≥ 3 bullet points (`-`) if changes touch ≥ 2 files.
- **Scratch Files:** All temporary test runs, CSVs, or logs belong in `tmp/`.
