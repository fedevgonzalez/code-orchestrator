---
name: premium-ui-design
description: |
  Premium visual design system rules for web dashboards and mobile apps.
  Covers 4-layer color theory, OKLCH color space, typography system, 8pt grid spacing,
  shadow/gradient discipline, iconography consistency, dark mode rules, corner radius math,
  visual hierarchy, card design, and layout optimization.
  Use this skill when building UI, reviewing visual design, or implementing design tokens.
allowed-tools: Read, Glob, Grep, Edit, Write
version: 1.0.0
---

# Premium UI Design

Technical visual design rules that transform amateur interfaces into production-grade,
enterprise-level products. Applies to BOTH web dashboards and mobile apps.

---

## When to Use This Skill

- Building or reviewing UI components
- Setting up a design system or theme tokens
- Implementing dark mode
- Choosing colors, fonts, or spacing values
- Designing cards, tables, or data visualizations
- Reviewing generated UI for "AI-generated" appearance
- Optimizing visual hierarchy
- Creating professional data dashboards

---

## 1. Four-Layer Color System

**Principle:** Don't use 60-30-10 rigidly. Use a four-layer system for rich, interactive, professional interfaces.

### Layer 1: Neutral Foundation (Backgrounds & Text)

You need MULTIPLE background levels for depth, not just one.

```
BACKGROUND HIERARCHY (Light Mode):
──────────────────────────────────────
Level 0: Page background    → 98% white with subtle blue tint
Level 1: Sidebar/Nav        → 96% white (slightly darker, acts as anchor)
Level 2: Cards/Containers   → Pure white (#FFFFFF)
Level 3: Elevated elements  → Pure white + subtle shadow
──────────────────────────────────────
```

**Text Hierarchy:**

| Role | Light Mode | Dark Mode |
|------|-----------|-----------|
| Title/Heading | 11% white (very dark gray) | 95% white |
| Body text | 15-20% white | 85-90% white |
| Subtext/Caption | 30-40% white | 60-65% white |
| Placeholder | 50-60% white | 40-50% white |

**Border Rules:**
- AVOID thick black borders
- Use subtle borders: 85% white (light mode) / 20% white (dark mode)
- Or use 1px borders with 5-8% opacity of the text color

### Layer 2: Brand Accent Scale (Interactive Elements)

Think of your brand color NOT as one color, but as a **10-level scale** from light to dark:

```
BRAND COLOR RAMP:
──────────────────────────────────────
50   → Very light tint (hover backgrounds, badges)
100  → Light tint (selected row background)
200  → Light (secondary button backgrounds)
300  → Medium-light (links, active states)
400  → Medium (secondary emphasis)
500  → Base (default button color)
600  → Medium-dark (hover on primary button)
700  → Dark (pressed state)
800  → Very dark (high emphasis text)
900  → Near-black (rare, extreme emphasis)
──────────────────────────────────────
```

**Button Hierarchy by Darkness:**

```
MORE IMPORTANT ──────────────────────> LESS IMPORTANT
[Solid Dark]  [Solid Base]  [Outline]  [Ghost/Text]
   900           500          300         200
```

> Rule: "The more important the button, the DARKER it must be" (in light mode)

**Secondary Button Trick (5% Opacity Primary):**

Use your primary color at very low opacity (5-10%) for secondary button backgrounds and subtle card highlights. This creates cohesion without competing with the primary CTA:

```css
/* Secondary button — tinted with primary at 5% */
.btn-secondary {
  background: oklch(var(--primary) / 0.05);
  color: oklch(var(--primary));
}

/* Tailwind: bg-primary/5 text-primary */
```

### Layer 3: Semantic Colors (Status & Meaning)

These are NON-NEGOTIABLE regardless of brand:

| Meaning | Color | Usage |
|---------|-------|-------|
| Destructive/Error | Red | Delete buttons, error messages, form errors |
| Success | Green | Confirmations, completed states, positive deltas |
| Warning | Amber/Orange | Alerts, approaching limits |
| Info | Blue | Informational banners, help text |

