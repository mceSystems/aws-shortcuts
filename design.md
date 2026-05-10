# AWS Shortcut — Design System

> Modern minimalism. Glassmorphism. Apple-inspired functional elegance.
> Premium feel without ornament. Content-first hierarchy.

---

## 1. Design Principles

| # | Principle | What it means here |
|---|-----------|---------------------|
| 1 | **Functional simplicity** | Every visible element serves a click target, a label, or a state cue. No decorative chrome. |
| 2 | **Generous white space** | Components breathe. Default gap = 16px. Section padding = 24px. Never cram. |
| 3 | **Visual hierarchy** | Three weights only: 600 (titles), 500 (labels/active), 400 (body). Three sizes per surface. |
| 4 | **Soft depth** | No flat panels. Use layered shadows + subtle blur to imply z-index. No harsh borders. |
| 5 | **Organic geometry** | Border radii are large and consistent. 16px on cards, 12px on buttons, 999px on chips. |
| 6 | **Muted sophistication** | Neutrals carry the surface. One accent (`Indigo 500`) marks intent. No rainbow. |
| 7 | **Typography first** | Inter for everything. Optical sizing. Tight line-height for headers, loose for body. |
| 8 | **Motion is meaning** | Animations explain state changes (in/out, depth shift, focus). Never decorative. ≤ 240ms. |

---

## 2. Color System

### 2.1 Neutrals (light mode)

| Token | Value | Use |
|-------|-------|-----|
| `--surface-0` | `#FAFAFB` | App background (popup body, sidepanel) |
| `--surface-1` | `#FFFFFF` | Card surface, elevated panels |
| `--surface-glass` | `rgba(255, 255, 255, 0.65)` | Glassmorphism overlay (palette, modal) |
| `--surface-glass-border` | `rgba(255, 255, 255, 0.7)` | Frosted-glass inner highlight |
| `--ink-900` | `#0B0D12` | Primary text, headings |
| `--ink-700` | `#1F242E` | Body text |
| `--ink-500` | `#5B6472` | Secondary text, labels |
| `--ink-400` | `#8A92A0` | Tertiary text, placeholders |
| `--ink-200` | `#D8DCE3` | Hairline dividers |
| `--ink-100` | `#EEF0F4` | Subtle row backgrounds |

### 2.2 Neutrals (dark mode — auto via `prefers-color-scheme`)

| Token | Value | Use |
|-------|-------|-----|
| `--surface-0` | `#0E1014` | App background |
| `--surface-1` | `#171A21` | Card surface |
| `--surface-glass` | `rgba(20, 22, 28, 0.55)` | Glassmorphism overlay |
| `--surface-glass-border` | `rgba(255, 255, 255, 0.08)` | Frosted highlight |
| `--ink-900` | `#F5F6F8` | Primary text |
| `--ink-700` | `#D6DAE2` | Body |
| `--ink-500` | `#8B93A1` | Secondary |
| `--ink-400` | `#5C6371` | Tertiary |
| `--ink-200` | `#262A33` | Dividers |
| `--ink-100` | `#1C1F26` | Subtle rows |

### 2.3 Single accent

Only ONE accent color exists. Used for primary CTA, focus ring, active selection.

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--accent` | `#5A5BFE` (Indigo 500) | `#7B7CFF` | Primary action, focus ring |
| `--accent-soft` | `rgba(90, 91, 254, 0.10)` | `rgba(123, 124, 255, 0.14)` | Hover, selected row tint |
| `--accent-ink` | `#FFFFFF` | `#0B0D12` | Text on accent |

### 2.4 Semantic states

| Token | Value | Use |
|-------|-------|-----|
| `--success` | `#16A34A` | Live session indicator dot |
| `--warning` | `#D97706` | Multi-session not enabled banner |
| `--danger` | `#DC2626` | Error toast, destructive button |
| `--info` | `#0284C7` | Tip banner |

### 2.5 Account chip palette (8 user-selectable)

