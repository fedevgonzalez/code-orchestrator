---
name: frontend-design
description: |
  Master orchestrator skill for creating and reviewing premium frontend interfaces.
  Flexibly handles: building new screens, reviewing existing UI, refining quality,
  auditing components, and full app-wide design audits.
  ORCHESTRATOR: Routes to premium-ux-patterns + premium-ui-design + mobile-ux-design.
  Covers animation decomposition workflow, illustration systems, and unified design review.
allowed-tools: Read, Glob, Grep, Edit, Write
version: 2.0.0
---

# Frontend Design (Orchestrator)

This is the **master skill** for frontend design quality. It adapts to what you need:
building, reviewing, refining, or auditing — at any scope from a single component to the full app.

**When invoked, ALWAYS:**
1. Classify the task type
2. Determine the scope and platform
3. Load the appropriate sub-skills
4. Follow the execution mode workflow

---

## 1. Task Classification

Classify the request into one of these execution modes:

```
MODE        TRIGGER SIGNALS                                  SCOPE
─────────────────────────────────────────────────────────────────────────────
BUILD       "create", "build", "design", "implement"         New screen, component, or feature
REVIEW      "review", "check", "how does it look", "feedback" Specific screen or component
REFINE      "improve", "polish", "make premium", "enhance"   Existing screen or component
COMPONENT   "this button", "the card", single element focus  Individual component
AUDIT       "audit", "whole app", "all screens", "quality"   App-wide or multi-screen
```

> If the request doesn't clearly match one mode, ask: "Do you want me to review what exists, or build/improve something?"

---

## 2. Sub-Skill Loading Matrix

Based on platform context, load the appropriate sub-skills by reading them:

```
TASK CONTEXT                  LOAD THESE SKILLS
──────────────────────────────────────────────────────────────
Web dashboard / app UI        premium-ui-design + premium-ux-patterns
Mobile app screen (RN)        ALL THREE sub-skills
Mobile web (responsive)       premium-ui-design + mobile-ux-design
Landing page / marketing      premium-ui-design + premium-ux-patterns
Design review / audit         ALL THREE sub-skills
Component library work        premium-ui-design
Animation / interaction       premium-ux-patterns + mobile-ux-design
──────────────────────────────────────────────────────────────
```

Sub-skill locations:
- `.claude/skills/premium-ui-design/SKILL.md` — Visual rules (color, typography, spacing, dark mode, web animations, scroll patterns)
- `.claude/skills/premium-ux-patterns/SKILL.md` — UX psychology (flows, states, validation, button behavior, perceived performance)
- `.claude/skills/mobile-ux-design/SKILL.md` — Mobile-specific (nav, haptics, gestures, RN performance)

Related skills to reference when needed:
- `.claude/skills/accessibility/SKILL.md` — WCAG compliance, ARIA, focus management
- `.claude/skills/react-best-practices/SKILL.md` — Performance optimization, INP, Core Web Vitals
- `.claude/skills/tanstack-query/SKILL.md` — Data fetching, optimistic updates, cache
- `.claude/skills/shadcn-components/SKILL.md` — shadcn/ui component patterns

---

## 3. Execution Modes

### 3.1 BUILD Mode (Creating New UI)

```
WORKFLOW:
──────────────────────────────────────────────────
1. CONTEXT    → Determine platform (web / mobile / both)
2. RESEARCH   → Check Mobbin for how top apps solve the same problem
3. LOAD       → Read sub-skills per loading matrix
4. STRUCTURE  → Define layout skeleton (hierarchy, information grouping)
5. IMPLEMENT  → Apply design tokens, patterns from sub-skills
6. VALIDATE   → Run Design Review Checklist (Section 5)
7. ITERATE    → Fix findings, re-validate
──────────────────────────────────────────────────
```