> **Design sin:** Using brand color for destructive actions. Red = destructive. Always.

### Layer 4: Data Visualization (OKLCH)

For charts and graphs with PERCEPTUALLY UNIFORM brightness:

```
OKLCH COLOR GENERATION FOR CHARTS:
──────────────────────────────────────
1. Pick a starting hue (e.g., 250° blue)
2. Keep Lightness (L) constant: 0.65
3. Keep Chroma (C) constant: 0.15
4. Rotate Hue by 25-30° for each data series

Example palette:
  oklch(0.65 0.15 250)  → Blue
  oklch(0.65 0.15 280)  → Purple
  oklch(0.65 0.15 310)  → Pink
  oklch(0.65 0.15 340)  → Red
  oklch(0.65 0.15 10)   → Orange
  oklch(0.65 0.15 40)   → Yellow
  oklch(0.65 0.15 70)   → Lime
  oklch(0.65 0.15 100)  → Green
──────────────────────────────────────
```

This ensures ALL chart colors have the SAME perceived brightness (no "screaming" green next to muted blue).

### Focus State Design (Accessibility)

Focus indicators are NOT optional — they're legally required (WCAG 2.2). Every interactive element must show a visible focus ring:

```css
/* Minimum viable focus indicator */
:focus-visible {
  outline: 2px solid oklch(var(--primary));
  outline-offset: 2px;
}

/* Hide on mouse clicks, show on keyboard */
:focus:not(:focus-visible) {
  outline: none;
}
```

**Rules:**
- Outline minimum: 2px solid, 3:1 contrast ratio against surrounding colors
- Use `outline-offset: 2px` to avoid clipping by `overflow: hidden`
- Tailwind: `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`
- WCAG 2.2 requires minimum 24x24 CSS pixels target size (44px recommended for mobile)

### Tailwind Shortcut for Tinted Backgrounds

```
Light mode: bg-{color}-50 for background, text-{color}-500 for accent
Dark mode:  bg-{color}-950 for background, text-{color}-300 for accent
```

---

## 2. The 60-30-10 Rule (Simplified)

When in doubt, fall back to this:

| Percentage | Role | Examples |
|-----------|------|---------|
| **60%** | Neutral backgrounds | White, light gray, page background |
| **30%** | Complementary | Dark text, secondary elements, cards |
| **10%** | Brand/Accent | CTAs, alerts, active states, links |

**Key insight:** Replace complex gradients with flat colors that enhance data readability.

---

## 3. Typography System

### Font Size Discipline

**MAXIMUM 4 font sizes + 2 weights in your entire app:**

| Role | Size (example) | Weight |
|------|---------------|--------|
| Page title / Hero | 28-32px | Bold (700) |
| Section heading | 20-24px | Semi-bold (600) |
| Body / Content | 14-16px | Regular (400) |
| Caption / Label | 12-13px | Regular (400) |

> Using more than 4 sizes breaks visual harmony. Fight the urge.

### Line Height (Interlineado)

| Text Role | Line Height | Why |
|-----------|-------------|-----|
| Headings (hero, titles) | 1.1x – 1.3x | Tight = compact, professional feel |
| Body / Content | 1.3x – 1.5x | Loose = readable, scannable |
| Captions / Labels | 1.2x – 1.3x | Compact but still legible |

```css
/* Headings — tight */
.heading { line-height: 1.2; }

/* Body — comfortable reading */
.body { line-height: 1.5; }
```

### Maximum Text Width

Limit body text to a maximum of **600px** (or 50–75 characters per line) to prevent "wall of text" fatigue:

```css
.prose { max-width: 600px; }
/* Or in Tailwind: className="max-w-prose" (65ch ≈ 600px) */
```

> If a paragraph exceeds 75 characters per line, readability drops sharply. The eye loses its place on the next line return.