Each is a 60% saturation desaturated tone, calibrated to look balanced when next to neutrals.

| Slot | Hex | Name |
|------|-----|------|
| 1 | `#5A5BFE` | Iris |
| 2 | `#16B8A6` | Mint |
| 3 | `#F59E0B` | Amber |
| 4 | `#EC4899` | Rose |
| 5 | `#8B5CF6` | Lilac |
| 6 | `#06B6D4` | Sky |
| 7 | `#10B981` | Sage |
| 8 | `#F43F5E` | Coral |

Chip rendering rule: chip surface uses **token-tinted glass**, not solid fill —
`background: color-mix(in oklch, var(--chip-color) 12%, var(--surface-1))`,
border `1px solid color-mix(in oklch, var(--chip-color) 40%, transparent)`.

---

## 3. Typography

**Family:** Inter, optical-sized. Fallback: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`.

**Feature flags:** `font-feature-settings: "cv11", "ss01", "ss03"` (rounded `g`, `a`, fractions).

### 3.1 Scale (Major Third, 1.25)

| Token | Size / Line / Weight | Use |
|-------|----------------------|-----|
| `--type-display` | 22 / 28 / 600, tracking `-0.02em` | Onboarding title |
| `--type-h1` | 17 / 24 / 600, tracking `-0.01em` | Section headers |
| `--type-h2` | 14 / 20 / 600 | Card titles, chip name |
| `--type-body` | 13 / 20 / 400 | Body text |
| `--type-label` | 12 / 16 / 500 | Form labels, chip role/region |
| `--type-caption` | 11 / 14 / 400, tracking `0.02em` | Hints, timestamps |
| `--type-mono` | 12 / 18 / 450, `JetBrains Mono` | Account IDs, regions |

### 3.2 Hierarchy guidance

- Page never has more than 2 H1-equivalents simultaneously.
- Body always at `--ink-700`. Secondary at `--ink-500`. Tertiary at `--ink-400`. Never use `--ink-900` for body — reserve for headings.
- Letter-spacing tightens as size grows (-0.02em at 22px, +0.02em at 11px).

---

## 4. Spacing

8px base unit. Half-step (4px) allowed for tight rows.

| Token | px | Use |
|-------|----|-----|
| `--space-1` | 4 | Inline icon gap |
| `--space-2` | 8 | Form-field gap, chip internal gap |
| `--space-3` | 12 | Tile internal padding |
| `--space-4` | 16 | Section internal gap |
| `--space-5` | 24 | Section padding |
| `--space-6` | 32 | Page padding (options) |
| `--space-7` | 48 | Hero spacing |

**Edge-bleed rule:** glass overlays bleed to viewport edge with `padding: 0`, content offset inside with `--space-5`.

---

## 5. Border Radius

Generous. Consistent. Never sharp.

| Token | px | Use |
|-------|----|-----|
| `--radius-pill` | 999 | Chips, tags |
| `--radius-lg` | 20 | Glass overlays, palette panel |
| `--radius-md` | 16 | Cards, tiles |
| `--radius-sm` | 12 | Buttons, inputs |
| `--radius-xs` | 8 | Inline badges |

Rule: a child's radius ≤ parent's radius minus its margin. e.g., a button (12px) sitting inside a card (16px) with 8px margin = card-internal radius effectively 8px → no clash.

---

## 6. Elevation (shadows)

Layered, low-opacity. Two shadows per level (ambient + key) for natural light feel.

| Token | Shadow | Use |
|-------|--------|-----|
| `--elev-0` | none | Inline content |
| `--elev-1` | `0 1px 2px rgba(11,13,18,0.04), 0 1px 1px rgba(11,13,18,0.03)` | Cards at rest |
| `--elev-2` | `0 4px 12px rgba(11,13,18,0.06), 0 2px 4px rgba(11,13,18,0.04)` | Hover, dropdown |
| `--elev-3` | `0 12px 32px rgba(11,13,18,0.10), 0 4px 12px rgba(11,13,18,0.06)` | Modal, palette overlay |
| `--elev-4` | `0 24px 60px rgba(11,13,18,0.16), 0 8px 24px rgba(11,13,18,0.08)` | Toast peeking, full-screen overlay |

Dark mode multiplies opacity by ~1.6× to maintain perceived depth.

---

## 7. Glassmorphism Recipe

Used for: cmd+k palette, color picker popover, modal overlays, sticky headers when scrolled.

```css
.glass {
  background: var(--surface-glass);
  backdrop-filter: saturate(180%) blur(24px);
  -webkit-backdrop-filter: saturate(180%) blur(24px);
  border: 1px solid var(--surface-glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--elev-3);
}
```

**Rules:**
- Blur radius scales with elevation: 12px (elev-2), 24px (elev-3), 36px (elev-4).
- Always pair backdrop-filter with a translucent bg fallback (no-blur browsers).
- Never stack glass on glass — only one frosted layer at a time.
- Behind-glass content needs ≥ 1 visible color element to make the blur read; over plain neutral, glass becomes invisible.

---

## 8. Motion

Tokens:

```css
--ease-out: cubic-bezier(0.22, 1, 0.36, 1);     /* default */
--ease-in:  cubic-bezier(0.55, 0, 1, 0.45);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