Key decisions during BUILD:
- Color system → `premium-ui-design` Section 1
- Typography → `premium-ui-design` Section 3
- Spacing → `premium-ui-design` Section 4
- Empty / loading / error states → `premium-ux-patterns` Sections 7, 15, 16
- Navigation (mobile) → `mobile-ux-design` Section 1
- Animations → Section 6 of this skill (AI-Assisted Workflow)

### 3.2 REVIEW Mode (Evaluating Existing UI)

```
WORKFLOW:
──────────────────────────────────────────────────
1. CAPTURE    → Read the code / take screenshot of current state
2. CONTEXT    → Identify platform, screen purpose, user flow position
3. LOAD       → Read ALL THREE sub-skills for comprehensive review
4. EVALUATE   → Run through checklist categories in priority order:
                 a. Foundation (MUST pass)
                 b. Accessibility (MUST pass)
                 c. Performance (MUST pass)
                 d. Polish (SHOULD pass)
                 e. Mobile-specific (if applicable)
                 f. Delight (aspire to)
5. REPORT     → Generate findings with severity + fix recommendations
6. PRIORITIZE → Rank fixes by impact/effort ratio
──────────────────────────────────────────────────
```

Findings report format:

```
[CRITICAL] Issue description
  → Where: file:line or component name
  → Rule: Which checklist item / sub-skill section
  → Fix: Specific recommendation

[WARNING] Issue description
  → Where: ...
  → Fix: ...

[SUGGESTION] Improvement opportunity
  → Where: ...
  → Impact: How it elevates the experience
```

### 3.3 REFINE Mode (Improving Existing UI)

```
WORKFLOW:
──────────────────────────────────────────────────
1. CAPTURE    → Screenshot / read current state
2. DIAGNOSE   → Run REVIEW mode checklist (quick pass)
3. PRIORITIZE → Identify top 3-5 highest-impact improvements
4. APPLY      → Make changes one at a time, smallest first
5. VALIDATE   → After each change, verify it looks correct
6. COMPARE    → Summarize before vs after
──────────────────────────────────────────────────
```

Priority framework:

```
             LOW EFFORT         HIGH EFFORT
HIGH IMPACT  ★ DO FIRST         ◆ PLAN NEXT
LOW IMPACT   ○ NICE TO DO       ✗ SKIP FOR NOW
```

### 3.4 COMPONENT Mode (Single Component Focus)

```
WORKFLOW:
──────────────────────────────────────────────────
1. IDENTIFY   → Component type (button, card, input, list, modal, etc.)
2. STATES     → Verify ALL states exist and look correct:
                 • Default / Idle
                 • Hover (web) / Press feedback (mobile)
                 • Active / Selected
                 • Disabled
                 • Loading
                 • Error
                 • Empty (if applicable)
3. ACCESSIBLE → Check:
                 • Color contrast (4.5:1 text, 3:1 large/UI)
                 • Focus indicator visible (2px, 3:1 contrast)
                 • Touch target ≥ 44px (mobile) or 24px (desktop)
                 • ARIA attributes (role, labels)
                 • Keyboard navigable
4. RESPONSIVE → Check behavior at different viewport widths
5. DARK MODE  → Verify dark mode appearance
6. ANIMATION  → Check motion quality (spring physics, proper timing)
7. RECOMMEND  → Suggest improvements with priority
──────────────────────────────────────────────────
```

### 3.5 AUDIT Mode (App-Wide Assessment)

```
WORKFLOW:
──────────────────────────────────────────────────
1. INVENTORY  → List all screens / major components
2. CATEGORIZE → Group by traffic:
                 • High-traffic (home, main flows) → audit first
                 • Medium-traffic (secondary screens)
                 • Low-traffic (settings, edge cases)
3. QUICK SCAN → For each screen, check Foundation items only (fast pass)
4. SYSTEMIC   → Identify issues that repeat across multiple screens:
                 • Inconsistent spacing
                 • Typography violations
                 • Color inconsistencies
                 • Missing states (empty, loading, error)
                 • Accessibility gaps
5. SCORE      → Rate each area:
                 Foundation:  ■■■■□ (4/5)
                 Polish:      ■■■□□ (3/5)
                 Delight:     ■■□□□ (2/5)
                 Performance: ■■■■■ (5/5)
                 A11y:        ■■■□□ (3/5)
6. ROADMAP    → Generate prioritized improvement plan:
                 Phase 1: Quick wins (fix systemic issues)
                 Phase 2: Screen-by-screen polish
                 Phase 3: Delight layer (animations, celebrations)
──────────────────────────────────────────────────
```

