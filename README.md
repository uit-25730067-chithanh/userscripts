# userscripts

Personal userscripts for UIT academic portals (Microsoft Teams, CITD Elearning).

## Usage

1. Install a userscript manager in your browser (recommended: [Violentmonkey](https://violentmonkey.github.io/), or [Tampermonkey](https://www.tampermonkey.net/)).
2. Install the desired script from `scripts/`:
   - `teams-courses-filter.user.js`: Filter and organize courses on Microsoft Teams.
   - `citd-courses-filter.user.js`: Filter courses by semester on CITD Elearning.
   - `teams-lecture-comments-harvester.user.js`: Export lecture comments and reaction details from Microsoft Teams to CSV.

## Testing

```bash
node tests/test-filter.cjs
```

## License

MIT
