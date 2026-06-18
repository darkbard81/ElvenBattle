# Local Assets

This project keeps most runtime assets out of git on purpose.

Tracked in this folder:
- `README.md` only

Ignored in this folder:
- `assets.json`
- `fonts/`
- `ui/`
- other generated or local image/audio asset folders

## Working convention

- Use this folder for local-only art, fonts, and generated runtime assets.
- Regenerate `assets.json` locally when asset contents change.
- Do not rely on these files being present in a fresh clone unless you created them locally.

## Current expected layout

```text
assets/
  README.md
  assets.json
  fonts/
  ui/
  cards/
```