### Alignment Consistency

**NEVER mix alignments within a section:**

- If the title is centered → the body MUST be centered
- If the body text is more than 3 lines → **always left-align** (centered multi-line is hard to read)
- Buttons under centered text → center the button too

```
BAD:                              GOOD:
┌──────────────────┐              ┌──────────────────┐
│  Title Centered   │              │  Title Centered   │
│ Body text left    │              │  Body text also   │
│ aligned which     │              │  centered when    │
│ looks broken      │              │  short (≤3 lines) │
└──────────────────┘              └──────────────────┘
```

### Monospace for Dynamic Numbers

Use monospaced fonts for ANY number that changes frequently (counters, prices, stats, rewards) to prevent layout "jumping":

```tsx
// BAD: proportional font causes width changes
<span className="text-2xl font-bold">$1,234</span>

// GOOD: monospace tabular numerals prevent jumping
<span className="text-2xl font-bold tabular-nums font-mono">$1,234</span>
// Or with Tailwind: className="tabular-nums"
```

### Fluid Typography with CSS clamp()

Instead of jumping between sizes at breakpoints, use `clamp()` for smooth, continuous font scaling:

```css
/* FLUID TYPE SCALE (mobile 320px → desktop 1200px) */
--text-hero:    clamp(2rem, 1.5rem + 2.5vw, 3.5rem);    /* 32px → 56px */
--text-heading: clamp(1.5rem, 1.2rem + 1.5vw, 2.25rem);  /* 24px → 36px */
--text-body:    clamp(0.875rem, 0.8rem + 0.4vw, 1rem);    /* 14px → 16px */
--text-caption: clamp(0.75rem, 0.7rem + 0.2vw, 0.8125rem); /* 12px → 13px */
```

**The clamp() Formula:** `clamp(MIN, PREFERRED, MAX)`
- `MIN` = smallest the font should be (mobile)
- `PREFERRED` = `rem + vw` (scales with viewport)
- `MAX` = largest the font should be (desktop)

**Accessibility Rule:** The max size must be ≤ 2.5x the min size to pass WCAG SC 1.4.4 (resize text). Example: min 16px, max 40px = 2.5x (passes).

**Fluid Spacing (same principle):**

```css
/* Apply clamp() to spacing too for fully fluid layouts */
--space-section: clamp(2rem, 1.5rem + 3vw, 5rem);   /* 32px → 80px */
--space-card:    clamp(1rem, 0.75rem + 1.5vw, 2rem); /* 16px → 32px */
```

> **Key:** Never use `vw` alone for font-size — it doesn't respond to zoom. Always combine `rem + vw` so that browser zoom still works.

### Large Text Kerning

For text larger than 70-80px, reduce letter-spacing by -2% to -4%:

```css
.hero-title {
  font-size: 80px;
  letter-spacing: -0.03em; /* -3% */
}
```

This prevents large text from looking "disjointed."

---

## 4. Spacing System (8pt Grid)

**All margins, paddings, and sizes must be divisible by 8 (or 4 for small details).**

```
SPACING SCALE:
──────────────────────────────────────
4px   → Micro spacing (icon-to-label gap)
8px   → Small (padding inside compact elements)
16px  → Medium (standard padding, gaps)
24px  → Large (section padding)
32px  → Extra large (major section breaks)
48px  → Hero spacing
64px  → Page-level spacing
──────────────────────────────────────
```

### Grouping Rules (The Relationship Multiplier)

Use **multipliers** based on how related elements are:

- Related elements: 8-16px gap (close = related)
- Between groups: 24-32px gap — **2x base** (separation = different topic)
- Between sections: 48-64px gap — **4x base** (major break)
- Between dashboard sections: **160px+** vertical space for full "breathing room"

> **Rule of Thumb:** If two elements are closely related, give them a base spacing (e.g., 16px). For the next less-related group, **double it** (32px). For major sections, **quadruple it** (64px+).