---

## 4. Core Philosophy: The Premium Pyramid

A premium interface is NOT about adding more features. It's about:

1. **Removing friction** — cognitive load reduction
2. **Adding delight** — at peak moments (Peak-End Rule)
3. **Being consistent** — one icon library, one spacing system, one color system
4. **Anticipating needs** — smart defaults, personalization
5. **Feeling physical** — spring animations, haptic feedback

```
THE PREMIUM PYRAMID:
                    ▲
                   / \
                  /   \   DELIGHT
                 / Peak \  (animations, celebrations,
                /  moments \  branded loading)
               /───────────\
              /             \   POLISH
             / Consistency   \  (spacing, typography, color,
            /  & refinement   \  icon consistency, dark mode)
           /───────────────────\
          /                     \   FOUNDATION
         /    Clarity & Flow     \  (hierarchy, navigation,
        /    (zero friction)      \  readable content, clear CTAs)
       /───────────────────────────\
```

> Always build Foundation first, then Polish, then Delight. Never add Delight to a broken Foundation.

---

## 5. Design Review Checklist (Unified)

Use this checklist in REVIEW, REFINE, and AUDIT modes. Items are grouped by severity.

### Foundation (MUST Pass) — Severity: CRITICAL

- [ ] Clear visual hierarchy — eye knows where to go
- [ ] Single primary action per screen
- [ ] Consistent spacing (8pt grid)
- [ ] No hardcoded user-facing strings (i18n ready)
- [ ] Accessible contrast ratios (4.5:1 text, 3:1 large/UI)

### Accessibility (MUST Pass) — Severity: CRITICAL

- [ ] Focus indicators visible on all interactive elements (2px, 3:1 contrast)
- [ ] Touch targets ≥ 44px (mobile) or 24px (desktop)
- [ ] `prefers-reduced-motion` respected (animations disabled/reduced)
- [ ] Modals trap focus and use `aria-modal` + `inert`
- [ ] Color is NOT the only indicator of state
- [ ] Screen reader labels on all interactive elements
- [ ] Keyboard navigation works for all actions

### Performance (MUST Pass) — Severity: CRITICAL

- [ ] INP < 200ms on interactive elements (see `react-best-practices` skill)
- [ ] Animations use only `transform` + `opacity` (compositor-only)
- [ ] Heavy filters/search use `useTransition` / `startTransition`
- [ ] Long lists virtualized (react-window, tanstack-virtual, or FlashList)
- [ ] LCP < 2.5s and CLS < 0.1

### Polish (SHOULD Pass) — Severity: WARNING

- [ ] Max 4 font sizes across entire app
- [ ] Single icon library, single weight
- [ ] Proper shadow discipline (subtle or none, tinted with background hue)
- [ ] No multi-hue gradients
- [ ] Dark mode follows elevation = lighter rule
- [ ] Dynamic numbers use tabular-nums / monospace
- [ ] Nested corner radius follows subtraction rule (outer - padding = inner)
- [ ] Body text max-width ~600px (50-75 chars/line)
- [ ] Text alignment consistent within each section
- [ ] Stat cards: value dominates, label is small/muted
- [ ] Lines replaced with spacing or alternating backgrounds

### Delight (Aspire To) — Severity: SUGGESTION

