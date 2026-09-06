# Component structure

```
components/
  ui/         generic, theme-driven primitives — zero app/business knowledge
  shell/      app chrome — shared across every page, but not generic UI
  brand/      identity (logo, etc.) — neither generic UI nor shell logic
  features/
    <feature>/  components specific to one feature's data/screens
```

## The test for where something goes

**`ui/`** — could this exact component be copy-pasted into a totally
different app (different colors, different data) and still make sense
with zero edits beyond props? `Card`, `Avatar`, `Badge`, `Button`,
`IconButton`, `Toggle`, `icons/*`. If it imports a feature type or knows
about routes/auth/nav items, it doesn't belong here.

**`shell/`** — is this part of the persistent dashboard frame (sidebar,
top bar, page header) rather than page content? It's allowed to know
about routes and nav items — that's specific to *this app's* navigation,
not reusable elsewhere — but it shouldn't know about any one feature's
data shape. `DashboardShell`, `Sidebar`, `SidebarNav`, `TopBar`,
`PageHeader`, `SignOutButton`.

**`features/<name>/`** — everything else: components that render one
feature's data (`ProfileCard`, `AppointmentList`). New feature ⇒ new
folder here. If a component in a feature folder turns out to have no
feature-specific logic (e.g. `Toggle` used to live in `account/` despite
being a generic on/off switch), move it to `ui/`.

## Before adding a new component

1. Check `ui/` first — a lot of "new" components are actually a `Card` +
   `Badge` + spacing, not something new.
2. If you're about to copy-paste JSX from another component and tweak a
   few props, stop and extract a shared one instead (that's how
   `IconButton` happened — four files had the same button chrome).
3. Icons go in `ui/icons/`, one file per icon, exported from the barrel
   `ui/icons/index.ts`. Never inline a fresh `<svg>` in a feature or shell
   component — check the barrel first.

## Hand-rolled vs. Radix-backed

Everything in `ui/` is styled purely with this app's own CSS variables
(`--color-primary` etc. in `globals.css`) — never shadcn's default
`--background`/`--foreground` token system. Only one source of truth for
color/spacing/radius; don't let a second one grow in from a copy-pasted
shadcn snippet.

**Stays hand-rolled** (purely presentational, no real interaction state):
`Card`, `Badge`, `Avatar`, `Button`, `IconButton`.

**Radix-backed** (real keyboard/ARIA/focus-trap state machines, not worth
hand-rolling): `Toggle` (wraps `@radix-ui/react-switch` — same external
prop API as before, only internals changed), `Dialog`, `Select`, `Tabs`,
`Tooltip`, `Popover` — all added session 6, styled to match but **not
wired to any screen yet**. `ui.shadcn.com`'s registry isn't reachable from
the sandbox this gets built in, so these were hand-authored to match
standard shadcn/Radix output rather than pulled via `npx shadcn add` — if
that ever matters (e.g. wanting the CLI's exact latest version), run the
CLI locally where the registry's reachable and diff against these.

**Not yet added, add when there's an actual consumer:** `react-hook-form`
+ `zod` (wait for a real data-entry form), toast/notifications (wait for
the real notifications feature — `NotificationBell` is still a
placeholder, see `SESSION.md`).
