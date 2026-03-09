---
name: premium-ux-patterns
description: |
  Premium UX psychology and behavioral design patterns for web and mobile.
  Covers Peak-End Rule, cognitive load reduction, personalization, user journey mapping,
  smart search, post-action UX, empty states, feedback loops, conversion optimization,
  and button state machine patterns.
  Use this skill when designing user flows, improving retention, or making interfaces feel "intelligent".
allowed-tools: Read, Glob, Grep, Edit, Write
version: 1.0.0
---

# Premium UX Patterns

Psychology-driven UX patterns that separate amateur products from premium, "top 1%" applications.
These patterns apply to BOTH web dashboards and mobile apps.

---

## When to Use This Skill

- Designing new user flows or screens
- Improving retention and engagement metrics
- Making an interface feel "smart" and anticipatory
- Reducing user frustration and cognitive load
- Designing empty states, loading states, or error states
- Optimizing post-action experiences (after purchase, after form submit)
- Creating personalized experiences based on user behavior
- Building search interfaces
- Designing category/listing pages

---

## 1. Peak-End Rule (The Golden Rule of Memorable Apps)

**Principle:** Users don't remember the entire experience. They judge quality based on TWO moments: the most intense point (the Peak) and the Final moment.

### 1.1 Map the User Journey First

Before designing ANY screen:

1. List every step from registration to task completion
2. Identify where users pause, feel stress, or encounter silence
3. Locate the natural "peak" moment (task completion, milestone reached)
4. Design the "end" moment (session close, task finish)

```
JOURNEY MAP TEMPLATE:
────────────────────────────────────────────────
Register → Onboard → [PEAK: First Success] → Use → [END: Session Close]
   │          │              │                  │           │
   ▼          ▼              ▼                  ▼           ▼
 Simple    Guided      Celebrate!          Smooth      Summarize
 forms     steps       Animation          flows       progress
                       + Confetti
────────────────────────────────────────────────
```

### 1.2 Design the Peak Moment

Choose ONE point in the journey to elevate above expectations:

- **When:** User completes a central task, reaches a milestone, or invests significant effort
- **How to implement:**
  - Micro-animations (confetti, sparkles, check-mark morphing)
  - Personalized celebration copy: "You showed up today, that's huge!"
  - Dynamic progress summaries that feel "built just for me"
  - Badges, achievements, or visual rewards
  - 3D transitions or fluid animations on payment/booking completion

```tsx
// Example: Peak moment after booking confirmation
<motion.div
  initial={{ scale: 0.8, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  transition={{ type: "spring", damping: 15, stiffness: 300 }}
>
  <ConfettiExplosion />
  <h2>{t('booking.confirmed.title')}</h2>
  <p>{t('booking.confirmed.message', { name: user.firstName })}</p>
</motion.div>
```

### 1.3 Design the End Moment

Never let the app just "close" — design a conclusion that reaffirms value:

- **Dashboard web:** Show a progress card or summary: "3 appointments completed today"
- **Mobile app:**
  - Subtle animation on the last action before exit
  - Soft nudge to return: "See you tomorrow!"
  - Reward opportunity (rate, tip, share)

### 1.4 Mitigate Negative Moments

Negative moments are as memorable as positive ones. You MUST address:

- **Loading screens:** Convert to branded animations (never a blank spinner)
- **Error states:** Use optimistic micro-copy that guides before the user asks for help
- **Long forms:** Break into steps with progress indicators
- **Empty results:** Offer alternatives instead of dead-ends

```
NEGATIVE MOMENT MITIGATION:
──────────────────────────────────────
Wait time      → Branded loading animation
Error          → Helpful copy + suggested action
Empty results  → "Try these instead..." suggestions
Long form      → Multi-step wizard with progress bar
──────────────────────────────────────
```

### 1.5 Iterate on Peaks