- [ ] Peak moment has celebration animation
- [ ] End moment has summary / progress feedback
- [ ] Loading states use skeletons or branded animation
- [ ] Empty states have illustration + CTA
- [ ] Spring physics for all interactive animations
- [ ] Haptic feedback on significant mobile actions
- [ ] Hover states on all interactive web elements
- [ ] Page/screen transitions between views
- [ ] Staggered entrance animations for lists
- [ ] Buttons use state machine (idle → loading → success/error)
- [ ] Images use blur-up placeholders (LQIP)
- [ ] Optimistic UI updates for routine mutations
- [ ] Prefetching on hover/focus for links and data
- [ ] Scroll snap on carousels/onboarding
- [ ] Form validation inline on blur with positive (green) feedback

### Mobile-Specific (If Applicable) — Severity: WARNING

- [ ] Bottom nav: 3-5 items, 44px tap targets, safe area respected
- [ ] Filled vs outline icons for active/inactive states
- [ ] Haptic feedback hierarchy (light/medium/heavy)
- [ ] Keyboard types match input context (email, phone, numeric)
- [ ] Primary actions in thumb-easy zone (bottom)
- [ ] FlatList items wrapped in React.memo + getItemLayout
- [ ] Interactive animations use Reanimated worklets (not Animated API)
- [ ] Images use expo-image with cachePolicy and blur placeholder

---

## 6. AI-Assisted Workflows

### 6.1 Animation Decomposition

When building complex animations, NEVER generate everything in a single step.
Break into incremental sub-steps:

```
DECOMPOSITION EXAMPLE:
──────────────────────────────────────────────────
Complex Goal: "Booking confirmation celebration"
──────────────────────────────────────────────────
Step 1: Static layout (all elements visible, no motion)
Step 2: Fade-in for background overlay
Step 3: Scale-in for checkmark icon (spring physics)
Step 4: Text entrance with stagger
Step 5: Confetti particle system
Step 6: Auto-dismiss with fade-out after 3s
──────────────────────────────────────────────────
Each step = one implementation pass. Test each before adding the next.
```

Why this works:
- **Debugging:** If step 3 breaks, you know exactly where
- **Iteration:** Refine timing/easing per step without rewriting everything
- **Quality:** Each sub-animation gets proper attention (spring config, duration)
- **Composability:** Steps become reusable animation hooks

Implementation pattern:

```tsx
// Step 1: Create individual animation hooks
function useCheckmarkAnimation() { /* spring scale 0→1 */ }
function useTextFadeIn() { /* opacity 0→1 with delay */ }
function useConfetti() { /* particle system */ }

// Step 2: Compose into a sequence
function useBookingConfirmation() {
  const checkmark = useCheckmarkAnimation()
  const text = useTextFadeIn()
  const confetti = useConfetti()

  const play = () => {
    checkmark.play()           // 0ms
    text.play(200)             // 200ms delay
    confetti.play(400)         // 400ms delay
  }

  return { checkmark, text, confetti, play }
}
```

Prompt template for requesting animation generation:

```
"Create [specific animation] for [component].
- Physics: spring with damping [X], stiffness [Y]
- Duration: [Z]ms
- Trigger: [event]
- Platform: [web/mobile/both]
- Do NOT add other animations yet — just this one step."
```

### 6.2 Illustration & Mascot System

For consistent illustration systems across empty states, onboarding, and error pages:

```
WORKFLOW:
──────────────────────────────────────────────────
1. Create ONE base illustration → this is the "style anchor"
2. Generate variations with AI (same character, different poses/contexts)
3. Clean up for consistency (line weight, colors, proportions)
4. Animate with Lottie (pre-defined loops) or Rive (interactive)
──────────────────────────────────────────────────
```

| Context | Illustration Mood | Usage |
|---------|------------------|-------|
| Empty list | Character looking around, curious | No data yet |
| Empty search | Character with magnifying glass | No results found |
| Success | Character celebrating, jumping | Task completed |
| Error | Character confused, scratching head | Something went wrong |
| Loading | Character working, building | Processing |
| Onboarding | Character waving, welcoming | First-time user |
| Offline | Character with disconnected cable | No connection |

