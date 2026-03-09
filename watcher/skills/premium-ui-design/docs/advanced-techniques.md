# Premium UI Design - Advanced Techniques
## 6. Iconography Rules

### Consistency is Everything

| Rule | Description |
|------|-------------|
| **Single library** | Use ONE icon library everywhere (Phosphor, Lucide, Hero Icons) |
| **Single weight** | Choose thin OR regular OR bold — NEVER mix weights |
| **Standard size** | 20-24px for UI icons, 16px for inline icons |
| **No emojis as icons** | Replace emojis with professional icon library icons |

### State Differentiation

Use icon weight changes to indicate selection state:

```
INACTIVE TAB:  ○ [outline icon]   + muted color
ACTIVE TAB:    ● [filled icon]    + brand color + bold label
```

This is MORE effective than just changing the color.

### Icon Selection

- Use universally recognized symbols (magnifying glass = search, house = home)
- If an icon isn't universally known, ADD a text label
- For older or less technical audiences, labels are MANDATORY

---

## 7. Dark Mode Rules

### The Double-Distance Rule

Colors in dark mode look MORE similar to each other. You need MORE contrast:

```
LIGHT MODE: 2% difference between background levels
DARK MODE:  4-6% difference between background levels
```

### Elevation = Lighter (Not Darker)

In dark mode, surfaces that are "elevated" (closer to user) should be LIGHTER:

```
DARK MODE ELEVATION:
──────────────────────────────────────
Level 0: Page bg     → darkest  (e.g., oklch(0.15 0.01 250))
Level 1: Sidebar     → slightly lighter (+4% brightness)
Level 2: Card        → lighter (+6% brightness)
Level 3: Modal/Popup → lightest (+8% brightness)
──────────────────────────────────────
```

### Creating Dark Elevation Steps

Take the base dark color and for each elevation:
- Increase Brightness (B in HSB) by +4 to +6
- Decrease Saturation (S in HSB) by -10 to -20

```css
/* Dark mode elevation */
--bg-base:     oklch(0.15 0.02 250);  /* deepest */
--bg-surface:  oklch(0.19 0.015 250); /* cards */
--bg-elevated: oklch(0.23 0.01 250);  /* modals, popovers */
```

### Never Use Pure Black

Pure `#000000` is harsh on eyes. Use very dark blue-gray or warm dark:

```css
/* BAD */
background: #000000;

/* GOOD: Dark with subtle warmth */
background: oklch(0.14 0.01 260);  /* dark blue-gray */
```

### Brand Color Adjustment

In dark mode, use LIGHTER tints of your brand color (300-400 level instead of 500-600).

### OKLCH Token Swap Technique

Instead of maintaining two separate color palettes, use OKLCH lighting variables that invert in dark mode:

```css
:root {
  --lighting-bg: 0.97;
  --lighting-surface: 0.94;
  --lighting-text: 0.15;
}

@media (prefers-color-scheme: dark) {
  :root {
    --lighting-bg: 0.12;
    --lighting-surface: 0.16;
    --lighting-text: 0.92;
  }
}

/* Single declaration works for both modes */
body { background: oklch(var(--lighting-bg) 0.01 250); }
.card { background: oklch(var(--lighting-surface) 0.01 250); }
.text { color: oklch(var(--lighting-text) 0.01 250); }
```

> This eliminates duplicate stylesheets. One token set, two modes.

### Respect `prefers-reduced-motion`

Users with vestibular disorders set this preference. You MUST respect it:

```css
/* Reduce or remove all motion when requested */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

```tsx
// React: check programmatically
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches

// Framer Motion: automatic respect
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
/>
```

---

## 8. HSB Color Palette Creation (Practical Technique)

When you need to create color variations FROM a base color, use the HSB model (Hue, Saturation, Brightness) instead of guessing hex codes.

### Creating Darker Variations (Shadows)

From your base color:
1. Shift the **Hue** toward blues/purples (colder) for more natural-looking shadows
2. Increase **Saturation** by +15 to +25
3. Decrease **Brightness** by -10 to -20

```
BASE COLOR:     H:120  S:60  B:80  (green)
SHADOW:         H:135  S:80  B:60  (shifted blue, more saturated, darker)
```

### Creating Lighter Variations (Highlights)

From your base color:
1. Shift the **Hue** slightly toward yellows/warm (warmer)
2. Decrease **Saturation** by -20 to -30
3. Increase **Brightness** by +10 to +15

### Creating Accent/Highlighted Elements

For folders, cards, or elements that need to "pop":
- Increase Saturation (S) by +20
- Decrease Brightness (B) by -10

```
BASE:     H:210  S:50  B:90
ACCENT:   H:210  S:70  B:80  (more vivid, slightly darker)
```

> **Key insight:** NEVER generate random hex values. Always derive variations mathematically from your base using HSB shifts.

---

## 9. Corner Radius Math

### Nested Radius Rule

When you have a rounded container inside another rounded container:

```
INNER RADIUS = OUTER RADIUS - PADDING BETWEEN THEM
```

Example: Outer container has 16px radius and 8px padding → Inner element gets 8px radius.

```
┌──────────────────┐  ← outer: border-radius: 16px
│  ┌──────────────┐│  ← inner: border-radius: 8px (16-8=8)
│  │              ││     padding: 8px
│  │              ││
│  └──────────────┘│
└──────────────────┘
```

### iOS Corner Smoothing (Squircle Effect)

Standard CSS `border-radius` creates a circular arc that transitions abruptly. Premium apps use "squircle" smoothing for organic, fluid corners.

**In Figma:** Set "iOS Corner Smoothing" to maximum (100%) on the corner radius settings.

**In CSS/Tailwind:** There's no native squircle, but you can approximate:

```css
/* Standard — abrupt circular arc */
border-radius: 16px;

/* Premium approximation — slightly oversized for optical smoothing */
border-radius: 18px; /* 10-15% larger than mathematical for perception */

/* For React Native: iOS uses continuous corners natively */
/* Android: use borderCurve: 'continuous' (React Native 0.71+) */
```

**In React Native:**
```tsx
<View style={{
  borderRadius: 16,
  borderCurve: 'continuous', // iOS squircle effect
}} />
```

### Consistency Rule

Define ONE set of radius values and use them everywhere:

| Usage | Radius |
|-------|--------|
| Small elements (badges, chips) | 4-6px |
| Buttons, inputs | 8px |
| Cards, containers | 12-16px |
| Modals, large surfaces | 16-24px |

---

## 10. Visual Hierarchy

### Don't Saturate with Effects

- No abuse of gradients, blurs, or excessive shadows
- Opt for simplicity so information (especially charts) is easy to understand
- One effect maximum per element

### Visual Connectivity

Reuse visual patterns across screens so the user connects related information:
- Same dot style for status indicators
- Same color for related data points across different views
- Consistent icon style throughout

### Visual Connectivity (Cross-Screen Coherence)

Reuse the SAME visual patterns across different screens so the user subconsciously connects related information:

- Same dot/circle style for status indicators everywhere (don't use a dot on one screen and a badge on another)
- Same color coding for states (green = active, red = urgent) consistently across ALL views
- Same card layout proportions across different entity types
- If you use a specific animation for "success" in one place, use it everywhere

```
CONNECTIVITY EXAMPLE:
──────────────────────────────────────
Appointments list:  ● green dot = confirmed
Agenda view:        ● green dot = confirmed    ← SAME PATTERN
Client detail:      ● green dot = active       ← SAME PATTERN
Dashboard stat:     ● green dot = online       ← SAME PATTERN
──────────────────────────────────────
```

### Card Optimization

- Move secondary buttons to a "triple dot" menu (...)
- Use simple icons for status instead of text labels
- Leave MORE space for actual data
- Remove unnecessary borders if contrast is sufficient

```
BAD CARD:
┌──────────────────────────────┐
│ Title          [Edit] [Del]  │
│ Status: Active               │
│ Created: Jan 15, 2024        │
│ Description: Lorem ipsum...  │
│ [View] [Share] [Archive]     │
└──────────────────────────────┘