- Test variations: different timing, icons vs emojis, animated vs static feedback
- Monitor where users abandon (that's your pain point)
- Monitor where users linger longer than necessary (that's your delight point)

---

## 2. User Flow Integrity (No Gaps, No Dead-Ends)

**Principle:** Gaps in user flow silently ruin the experience. Every screen must have a clear "next step" and an "escape hatch."

### 2.1 Flow Wireframing

Before designing any detail, draw SIMPLE BOXES to map the flow:

```
WIREFRAME FLOW CHECK:
┌─────┐    ┌─────────┐    ┌─────────┐    ┌──────┐
│Start├───→│Selection ├───→│ Config  ├───→│ Done │
│     │    │ Screen   │    │ Screen  │    │      │
└─────┘    └─────────┘    └─────────┘    └──────┘
              │                │
              ▼                ▼
           [Search]         [Skip]
           [Back]           [Back]
```

Look for:
- Missing "Back" navigation on any screen
- Selection screens WITHOUT a search bar
- Screens WITHOUT a "Skip" button when the step is optional
- Dead-end states with no clear next action

### 2.2 Mandatory Screen Elements

Every selection or configuration screen MUST have:

| Element | Why |
|---------|-----|
| **Search bar** | User may have 50+ options; scrolling is painful |
| **Skip button** | The step may not apply to every user |
| **Back navigation** | User must be able to retreat without losing data |
| **Clear CTA** | User must know what "next" looks like |
| **Progress indicator** | User must know where they are in the flow |

### 2.3 Remove Redundant Navigation

- **Remove navigation arrows** if the user can already swipe (mobile gesture replaces button)
- **Remove borders/strokes** on cards if color contrast is already sufficient
- **Remove "View more" links** if content can simply be scrolled
- Any element that duplicates an existing interaction = visual clutter to remove

---

## 3. Cognitive Load Reduction (Premium = Effortless)

**Principle:** The brain is "lazy" by design. It prefers what's easy to process. Premium = removing friction, not adding features.

### 3.1 Declare War on Cognitive Load

Review EVERY page and ask: "What can I remove?"

**Checklist for every screen:**
- [ ] Can any text be shorter without losing meaning?
- [ ] Are there redundant labels? (If a section says "Rewards", the button just says "Claim")
- [ ] Is there a single clear primary action?
- [ ] Can advanced options be hidden by default?
- [ ] Is the hierarchy guiding the eye to the right place?

### 3.2 White Space = Trust Signal

- White space is NOT "empty space" — it's a signal of confidence and exclusivity
- Use generous spacing between sections
- Let content "breathe"
- Each section should have ONE primary objective

```
BAD:  [Title][Subtitle][Button][Image][Stats][CTA][Footer] ← everything screams
GOOD: [Title + Subtitle]
                                    [Hero Image]

      [Single CTA Button]
                                    [Supporting Stats]
```

### 3.3 Predictable Navigation

- Keep menus simple and logical
- If navigation is easy to use, the brain interprets it as MORE trustworthy
- Consistent patterns across all screens
- Never hide primary actions in hamburger menus on desktop

### 3.4 Copywriting Rules

- **Eliminate redundancy:** If a section header already defines the group, don't repeat that word in each item
- **Use context to omit words:** Inside a "Rewards" section, the button says "Claim", not "Claim Rewards"
- **Shorter = Better:** Every word must earn its place
- **One idea per sentence**

```
BAD:  "Click here to claim your available reward points"
GOOD: "Claim Points"

BAD:  "Your appointment has been successfully booked and confirmed"
GOOD: "Appointment confirmed!"
```

---

## 4. Personalization by User Behavior

**Principle:** The design should mutate based on WHO is looking, not show a generic screen for everyone.

### 4.1 Three User Tiers

| Tier | Behavior | What to Show |
|------|----------|-------------|
| **New Users** | First 1-3 sessions | Simplified UI, welcome message, focus on "First Step" (configure a goal, make first booking) |
| **Returning Users** | Regular usage | Active plans, pending tasks, recent activity directly on home |
| **Power Users** | Heavy/daily usage | Advanced stats, personalized recommendations based on history, shortcuts |

### 4.2 Implementation Strategy

```tsx
// Determine user tier based on session count or activity
const userTier = useMemo(() => {
  if (user.sessionsCount <= 3) return 'new'
  if (user.actionsThisWeek > 20) return 'power'
  return 'returning'
}, [user])

// Render adaptive UI
switch (userTier) {
  case 'new': return <OnboardingHome />
  case 'power': return <PowerUserDashboard />
  default: return <StandardHome />
}
```

### 4.3 Dashboard Web Adaptation

- Use a "views" system where complex data (charts, reports) unlock or highlight for frequent admins
- Occasional users see clear summaries
- First-time visitors see guided tooltips

---

## 5. Smart Search Design

**Principle:** Search should NEVER be a blank page. It's a moment of support, not abandonment.

### 5.1 Before the User Types

When the search bar is tapped/focused, IMMEDIATELY show:

1. **Recent searches** (last 3-5)
2. **Popular/trending terms**
3. **Personalized suggestions** based on user's interests or history

### 5.2 While the User Types

- Live results appearing as they type (debounced 300ms)
- Category-organized results (People, Services, Appointments)
- Highlight matching text in results

### 5.3 Zero Results State

NEVER show just "No results found." Instead:

- Suggest similar terms: "Did you mean...?"
- Show related items: "You might be interested in..."
- Offer action: "Create new [item]?"

```
SEARCH UX FLOW:
──────────────────────────────────────
Focus bar    → Show recents + popular
Type 1 char  → Show autocomplete
Type 3 chars → Show live results
0 results    → Show alternatives + "Create new?"
──────────────────────────────────────
```

---

## 6. Post-Action Experience (After the Conversion)

**Principle:** Don't neglect the experience AFTER the user completes their primary task. This IS the "End" in Peak-End.

### 6.1 Visual Timeline

Replace text lists with visual timelines for status tracking:

```
●━━━━━━━●━━━━━━━○━━━━━━━○
Booked   Confirmed  In Progress  Completed
✓        ✓          ←current
```

### 6.2 Humanization

For service apps (delivery, appointments):
- Include photos and names of assigned professionals
- Quick contact buttons (call, message)
- Proactive info: answer common questions with visual icons BEFORE the user searches

### 6.3 Proactive Information

- Show estimated times with visual progress
- Answer FAQs inline (not buried in a help page)
- Provide next-step guidance automatically

---

## 7. Empty States Design

**Principle:** Empty screens are opportunities, not dead-ends. They should guide, delight, and motivate.

### 7.1 Components of a Great Empty State

1. **Illustration/Visual** (character, mascot, or contextual image)
2. **Clear headline** explaining the state
3. **Supportive body text** with guidance
4. **Primary CTA** to resolve the empty state

```
EMPTY STATE ANATOMY:
┌─────────────────────────┐
│                         │
│     [Illustration]      │
│                         │
│   No appointments yet   │  ← headline
│                         │
│  Book your first        │  ← supportive text
│  appointment to get     │
│  started                │
│                         │
│  [Book Now]             │  ← primary CTA
│                         │
└─────────────────────────┘
```

### 7.2 Illustration Variations

Create a base illustration/mascot and generate variations for different contexts:
- Searching (with magnifying glass)
- Sleeping (no activity)
- Celebrating (after achievement)
- Working (in progress)
- Confused (error state)

### 7.3 Empty State Component (Web)

```tsx
import Lottie from 'lottie-react'
import emptyAnimation from '@/assets/animations/empty-search.json'

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  animation
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {animation && (
        <Lottie
          animationData={animation}
          loop
          className="w-48 h-48 mb-6"
        />
      )}
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
        {description}
      </p>
      {actionLabel && (
        <Button onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
```
### 7.3 Animate Empty States

Use Lottie animations or CSS animations to bring empty states to life:
- Subtle breathing/floating motion
- Character looking around
- Elements appearing with staggered delays

---


## Reference Documentation

For detailed patterns and code examples, read:

- **docs/advanced-patterns.md** - Category pages, smart input selection, halo effect, conversion/retention, toast/notifications, form validation UX, onboarding/progressive disclosure, optimistic UI, error recovery, button state machine

---
## Anti-Patterns

| Anti-Pattern | Why It's Bad | Fix |
|-------------|-------------|-----|
| Generic empty states ("No data") | Feels broken, user doesn't know what to do | Illustration + guidance + CTA |
| Blank search page | Abandonment point | Show recents + suggestions |
| Same screen for all users | Irrelevant content frustrates | Personalize by tier |
| No celebration after key action | Missed emotional peak | Add micro-animation + copy |
| Abrupt session end | Bad "End" memory | Add summary + nudge |
| "No results" dead-end | User gives up | Suggest alternatives |
| Loading with blank spinner | Feels slow and broken | Branded animation |
| All text, no visual rhythm | Fatiguing to scan | Color-coded cards + icons |
| Toast shown during typing | Interrupts flow, causes errors | Queue toasts, show after pause |
| Error on every keystroke | Punishes before user finishes | Validate on blur, not on input |
| Placeholder-only labels | Label disappears on focus, user forgets | Persistent visible labels |
| Long product tour on first visit | Users skip/forget everything | Contextual tooltips instead |
| No positive form feedback | User unsure if field is correct | Green checkmark on valid fields |
| Loading spinner on simple mutations | Feels slow, breaks flow | Optimistic update + silent sync |
| Error with no recovery path | User stuck, abandons | Retry button + alternative action |
| "Something went wrong" with no guidance | Useless, user doesn't know what to do | Specific error + recovery action |
| Snapping back on optimistic rollback | Jarring, confusing | Animate revert + explain via toast |

---

## Checklist

Before shipping ANY screen, verify:

- [ ] Have I identified the Peak moment in this flow?
- [ ] Does the End of the task feel conclusive and rewarding?
- [ ] Have I minimized friction in error/loading states?
- [ ] Is there a micro-animation or visual detail that delights at the key moment?
- [ ] Can any text be shorter?
- [ ] Is there a single clear primary action per screen?
- [ ] Are empty states designed with illustration + CTA?
- [ ] Does search show suggestions before the user types?
- [ ] Is the first impression (above the fold) impeccable?
- [ ] Have I tested with different user tiers (new/returning/power)?
- [ ] Toasts: correct placement, proper timing (3-8s), max 1 on mobile?
- [ ] Form validation: inline on blur, not premature, errors below field?
- [ ] Form labels: persistent (not placeholder-only)?
- [ ] Positive validation feedback (green checkmark) on valid fields?
- [ ] Onboarding: checklist or progressive disclosure for new users?
- [ ] Contextual tooltips instead of long product tours?
- [ ] Routine mutations use optimistic updates (instant feel)?
- [ ] Errors include recovery path (retry button, alternative action)?
- [ ] Offline state shows persistent banner + queues changes?
- [ ] Error boundary has "reload section" + "go to dashboard" options?
- [ ] Delete actions use optimistic + undo snackbar (5s window)?

---

## Related Skills

- `frontend-design` - Orchestrator (execution modes, task routing, review workflow)
- `premium-ui-design` - Visual design rules (color, typography, spacing, web animations)
- `mobile-ux-design` - Mobile-specific patterns (haptics, bottom nav, RN performance)
- `accessibility` - WCAG compliance, ARIA, focus management
- `shadcn-components` - Component patterns
- `tanstack-query` - Optimistic updates, cache patterns