--dur-instant: 80ms;
--dur-fast: 140ms;
--dur-base: 200ms;
--dur-slow: 320ms;
```

**Patterns:**

| Trigger | Animation |
|---------|-----------|
| Hover state | `transition: 140ms ease-out` (color, shadow, transform-y(-1px)) |
| Focus ring | Instant (no transition, accessibility) |
| Modal open | `200ms ease-out` opacity 0→1, scale 0.97→1, translate-y 8px→0 |
| Modal close | `140ms ease-in` opacity 1→0, scale 1→0.98 |
| Tile click | `80ms ease-out` scale 1→0.97 → release with spring back to 1 |
| Toast in | `320ms ease-spring` translate-y 24px→0, opacity 0→1 |
| Skeleton shimmer | 1.4s linear infinite, gradient sweep |

**Reduced motion:** `@media (prefers-reduced-motion: reduce)` → all transitions to 0ms, opacity-only fades for in/out.

---

## 9. Components

### 9.1 Account Chip (pill style)

```
Default          Selected               Live session
┌─────────────┐  ┌─────────────┐        ┌─────────────┐
│  ● MCE-DEV  │  │ ● MCE-DEV ✓ │        │ ● MCE-DEV ⏺  │
│  Admin · us-1│  │  Admin · us-1│       │  Admin · us-1│
└─────────────┘  └─────────────┘        └─────────────┘
```

**Anatomy:**
- Shape: rounded rectangle, `--radius-md` (not full pill — too small for two lines).
- Width: auto, min 132px, max 200px. Padding 10px 14px.
- Tinted glass background per chip color.
- Color dot (8px) at left of name line.
- Top line: account name in `--type-h2`, `--ink-900`.
- Bottom line: `<role> · <region>` in `--type-label`, `--ink-500`. Each clickable (underline on hover).
- Live-session indicator: 6px filled `--success` dot, right edge of name line, soft pulse (2.4s breathing scale 1↔1.15).
- Selected state: chip elevation goes elev-1 → elev-2, border thickens 1px → 1.5px in `--chip-color` at 70% saturation, soft inner glow `inset 0 0 0 4px var(--accent-soft)`.

**Right-click:** color picker pops as glass card below chip, 8 swatches in 4×2 grid, 28px circles, hover-scale 1.1, 80ms.

### 9.2 Service Search Input

```
┌────────────────────────────────────────────────┐
│  🔍  Search service                       ⌘K  │
└────────────────────────────────────────────────┘
```

- Height 44px. Padding 0 16px. Radius `--radius-sm`.
- Background `--surface-1`. Border `1px solid --ink-200`.
- Focus: border `--accent` + 4px `var(--accent-soft)` ring (no inner shadow).
- Placeholder italic `--ink-400`.
- Trailing keyboard hint badge (⌘K) in `--type-caption`, `--ink-400`, monospace, on a `4px 8px` pill `--ink-100`.

### 9.3 Result List (live filter)

- List under search input, no border, gap 2px between rows.
- Each row: `40px` tall, padding `0 12px`, `--radius-sm`.
- Hover/active row: `--accent-soft` background + 1px left bar of `--accent`, slides in with `cubic-bezier(0.22,1,0.36,1)` over 140ms.
- Service name primary, optional subtitle (e.g., "Logs Insights · feature") in `--ink-500`.

### 9.4 Preview row

```
●  MCE-DEV     ·  Admin    ·  us-east-1   ·  CloudWatch Logs
                                                      [open ↗]