GOOD CARD:
┌──────────────────────────────┐
│ Title               ● Active │  ← dot for status
│ Jan 15              [⋯]     │  ← menu for secondary
│ Lorem ipsum dolor sit amet   │
└──────────────────────────────┘
```

---

## 11. Layout Optimization

### Maximum Container Width

For web dashboards, keep the main content within a **960px** max-width container to ensure comfortable scanning:

```css
.dashboard-content { max-width: 960px; margin: 0 auto; }
/* Tailwind: className="max-w-screen-lg mx-auto" */
```

This prevents content from spreading too wide on large monitors, which makes reading and scanning harder.

### Breaking the Grid (Intentional Overflow)

Follow the grid strictly for most content, but **intentionally break it** for moments of visual surprise:

```
STANDARD GRID:                    GRID-BREAKING ELEMENT:
┌──────────────────────┐          ┌──────────────────────────────→
│ ┌────┐ ┌────┐ ┌────┐│          │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ →
│ │Card│ │Card│ │Card││          │ │    │ │    │ │    │ │    │ → overflows
│ └────┘ └────┘ └────┘│          │ └────┘ └────┘ └────┘ └────┘ →
└──────────────────────┘          └──────────────────────────────→
  Content within container          Horizontal scroll / carousel
                                    extends to screen edge
```

Best candidates for grid-breaking:
- Image carousels / testimonials (overflow right edge)
- Hero sections (full-bleed backgrounds)
- Feature showcases (alternating full-width / contained)

> **Rule:** Breaking the grid is effective ONLY when the rest of the page follows the grid strictly. If everything breaks, nothing surprises.

### Sidebar/Navigation Cleanup

- Don't repeat KPIs on every screen (if user is in Settings, they don't need click counts)
- Group Account, Billing, and Usage into a single popover/menu
- Clean navigation = professional feel

### Modal vs Flyout Decision

| Scenario | Use |
|----------|-----|
| Few fields, simple action | Centered modal |
| Many fields, complex form | Side flyout/panel |
| Quick confirmation | Small centered modal |
| Data browsing + editing | Full-page or split view |

> If a "Create" modal has few fields but lots of space, a CENTERED modal is more appropriate than a sidebar panel. Hide advanced options by default.

### Dashboard Data Visualization

| Instead of... | Use... |
|-------------|--------|
| Plain lists for resource usage | Donut/ring charts |
| Bar charts for geographic data | Heat maps with side data |
| Single data views | Comparison toggles (compare items) |
| Text-only reports | Visual cards with sparklines |

### Responsive Data Tables

Data tables are the hardest UI element to make responsive. Use these patterns:

| Screen Width | Pattern | Implementation |
|-------------|---------|---------------|
| Desktop (1024px+) | Full table with all columns | Standard `<table>` |
| Tablet (768-1023px) | Priority columns (hide low-priority) | `display: none` on secondary columns |
| Mobile (<768px) | Card collapse (each row = card) | CSS Grid or stacked divs |

**Card Collapse Pattern:**

```
DESKTOP TABLE ROW:                MOBILE CARD:
┌────┬────────┬──────┬──────┐    ┌──────────────────────┐
│ ID │ Name   │ Date │ Amt  │    │ Maria Garcia          │
└────┴────────┴──────┴──────┘    │ Jan 15 · $120         │
                                 │ Status: Confirmed ●   │
                                 └──────────────────────┘