### Card Padding

A safe default for card internal padding is **32px** (Tailwind `p-8`). This prevents cards from feeling "cramped":

```
CARD PADDING:
┌─────────────────────────────┐
│ ← 32px →                   │
│         Title               │
│         Subtitle            │
│                             │
│         Content area        │
│                             │
│ ← 32px →                   │
└─────────────────────────────┘
```

For compact cards (mobile, dense dashboards), use 16-24px. Never go below 12px.

```
GROUPING EXAMPLE:
┌──────────────────────────┐
│ Section Title             │  ← 48px above
│                           │  ← 16px below title
│ ┌──────────────────────┐ │
│ │ Item 1                │ │  ← 8px between items
│ │ Item 2                │ │     (same group)
│ │ Item 3                │ │
│ └──────────────────────┘ │
│                           │  ← 32px between groups
│ ┌──────────────────────┐ │
│ │ Item A                │ │
│ │ Item B                │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

### Configure Nudge Settings

In design tools, set nudge amount to 8px to enforce consistency.
In code, use Tailwind's spacing scale (which is already 4px-based: `p-1`=4px, `p-2`=8px, `p-4`=16px).

---

## 5. Shadow & Gradient Discipline

### Shadows

- **NEVER use default shadow values** (they're usually too harsh)
- Change shadow COLOR to light gray (not black)
- Increase blur significantly
- Or eliminate shadows entirely if contrast is sufficient

```css
/* BAD: Default harsh shadow */
box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);

/* GOOD: Subtle professional shadow */
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04),
            0 4px 12px rgba(0, 0, 0, 0.06);

/* BETTER: No shadow, use border instead */
border: 1px solid hsl(var(--border));
```

### Tinted Shadows (Background-Matched)

**Never use pure gray/black shadows.** Tint the shadow color to match the background hue for visual harmony:

```css
/* BAD: Generic gray shadow on purple background */
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

/* GOOD: Shadow tinted with the background color */
/* If background is purple-ish, shadow should be a darker purple */
box-shadow: 0 4px 12px rgba(120, 80, 160, 0.15);