```

- Single line, baseline-aligned, `--type-body`.
- Color dot (10px) in chip color, bleeds into row.
- Inline edit affordance: clicking role/region opens dropdown anchored to that span.
- Right-aligned ghost button "Open ↗" only when this row is the only selection. Multi-select hides per-row buttons; uses bottom global "Open N tabs".

### 9.5 Primary button

- Height 40px. Padding 0 18px. Radius `--radius-sm`.
- Background `--accent`. Color `--accent-ink`. Weight 500.
- Subtle internal gradient: `linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.06) 100%)` for tactile feel.
- Hover: lift 1px, shadow elev-1 → elev-2.
- Active: scale 0.98.
- Disabled: opacity 0.5, no hover.

### 9.6 Ghost / icon button

- Height 32px. No background. Hover: `--ink-100` background. Active: scale 0.95.
- Use for header icons (settings, refresh, palette).

### 9.7 cmd+k Palette (full-window glass overlay)

- Backdrop: `rgba(11, 13, 18, 0.32)` with `backdrop-filter: blur(8px)` (subtle scrim, not black).
- Panel: 560px × auto, max-height 70vh. Centered horizontally, top offset 12vh.
- Glass panel per § 7. Radius `--radius-lg`.
- Input bar: 56px, font 16px, no border, bottom hairline `--ink-200`.
- Result row: 44px, padding 0 20px. Active row: `--accent-soft` background, 2px left accent bar.
- Bottom hint strip: 36px, `--ink-100` bg, `--type-caption`, separated by hairline.
- Open animation: scale 0.96 → 1 + opacity 0 → 1, 200ms ease-out. Backdrop fades in parallel 140ms.

### 9.8 Favorite tile

```
┌────────────────────────┐
│ ●                       │  ← chip-color stripe, 3px left edge
│  CloudWatch Logs        │
│  MCE-STG · us-west-2    │
└────────────────────────┘
```

- 156px × 88px. Padding 14px 16px. Radius `--radius-md`.
- Background `--surface-1`. Shadow elev-1.
- Left edge stripe (3px wide) in chip color, full height, slight extension into rounded corner via `border-radius` clip mask.
- Hover: shadow elev-1 → elev-2, translate-y -1px.
- Title: `--type-h2`, `--ink-900`. Subtitle: `--type-caption`, `--ink-500`.

### 9.9 Toast / inline error

- Slide up from bottom, 16px from bottom edge.
- Glass panel, radius `--radius-md`, padding `12px 16px`.
- Icon + text. Auto-dismiss 4s, swipe-down to close.

---

## 10. Surface Mockups

ASCII layout indicates *spatial intent* only — real fidelity in the styling tokens above. Render with all the rules in § 1–9.

### 10.1 Popup (480 × auto, mode A)

```
┌──────────────────────────────────────────────────────────────┐
│  AWS Shortcut                          ⌘K     ↻      ⚙       │  ← 56px header, hairline below
│                                                              │
│   ──────────  ACCOUNTS  ─────────────────────────────────    │  ← --type-caption, --ink-400, letter-spaced
│                                                              │
│   ╭───────────╮ ╭───────────╮ ╭───────────╮ ╭───────────╮    │
│   │● mce main │ │● MCE-TEST │ │● MCE-DEV ✓│ │● MCE-AI-DV│    │  ← chips, gap 12px
│   │Admin·us-1 │ │RO·us-1    │ │Admin·us-1 │ │Admin·us-1 │    │
│   ╰───────────╯ ╰───────────╯ ╰───────────╯ ╰───────────╯    │
│   ╭───────────╮                                              │
│   │● MCE-STG ✓│                                              │
│   │Admin·us-2 │                                              │
│   ╰───────────╯                                              │
│                                                              │
│   ──────────  SERVICE  ──────────────────────────────────    │
│                                                              │
│   ┌────────────────────────────────────────────────────┐    │
│   │  🔍  cloudwatch                          ⌘K        │    │
│   └────────────────────────────────────────────────────┘    │
│   ▌ CloudWatch Logs                                          │  ← 2px accent left bar, soft tint
│      CloudWatch Insights                                     │
│      CloudWatch Alarms                                       │
│      CloudFormation                                          │
│                                                              │
│   ──────────  GOING TO  ─────────────────────────────────    │
│                                                              │
│   ●  MCE-DEV  ·  Admin  ·  us-east-1  ·  CloudWatch Logs    │
│   ●  MCE-STG  ·  Admin  ·  us-west-2  ·  CloudWatch Logs    │
│                                                              │
│                              [   Open 2 tabs   ▸   ]         │  ← primary button right-aligned
│                                                              │
│   ──────────  FAVORITES  ────────────────────────────────    │
│                                                              │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─ + ───────┐  │
│   │▌CW Logs  │  │▌EC2      │  │▌IAM      │  │ Add fav   │  │
│   │ MCE-STG  │  │ MCE-DEV  │  │ mce-main │  │           │  │
│   │ us-west-2│  │ us-east-1│  │ us-east-1│  │           │  │
│   └──────────┘  └──────────┘  └──────────┘  └───────────┘  │
└──────────────────────────────────────────────────────────────┘
```

Section labels (`ACCOUNTS`, `SERVICE`, etc.) are caption-sized, `--ink-400`, letter-spacing `0.08em`, uppercase, with a 1px hairline of `--ink-200` extending right of the label.

### 10.2 Side panel (mode B, viewport-tall)

Same content stacked vertically, fits 360-420px viewport. Chips wrap two per row. Search + result list span full width. Preview row + favorites stack. Header sticks to top with glass treatment when content scrolls under it.

### 10.3 cmd+k Palette (Cmd+Shift+A)

```
                    backdrop blur 8px
                ╭────────────────────────────────────╮
                │  ╭──────────────────────────────╮  │
                │  │  ➤  cw logs prod_       ⌘K   │  │  ← input, 56px
                │  ├──────────────────────────────┤  │
                │  │ ▌ CloudWatch Logs            │  │  ← active row (accent-soft + 2px bar)
                │  │     MCE-STG · Admin · us-w-2 │  │
                │  │                              │  │
                │  │   CloudWatch Logs            │  │
                │  │     mce-main · Admin · us-e-1│  │
                │  │                              │  │
                │  │   CloudWatch Logs            │  │
                │  │     MCE-DEV · Admin · us-e-1 │  │
                │  │                              │  │
                │  │   CloudWatch Insights        │  │
                │  │     MCE-STG · Admin · us-w-2 │  │
                │  ├──────────────────────────────┤  │
                │  │ ↑↓ navigate  ⏎ open  esc     │  │  ← bottom strip
                │  ╰──────────────────────────────╯  │
                ╰────────────────────────────────────╯
                       glass panel, --elev-3