```

**Rules:**
- Show 3-4 key fields on mobile card, tap to expand full details
- Fixed/sticky header on desktop tables for long scrolling
- Column headers become inline labels on mobile cards
- Preserve sort/filter controls above the card list

---

## 12. Eliminating "AI-Generated" Look

AI-generated interfaces have a recognizable aesthetic: over-decorated, symmetrical, cliché.
Professional design is restraint — every element earns its place.

### The #1 Rule: If It Doesn't Function, Remove It

Decorative elements that serve no purpose make a page feel cheap.
Ask: "Does this help the user understand or act?" If no → delete it.

### Decorative Elements Blacklist (AI Slop Signals)

These patterns are hallmarks of AI-generated design. **NEVER use them:**

| AI Slop Pattern | Why It's Bad | Professional Alternative |
|----------------|-------------|------------------------|
| **Floating gradient blobs** (`blur-3xl rounded-full bg-purple/10`) | Purely decorative filler, adds zero information | Clean background or subtle single-tone gradient |
| **Animated floating dots** (`animation: float 6s infinite`) | Distracting, screams "AI template" | No ambient animation. Static is professional |
| **Grid/dot pattern overlays** (`bg-[linear-gradient(...1px...)]`) | Generic texture that adds nothing | Flat background or use actual content for visual interest |
| **Noise/grain texture overlays** (`feTurbulence` SVG) | Cliché "depth" trick everyone recognizes | Let content and typography create depth |
| **Sparkle/star icons** as badges (`<Sparkle weight="fill" />`) | Overused AI decoration motif | Plain text label, no icon needed |
| **Multi-radial-gradient layering** (3+ gradient divs stacked) | Over-engineered depth simulation | Single flat color or one simple gradient |
| **Floating frosted-glass nav** (`backdrop-blur-xl rounded-2xl`) | Overdone "glassmorphism" trend | Simple `border-b` header, no blur needed |
| **Colored pill badges** for non-interactive trust signals | Over-designed for static text | Inline text with icon, plain `text-muted-foreground` |
| **Gradient icon backgrounds** (`bg-gradient-to-br ring-1`) | Unnecessarily ornate icon treatment | Icon in `text-muted-foreground`, no background |
| **Logo with gradient backgrounds** (`from-violet-600 to-fuchsia-600`) | Cliché AI branding shortcut | Monochrome icon or text-only logo |
| **"Potenciado por X" / "Powered by X"** sparkle badges | Self-referential vanity, wastes hero space | If needed, plain small text — no badge |
| **Centered hero with centered everything** | Every AI page looks identical | Left-aligned hero is more editorial and distinctive |
| **hover effects on non-interactive elements** | Cursor pointer on cards that aren't links is dishonest UX | Only animate/elevate elements the user can actually click |

### Layout Tells (AI vs Professional)

```
AI-GENERATED HERO:                     PROFESSIONAL HERO:
┌──────────────────────────┐           ┌──────────────────────────┐
│ ● ●    (floating dots)   │           │                          │
│ ░░░░░░ (gradient blobs)  │           │ Small label              │
│ ▒▒▒▒▒▒ (grid pattern)   │           │                          │
│                          │           │ Large Bold               │
│     ✨ Badge ✨           │           │ Headline                 │
│                          │           │                          │
│   Big Centered Title     │           │ Supporting text that     │
│                          │           │ explains the product.    │
│   Centered subtitle      │           │                          │
│                          │           │ [CTA Button]  [Secondary]│
│  [Gradient CTA] [Glass]  │           │                          │
│                          │           │ ✓ Feature · ✓ Feature    │
│ ░░░░░░ (more blobs)     │           │                          │
└──────────────────────────┘           └──────────────────────────┘
 ↑ 6+ decorative layers                ↑ 0 decorative layers
 ↑ Centered, symmetrical               ↑ Left-aligned, editorial
 ↑ Badges with sparkles                ↑ Plain text label
 ↑ Complex background                  ↑ Flat background
```

### The Professional Stack (What TO Do)

1. **Typography does the work** — Large bold headline, good spacing, tight tracking on big text
2. **Content creates visual interest** — Not decoration. Show real product data, screenshots, or nothing
3. **One accent color, used sparingly** — In buttons and links only, not splashed everywhere
4. **Left-aligned layouts** — More distinctive than centered-everything
5. **Flat backgrounds** — The content IS the visual. Don't compete with it
6. **Standard components** — Use default `<Button>` without overriding with custom gradients/shadows
7. **Restraint over spectacle** — A clean grid with good spacing > animated gradient cards
8. **Dividers over borders** — A single `<hr>` separating sections is more elegant than cards

### Button Anti-Patterns

```
AI BUTTONS:                            PROFESSIONAL BUTTONS:
┌──────────────────────┐               ┌──────────────────────┐
│ bg-violet-600         │               │ bg-primary            │
│ shadow-violet-glow    │               │ (uses theme token)    │
│ hover:-translate-y-0.5│               │ (no special hover)    │
│ rounded-xl            │               │ (default radius)      │
│ text-white            │               │ text-primary-fg       │
└──────────────────────┘               └──────────────────────┘
 ↑ Hardcoded brand color                ↑ Follows design system
 ↑ Custom shadow glow                   ↑ Standard shadow
 ↑ Float-up hover                       ↑ Simple opacity hover
 ↑ Extra-rounded                        ↑ Consistent radius