Tool selection:
- **Lottie** — Pre-defined animations (empty states, loading, celebrations). Workflow: After Effects → Bodymovin → .json
- **Rive** — Interactive, state-driven (responds to user actions). Tiny files.

Free resources: **LottieFiles.com** (largest free library), **IconScout** (animated icons)

---

## 7. Quick Reference Tables

### Animation Durations

| Animation Type | Duration | Easing |
|---------------|----------|--------|
| Micro-interaction (hover, press) | 100-200ms | spring (stiff) |
| Element entrance | 200-300ms | spring (soft) |
| Page transition | 250-400ms | ease-in-out |
| Modal open/close | 250-350ms | ease-out / ease-in |
| Celebration/confetti | 1500-2500ms | custom sequence |
| Loading shimmer | infinite loop | linear |
| Skeleton pulse | 1500ms loop | ease-in-out |

### Spring Physics Presets

| Use Case | Stiffness | Damping | Mass |
|----------|-----------|---------|------|
| Buttons, toggles (snappy) | 400 | 25 | 1 |
| Press feedback (crisp) | 500 | 30 | 0.8 |
| Drag release (responsive) | 350 | 20 | 1 |
| Modal open (smooth) | 300 | 22 | 1 |
| Page transition (gentle) | 150 | 30 | 1 |
| Sidebar slide (medium) | 250 | 28 | 1 |
| Bouncy entrance (playful) | 200 | 12 | 1 |
| Scale pop (attention) | 300 | 10 | 0.8 |
| Float up (airy) | 120 | 14 | 0.6 |
| Card press - RN | 300 | 15 | — |
| Bottom sheet - RN | 500 | 50 | — |
| List item bounce - RN | 200 | 12 | — |

> **Rule:** If animation responds to user gesture → physics-based spring. If decorative → duration-based is fine.

### Stagger Timing

| Item Count | Delay Between Items | Strategy |
|-----------|-------------------|----------|
| 3-5 items | 80-100ms | Standard stagger |
| 6-12 items | 50-80ms | Faster stagger |
| 13+ items | 30-50ms | Animate first 8, rest instant |
| Grid layout | — | Stagger from center or top-left |
| Exit animation | — | 0.5x the enter stagger, reverse order |

### CSS Property Animation Cost

```
CHEAP (compositor only)      → transform, opacity
MEDIUM (repaint only)        → color, background, box-shadow
EXPENSIVE (layout + repaint) → width, height, top, left, padding, margin, font-size

RULE: Animate ONLY transform + opacity for 60fps guaranteed.
```

---

## 8. Continuous Improvement

### Reference Sources
- **Mobbin** (mobbin.com) — Analyze how top apps solve specific UX problems
- **Dribbble** — Visual layout and aesthetic inspiration
- **Apple HIG** — iOS design standards
- **Material Design 3** — Android/cross-platform patterns
- **Phosphor Icons** — Professional, consistent icon library
- **Lucide Icons** — Lighter alternative icon library
- **LottieFiles** — Free animation library

### Before Designing a New Screen
1. Search Mobbin for how top apps solve the same problem
2. Pick 2-3 references that match your brand tone
3. Identify the PATTERNS (not copy the design)
4. Apply patterns with your design system tokens

---

## Related Skills

- `premium-ui-design` — Visual design rules (color, typography, spacing, dark mode, web animations, scroll patterns)
- `premium-ux-patterns` — UX psychology (flows, states, validation, button state machine, perceived performance)
- `mobile-ux-design` — Mobile-specific (nav, haptics, gestures, RN performance)
- `accessibility` — WCAG compliance, ARIA, focus management
- `react-best-practices` — Performance optimization, INP, Core Web Vitals
- `tanstack-query` — Data fetching, optimistic updates, cache patterns
- `shadcn-components` — shadcn/ui component patterns
- `react-patterns` — React component patterns
