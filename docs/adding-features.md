# Adding a feature

PasalManager is an Expo Router app. Routes stay in `app/`. Logic and UI live in `src/features/<name>/`.

## 1. Pick the folder

| Area | Folder |
| --- | --- |
| Sign-in, OTP, workspace type | `src/features/auth` |
| Income, expenses, personal money | `src/features/money` |
| Contacts / parties / statements | `src/features/parties` |
| Products, stock, restock | `src/features/inventory` |
| Quick sale / cart | `src/features/pos` |
| Notes, reminders, task inbox | `src/features/notes` |
| Coins, streaks, interval pings | `src/features/habits` |
| Staff, permissions, salary | `src/features/staff` |
| Tables, cafe orders | `src/features/cafe` |

If the work does not fit, add `src/features/<new-name>/` with `components/`, `lib/`, and `hooks/` as needed. Do not create `src/components` or `src/lib` again.

Put code in `src/shared/` only when a **second** feature needs it.

## 2. Add the route last

```
app/(app)/widgets.tsx          ← default export, navigation, params
src/features/widgets/
  components/WidgetScreen.tsx
  components/WidgetSheet.tsx
  lib/widget.ts
  hooks/useWidgets.ts
```

The route file should look like:

```tsx
import { WidgetScreen } from '@/src/features/widgets/components/WidgetScreen';

export default function WidgetsRoute() {
  return <WidgetScreen />;
}
```

Tab entries go in `app/(app)/(tabs)/_layout.tsx`. Stack screens go in `app/(app)/_layout.tsx`. Gate with `canAccessSegment` / `isPersonalWorkspace`.

## 3. Data

- **HTTP:** add a function on the existing API object in `src/api/index.ts` (or a new `src/api/widgets.ts` if that file is getting large). Types go in `src/types/contracts.ts` and `src/types/models.ts`.
- **Queries:** add a hook next to the feature (`useWidgets.ts`) or in `src/shared/hooks/useAppQueries.ts` if it is already a shared catalog query.
- **Local state:** feature-specific Zustand stays in the feature. Auth, theme, and sync stay in `src/stores/`.
- **Offline:** use `src/data/sync.ts` + `withWorkspaceRetry` from `@/src/shared/lib/workspace-retry`.

## 4. UI

- Screens use `Screen` from `@/src/shared/layout/Screen`.
- Sheets use `BottomSheet` from `@/src/shared/feedback/BottomSheet`. Form sheets should open tall (`fullHeight` for editors).
- Cards stay flat (no elevation). Top bar already has the title — do not repeat it on the page.
- Colors: `const colors = usePalette()` and `useThemedStyles(createStyles)`.

```tsx
const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    title: { color: colors.text },
  });
```

## 5. Copy and access

- Personal workspace: Contact, Walk-in, Money. No shop POS dumped into personal.
- Business workspace: Party, Sale, Expense.
- Hide routes the role cannot use (`canAccessSegment`).

## 6. Checklist

- [ ] Files live under `src/features/<name>/` (or `src/shared/` if reused)
- [ ] Route in `app/` is a thin wrapper
- [ ] Types and API match the backend contract
- [ ] Personal and business both make sense (or the feature is gated)
- [ ] `npm run typecheck` passes
- [ ] No static `expo-notifications` import