```

Use the design system's `<Button>` as-is. If the default button looks bad, fix the theme tokens — don't override individual buttons with custom classes.

### Common AI Design Mistakes

| Mistake | Fix |
|---------|-----|
| Emojis as icons | Use Phosphor Icons, Lucide, or Hero Icons |
| Too-bright colors without harmony | Use professional palette, tint backgrounds subtly |
| KPIs repeated everywhere | Show contextual data only |
| All buttons equally prominent | Hierarchy: primary → secondary → ghost |
| Generic stock-looking layouts | Add real product screenshots, actual data patterns |
| Default Figma shadows | Remove or soften dramatically |

### The Presentation Rule

- A good graphic of YOUR OWN interface elevates perceived value more than any icon or illustration
- Use styled screenshots of actual app screens on landing pages
- Presentation IS credibility

---

## 13. Line Elimination

### Replace Lines with Space

```
BAD:                          GOOD:
┌────────────────┐            ┌────────────────┐
│ Row 1          │            │ Row 1          │
│────────────────│            │                │
│ Row 2          │            │ Row 2          │
│────────────────│            │                │
│ Row 3          │            │ Row 3          │
└────────────────┘            └────────────────┘
  Lines everywhere              Space is enough
```

### Alternating Backgrounds

If space is tight, use subtle alternating row backgrounds instead of divider lines:

```css
/* Zebra striping */
tr:nth-child(even) {
  background: hsl(var(--muted) / 0.3);
}
```

---

## 14. Data Chart Legibility (Dashboard)

Don't over-design charts for beauty at the cost of readability.

### Rules

- **Keep vertical axes clear** — readable numbers, proper scale
- **Don't over-round bar charts** — excessive rounding makes it hard to read exact values
- **Simplify backgrounds** — charts should have minimal gridlines (2-3 horizontal lines max)
- **Use OKLCH for chart colors** (see Layer 4) so all series have equal perceived brightness
- **Label directly** — put labels on or near the data, not in a separate legend when possible

```
BAD CHART:                    GOOD CHART:
┌────────────────────┐       ┌────────────────────┐
│   ╭─╮              │       │   ┌─┐              │
│ ╭─╯ ╰─╮  ╭─╮      │       │ ┌─┘ └─┐  ┌─┐      │
│ ╯     ╰──╯ ╰──╮   │       │ ┘     └──┘ └──┐   │
│               ╰─╮  │       │               └─┐  │
│  (no axis, curvy)   │       │  100 ─── 50 ─── 0  │
└────────────────────┘       └────────────────────┘
 Looks pretty but             Clean, precise,
 hard to read values          easy to compare
```

### Dashboard Data Visualization Decision Table

| Data Type | Best Chart | Why |
|-----------|-----------|-----|
| Resource usage (% of total) | Donut/ring chart | Instant comprehension of proportion |
| Trends over time | Line chart (clean) | Shows direction clearly |
| Comparing categories | Horizontal bar chart | Easy to scan with labels |
| Geographic data | Heat map + side numbers | Rich context + precise values |
| Single KPI | Large number + sparkline | Prominent with trend context |
| A vs B comparison | Toggle comparison view | Direct side-by-side insight |

---

## 15. Card Information Grouping

When designing cards with multiple data points, GROUP related information together and ORDER by importance.

### Grouping Rule

```
CARD GROUPING:
┌──────────────────────────────┐
│ [Avatar]  Name + Location    │ ← Group 1: Identity
│           ★ 4.8 rating       │
│                              │
│ $120/night    2 beds         │ ← Group 2: Key decision data
│                              │
│ Jan 15 - Jan 20  [⋯]        │ ← Group 3: Secondary details
└──────────────────────────────┘
```

### Hierarchy Rules

1. **Most relevant = larger + higher position** (name, main image, price)
2. **Supporting info = normal size** (rating, distance, category)
3. **Least important = smaller + bottom** (dates, IDs, metadata)
4. **Remove labels when context is clear** — if a card is in the "Hotels" section, you don't need a "Hotel:" label

### Prioritize Values Over Labels (Data Cards)

In metric/stat cards, the **number/value must dominate** — not the label:

```
BAD:                              GOOD:
┌──────────────┐                  ┌──────────────┐
│ Total Sales  │ ← label big      │ Total Sales  │ ← label small, muted
│ 591          │ ← number small    │ 591          │ ← number BIG, bold
│ +12% ↑       │                  │ +12% ↑       │ ← semantic green
└──────────────┘                  └──────────────┘
```

```tsx
// Implementation
<div>
  <span className="text-xs text-muted-foreground">Total Sales</span>
  <span className="text-3xl font-bold tabular-nums">591</span>
  <span className="text-sm text-green-500">+12%</span>
</div>
```

---