```

### 10.4 Onboarding wizard (modal, mode-overlaid in popup)

**Step 1/3 — Connect**

```
┌────────────────────────────────────────────┐
│                                            │
│              ◐                             │  ← logo glyph, monoline, 32px
│                                            │
│   Connect your access portal               │  ← display text
│   We'll read your accounts, roles,         │
│   and default regions — all locally.       │
│                                            │
│   Portal URL                               │  ← --type-label
│   ┌──────────────────────────────────┐    │
│   │ https://d-90679c71d5.awsapps.com │    │
│   └──────────────────────────────────┘    │
│                                            │
│              [   Open & scan   ]           │  ← primary, full-width on narrow
│                                            │
└────────────────────────────────────────────┘
```

**Step 2/3 — Multi-session check**

```
┌────────────────────────────────────────────┐
│   Enable multi-session                     │
│                                            │
│   AWS lets you keep up to 5 accounts open  │
│   simultaneously. We rely on this.         │
│                                            │
│   ┌─ inline screenshot, --radius-md, ────┐│
│   │  console UI w/ menu opened           ││
│   └──────────────────────────────────────┘│
│                                            │
│   Open console → top-right account menu   │
│   → Turn on multi-session.                 │
│                                            │
│   [   Open console   ]   [ I enabled it ▸ ]│
└────────────────────────────────────────────┘
```

**Step 3/3 — Default region**

```
┌────────────────────────────────────────────┐
│   Default region                           │
│   Used when a favorite has no pin.         │
│                                            │
│   ┌──────────────────────────────────┐    │
│   │  us-east-1                    ▾  │    │
│   └──────────────────────────────────┘    │
│                                            │
│              [    All set →    ]           │
└────────────────────────────────────────────┘
```

### 10.5 Add-favorite sheet (slides up over composer)

```
┌────────────────────────────────────────────┐
│   New favorite                       ✕     │  ← header w/ close
│                                            │
│   Account                                  │
│   ╭──────╮ ╭──────╮ ╭──────╮ ╭──────╮     │  ← mini chips, single-select
│   │ main │ │ TEST │✓│ DEV  │ │AI-DEV│     │
│   ╰──────╯ ╰──────╯ ╰──────╯ ╰──────╯     │
│                                            │
│   Role                                     │
│   ┌──────────────────────────────────┐    │
│   │  AdministratorAccess          ▾  │    │
│   └──────────────────────────────────┘    │
│                                            │
│   Region                                   │
│   ┌──────────────────────────────────┐    │
│   │  us-east-1 (account default)  ▾  │    │
│   └──────────────────────────────────┘    │
│                                            │
│   Service & feature                        │
│   ┌──────────────────────────────────┐    │
│   │  🔍  cloudwatch logs              │    │
│   └──────────────────────────────────┘    │
│   ▌ CloudWatch Logs                        │
│      Logs Insights                         │
│                                            │
│   Label (optional)                         │
│   ┌──────────────────────────────────┐    │
│   │  CW Logs (prod)                  │    │
│   └──────────────────────────────────┘    │
│                                            │
│   [ Cancel ]                  [   Save   ] │
└────────────────────────────────────────────┘
```

### 10.6 Options page (full tab, max-width 880px)

```
┌────────────────────────────────────────────────────────────┐
│   AWS Shortcut · Settings                                  │  ← --type-display
│                                                            │
│   ╭──────────────────────  Interface  ─────────────────╮  │  ← card --radius-md, --elev-1
│   │                                                    │  │
│   │   UI surface                                       │  │
│   │   ◯ Popup     ◉ Side panel     ◯ Both            │  │
│   │                                                    │  │
│   │   Default region                                   │  │
│   │   ┌────────────────────────────────┐              │  │
│   │   │  us-east-1                  ▾  │              │  │
│   │   └────────────────────────────────┘              │  │
│   │                                                    │  │
│   ╰────────────────────────────────────────────────────╯  │
│                                                            │
│   ╭──────────────────────  Accounts (5)  ────────────╮    │
│   │                                                    │  │
│   │   [ ↻ Re-scan portal ]                            │  │
│   │                                                    │  │
│   │   ●  mce main      Admin ▾    us-east-1 ▾   ⋯    │  │  ← row, hover bg --ink-100
│   │   ●  MCE-TEST      RO ▾       us-east-1 ▾   ⋯    │  │
│   │   ●  MCE-DEV       Admin ▾    us-east-1 ▾   ⋯    │  │
│   │   ●  MCE-AI-DEV    Admin ▾    us-east-1 ▾   ⋯    │  │
│   │   ●  MCE-STG       Admin ▾    us-west-2 ▾   ⋯    │  │
│   │                                                    │  │
│   ╰────────────────────────────────────────────────────╯  │
│                                                            │
│   ╭──────────────────────  Multi-session  ──────────╮    │
│   │   ✓ Enabled (verified 2 minutes ago)             │  │
│   │   [ Re-verify ]                                  │  │
│   ╰────────────────────────────────────────────────────╯  │
│                                                            │
│   ╭──────────────────────  Catalog  ─────────────────╮    │
│   │   247 services. Last refresh 2 days ago.          │  │
│   │   [ Refresh now ]                                 │  │
│   ╰────────────────────────────────────────────────────╯  │
│                                                            │
│   ╭──────────────────────  Maintenance  ─────────────╮    │
│   │   [ Re-run wizard ]   [ Export data ]            │  │
│   │   [ Clear all data — destructive ]                │  │  ← danger ghost button
│   ╰────────────────────────────────────────────────────╯  │
└────────────────────────────────────────────────────────────┘
```

---

## 11. Iconography

- **Family:** Lucide (linear, 1.5px stroke). Outlined only.
- **Sizes:** 14px (inline), 16px (button), 20px (header), 32px (logo).
- **Color:** inherit `currentColor` from parent text token. Never tinted independently.
- **Inline emoji** allowed sparingly (✓ ✕ ⌘ ⏎ ⏺) for keyboard hints — not as decoration.

---

## 12. Accessibility

- WCAG AA contrast minimum on all text/background pairs. `--ink-500` on `--surface-1` = 7.2:1 ✓.
- Focus ring: 2px `--accent` with 4px halo `--accent-soft`, never removed even on mouse — only thinned (1px halo) for non-keyboard focus.
- All interactive elements ≥ 32px hit target. Chips internally 60×40 minimum.
- Color is never the only signal — live session uses dot + animation; selected chip uses border + checkmark; danger button uses copy + color.
- `prefers-reduced-motion: reduce` halts shimmer + spring + breathing. Opacity transitions only.
- `prefers-color-scheme: dark` switches palette tokens automatically.
- Keyboard: tab navigates chips → service input → results → preview → open button. Arrow keys within chip row, list, palette.

---

## 13. CSS Token Block (drop-in)

Single source of truth:

```css
:root {
  color-scheme: light dark;

  --surface-0: #FAFAFB;
  --surface-1: #FFFFFF;
  --surface-glass: rgba(255, 255, 255, 0.65);
  --surface-glass-border: rgba(255, 255, 255, 0.7);

  --ink-900: #0B0D12;
  --ink-700: #1F242E;
  --ink-500: #5B6472;
  --ink-400: #8A92A0;
  --ink-200: #D8DCE3;
  --ink-100: #EEF0F4;

  --accent: #5A5BFE;
  --accent-soft: rgba(90, 91, 254, 0.10);
  --accent-ink: #FFFFFF;

  --success: #16A34A;
  --warning: #D97706;
  --danger: #DC2626;
  --info: #0284C7;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;

  --radius-pill: 999px;
  --radius-lg: 20px;
  --radius-md: 16px;
  --radius-sm: 12px;
  --radius-xs: 8px;

  --elev-1: 0 1px 2px rgba(11,13,18,0.04), 0 1px 1px rgba(11,13,18,0.03);
  --elev-2: 0 4px 12px rgba(11,13,18,0.06), 0 2px 4px rgba(11,13,18,0.04);
  --elev-3: 0 12px 32px rgba(11,13,18,0.10), 0 4px 12px rgba(11,13,18,0.06);
  --elev-4: 0 24px 60px rgba(11,13,18,0.16), 0 8px 24px rgba(11,13,18,0.08);

  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in:  cubic-bezier(0.55, 0, 1, 0.45);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --dur-instant: 80ms;
  --dur-fast: 140ms;
  --dur-base: 200ms;
  --dur-slow: 320ms;

  --type-display: 600 22px/28px "Inter", system-ui;
  --type-h1: 600 17px/24px "Inter", system-ui;
  --type-h2: 600 14px/20px "Inter", system-ui;
  --type-body: 400 13px/20px "Inter", system-ui;
  --type-label: 500 12px/16px "Inter", system-ui;
  --type-caption: 400 11px/14px "Inter", system-ui;
  --type-mono: 450 12px/18px "JetBrains Mono", ui-monospace, monospace;
}

