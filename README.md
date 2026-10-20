# userscripts

Personal Tampermonkey userscripts for UIT academic portals (Microsoft Teams, CITD Elearning).

## Usage

1. Install [Tampermonkey](https://www.tampermonkey.net/) in your browser.
2. Install the desired script from `scripts/`:
   - `teams-courses-filter.user.js`: Filter and organize courses on Microsoft Teams.
   - `citd-courses-filter.user.js`: Filter courses by semester on CITD Elearning.

## Testing

```bash
node tests/test-filter.cjs
```

## License

MIT