/* OKLCH approach: same hue as background, lower lightness, low chroma */
box-shadow: 0 4px 12px oklch(0.3 0.05 280 / 0.12);
```

> **Rule:** Look at the background hue → make the shadow a darker, more saturated version of that same hue. This creates seamless visual integration instead of "floating" elements.

### Gradients

- **NEVER mix different colors** (blue → green = amateur)
- **Allowed:** Variations of the SAME color (light green → dark green)
- **Best:** Use flat colors and add visual interest through layout/content instead

```css
/* BAD: Multi-hue gradient */
background: linear-gradient(135deg, #3b82f6, #10b981);

/* GOOD: Single-hue gradient */
background: linear-gradient(135deg, oklch(0.75 0.15 145), oklch(0.55 0.15 145));

/* BEST: Flat color with accent through content */
background: oklch(0.98 0.01 145);
```

---


## Reference Documentation

For detailed techniques, code examples, and advanced patterns, read these reference files:

- **docs/advanced-techniques.md** - Iconography, dark mode, HSB palettes, corner radius math, visual hierarchy, layout optimization, eliminating AI-generated look, line elimination, chart legibility, card grouping
- **docs/web-animations-performance.md** - Framer Motion patterns, scroll/image patterns, View Transitions API, modal accessibility, INP and Core Web Vitals, theming

---
## Anti-Patterns

| Anti-Pattern | Why It's Bad | Fix |
|-------------|-------------|-----|
| Pure black (#000) backgrounds | Harsh on eyes | Use dark blue-gray (oklch) |
| Multi-hue gradients (blue→green) | Amateur look | Same-hue gradient or flat color |
| More than 4 font sizes | Breaks harmony | Limit to 4 sizes + 2 weights |
| Default tool shadows | Too harsh | Soften color + increase blur |
| Random spacing values | Messy feel | 8pt grid system |
| Mixed icon libraries | Inconsistency | Single library, single weight |
| Emojis as UI icons | Unprofessional | Professional icon library |
| Same radius everywhere | Ignores nested math | Outer - padding = inner |
| Equal button prominence | No hierarchy | Primary → secondary → ghost |
| Lines between every row | Visual clutter | Space or alternating backgrounds |
| Body text wider than 600px | Wall of text, eye loses line | max-width: 600px or max-w-prose |
| Mixed text alignments | Feels broken, disjointed | Center or left-align consistently |
| Gray/black shadows on colored bg | Shadows "float" unnaturally | Tint shadows with background hue |
| Label bigger than value in stat cards | Buries the important data | Value 3x larger than label |
| No max-width on dashboard content | Content too spread on wide screens | max-width: 960px |
| No visible focus indicator | Keyboard users can't navigate | 2px outline + offset, 3:1 contrast |
| Full table on mobile | Impossible to read, horizontal scroll | Card collapse or priority columns |
| Ignoring prefers-reduced-motion | Vestibular disorder users get sick | Disable animations when requested |
| Duplicate dark/light stylesheets | Maintenance nightmare | OKLCH token swap (single source) |
| Font sizes jump at breakpoints | Jarring, unprofessional | Fluid typography with clamp() |
| Using vw alone for font-size | Breaks zoom accessibility | Always combine rem + vw in clamp() |

---

## Checklist

Before shipping ANY UI:

- [ ] Background has 3-4 depth levels (not flat single color)?
- [ ] Text follows 3-level hierarchy (heading/body/caption)?
- [ ] Brand color has a 10-level ramp (not single color)?
- [ ] Semantic colors are correct (red=destructive, green=success)?
- [ ] Maximum 4 font sizes used across the entire app?
- [ ] All spacing divisible by 8 (or 4 for micro)?
- [ ] Shadows are subtle (not default harsh values)?
- [ ] No multi-hue gradients?
- [ ] Icons from single library with consistent weight?
- [ ] No emojis used as functional icons?
- [ ] Dark mode uses double-distance between background levels?
- [ ] Dark mode elevation goes LIGHTER (not darker)?
- [ ] Nested border radius follows the subtraction rule?
- [ ] Dynamic numbers use monospace/tabular-nums?
- [ ] Large text (70px+) has negative letter-spacing?
- [ ] Lines replaced with spacing or alternating backgrounds?
- [ ] Chart colors use OKLCH for perceptual uniformity?
- [ ] Line height: 1.1-1.3x for headings, 1.3-1.5x for body text?
- [ ] Body text max-width: 600px (50-75 chars per line)?
- [ ] Text alignment consistent within each section (no mixing)?
- [ ] Shadows tinted with background hue (no pure gray/black shadows)?
- [ ] Stat cards: value dominates, label is small/muted?
- [ ] Dashboard content within max-width container (~960px)?
- [ ] Card padding at least 32px (or 16-24px on compact/mobile)?
- [ ] Focus indicators visible on all interactive elements (2px, 3:1 contrast)?
- [ ] `prefers-reduced-motion` respected (animations disabled/reduced)?
- [ ] Data tables collapse to cards on mobile (<768px)?
- [ ] OKLCH tokens used for dark mode swap (not duplicate stylesheets)?
- [ ] Fluid typography with clamp() (no breakpoint jumps)?
- [ ] Font clamp() uses rem+vw (not vw alone) for zoom accessibility?

---

## Related Skills

- `premium-ux-patterns` - UX psychology and behavioral patterns
- `mobile-ux-design` - Mobile-specific design patterns
- `frontend-design` - Implementation patterns (code)
- `shadcn-theming` - shadcn/ui CSS variable system
- `tailwind-theming` - Tailwind CSS theming
- `design-system` - Design token mapping