@media (prefers-color-scheme: dark) {
  :root {
    --surface-0: #0E1014;
    --surface-1: #171A21;
    --surface-glass: rgba(20, 22, 28, 0.55);
    --surface-glass-border: rgba(255, 255, 255, 0.08);

    --ink-900: #F5F6F8;
    --ink-700: #D6DAE2;
    --ink-500: #8B93A1;
    --ink-400: #5C6371;
    --ink-200: #262A33;
    --ink-100: #1C1F26;

    --accent: #7B7CFF;
    --accent-soft: rgba(123, 124, 255, 0.14);
    --accent-ink: #0B0D12;

    --elev-1: 0 1px 2px rgba(0,0,0,0.30), 0 1px 1px rgba(0,0,0,0.24);
    --elev-2: 0 4px 12px rgba(0,0,0,0.40), 0 2px 4px rgba(0,0,0,0.28);
    --elev-3: 0 12px 32px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.36);
    --elev-4: 0 24px 60px rgba(0,0,0,0.65), 0 8px 24px rgba(0,0,0,0.45);
  }
}
```

---

## 14. Anti-patterns (do NOT do)

- ❌ Drop shadows wider than 32px or with > 0.18 opacity → looks dated.
- ❌ Multi-color gradients (rainbow). One-axis subtle gradients only, < 8% delta.
- ❌ Sharp corners on cards (radius < 12px) → industrial, not premium.
- ❌ Heavy borders (≥ 2px solid). Use 1px hairlines or rely on shadow.
- ❌ All-caps headlines → reserve for caption-tier section labels only.
- ❌ Stacking glass on glass → blur compounds, looks muddy.
- ❌ Animations > 320ms → feel sluggish.
- ❌ More than one accent color → kills hierarchy.
- ❌ Icons without labels in primary actions → ambiguous.
- ❌ Filled-color status badges (red/green pills with white text) → loud. Use a dot + label.

---

## 15. Asset list (need before build)

- Logo glyph (monoline, 1 svg, scales 16/24/32/64).
- Lucide icon set (npm `lucide-react`).
- Inter Variable font (woff2, subset Latin).
- JetBrains Mono Variable (woff2, subset Latin).
- One screenshot of console "Add session" menu (PNG, 2x, ≤ 200KB) for wizard step 2.

---

## 16. Open design questions to confirm

1. **Light only, dark only, or auto?** Recommended auto via `prefers-color-scheme`.
2. **Logo glyph** — request: simple monoline glyph evoking branching/connection. Two-strokes max.
3. **Live-session pulse** — confirm the breathing animation isn't distracting in popup. Alternative: static dot.
4. **Section label style** — uppercase letter-spaced labels are decisive; alternative is sentence-case body labels for softer feel.
5. **cmd+k empty state** — show "Recent" list when query empty, or just a placeholder hint?

Reply with picks; I'll lock the system before re-implementation.
