# PasalManager

Expo Router app. Routes live in `app/`. Product code lives in `src/`.

## Layout

```
app/                      Expo Router only — screens, layouts, redirects
src/
  features/               One folder per product area
    auth/  money/  parties/  inventory/  pos/  notes/  habits/  staff/  cafe/
      components/         Feature UI (sheets, screens extracted from routes)
      lib/                Feature domain logic
      hooks/              Feature data/hooks
  shared/                 Used by two or more features
    ui/  layout/  forms/  feedback/
    lib/                  format, business, workspace, session, …
    hooks/                useAppQueries, useDebouncedValue, …
  api/                    HTTP client + endpoint functions
  data/                   SQLite, cache, offline queue
  stores/                 Global Zustand (auth, theme, sync, habits)
  theme/                  Palette, color themes, spacing
  types/                  Shared models and API contracts
  providers/              App-wide providers
assets/                   Icons, brand, fonts
```

## Rules of thumb

- **New product work goes in `src/features/<name>/`.** Do not add another catch-all `src/components` or `src/lib`.
- **`app/` stays thin.** Route files wire navigation and render feature/shared UI. When a route grows past ~200 lines, extract a screen into `src/features/<name>/components/` or `screens/`.
- **`shared/` is for reuse.** If only one feature needs it, it is not shared.
- **Import from file paths**, e.g. `@/src/features/money/lib/expense`. Do not add barrel `index.ts` files unless a folder has a stable public API.
- **Theme:** `usePalette()` at render; `createStyles = (colors: AppPalette) => StyleSheet.create(...)`. Never bake theme colors into a static stylesheet via imported `palette`.
- **Personal vs business:** use `isPersonalWorkspace`. Personal copy is Contact / Walk-in / Money. Do not dump shop POS into personal.
- **Notifications:** never statically import `expo-notifications`. Lazy-load only in a real native build.

## Adding a feature

See [docs/adding-features.md](docs/adding-features.md).
