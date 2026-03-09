# Premium UX Patterns - Advanced Reference
## 8. Category Page Design

**Principle:** Achieve visual rhythm that enables rapid scanning.

### 8.1 What to Avoid

- Plain text lists with no visual distinction
- Inconsistent stock photos with poor contrast
- All items looking identical

### 8.2 What to Implement

- **Color-coded cards:** Soft solid backgrounds that visually group categories
- **Unified iconography/images:** Same artistic style across all category images
- **Visual rhythm:** Alternate card sizes or layouts for scanning ease
- **Progressive disclosure:** Show key info first, details on tap/click

```
CATEGORY CARDS:
┌──────────┐ ┌──────────┐ ┌──────────┐
│ 🟣 bg    │ │ 🔵 bg    │ │ 🟢 bg    │
│          │ │          │ │          │
│ [Icon]   │ │ [Icon]   │ │ [Icon]   │
│ Haircut  │ │ Color    │ │ Spa      │
│ 12 items │ │ 8 items  │ │ 5 items  │
└──────────┘ └──────────┘ └──────────┘
← Same style, different accent colors →
```

---

## 9. Smart Input Selection

**Principle:** Choose the input component based on CONTEXT OF USE, not just data type.

### 9.1 Decision Matrix

| Context | Best Input | Why |
|---------|-----------|-----|
| One-time setup (height, weight, age) | Slider / Scroll wheel | Precision not critical, feels playful |
| Repeated daily entry (calories, amounts) | Text field + stepper | Speed matters, keyboard is faster |
| Binary choice | Toggle switch | Clear on/off state |
| Selection from few options (3-6) | Segmented control / Radio | All options visible at once |
| Selection from many options (7+) | Dropdown / Search select | Reduces visual noise |
| Date selection | Calendar picker | Context-aware, shows availability |
| Time selection | Time wheel (mobile) / Time picker (web) | Natural mental model |

### 9.2 Rule of Thumb

> Sliders are for SETUP. Text fields are for REPEATED USE.

If a user does this action once → make it fun and visual (slider, wheel).
If a user does this action daily → make it fast and precise (keyboard, stepper).

---

## 10. Halo Effect (First Impressions in 50ms)

**Principle:** The brain forms an opinion about your product in 50 milliseconds. If the first impression is professional, users assume EVERYTHING is professional.

### 10.1 Mobile App First Impression

- Splash screen must be impeccable (no default white screen)
- First Home screen view must feel polished
- If the first image/headline feels professional, users trust the entire service

### 10.2 Dashboard Web First Impression

- Obsess over the "Hero" section (above the fold)
- Must be clean: clear value proposition + high-quality visuals
- Creates a "lens of trust" for everything below

### 10.3 Implementation Framework

1. **Engineer the first impression:** Decide what EXACT feeling you want in the first 50ms (Calm? Trust? Energy?)
2. **Extreme simplification:** Increase spacing, simplify navigation until clarity is priority #1
3. **Delight hunting:** Find every place where a subtle moment of delight can be added (hover states, animated loaders, transitions)

---

## 11. Conversion and Retention Patterns

### 11.1 Pricing Page (Dashboard/Web)

- Limit to 3-4 plans maximum
- Highlight monthly cost (what users search for) — reduce plan name size
- Show discount for annual clearly
- Show what the NEXT plan has that the CURRENT one doesn't

### 11.2 Data Visualization

- Use donut charts over lists for resource usage
- Add comparison toggles (compare items side by side)
- Use heat maps over bar charts for geographical data

### 11.3 Landing Page Credibility

- Use real product screenshots (styled/edited) — NOT generic icons
- Show actual UI cards, reports, or analytics as "product shots"
- Presentation IS credibility — a good graphic of your own interface elevates perceived value

---

## 12. Toast & Notification Patterns

**Principle:** Notifications must inform without interrupting. The wrong timing, placement, or frequency kills the user's flow.

### 12.1 Toast vs Snackbar

| Type | Has Action? | Duration | Use Case |
|------|------------|----------|----------|
| **Toast** | No | 3-5s auto-dismiss | Confirmations, status updates ("Saved!") |
| **Snackbar** | Yes (1 action) | 5-8s or until dismissed | Undo actions ("Deleted. Undo?") |
| **Banner** | Optional | Persistent until dismissed | System-wide alerts, maintenance notices |

### 12.2 Timing Rules

```
DURATION FORMULA:
──────────────────────────────────────
Short message (1-5 words)   → 3 seconds
Medium message (5-15 words) → 5 seconds
Long message (15+ words)    → 8 seconds or persistent
With action button          → minimum 5 seconds
──────────────────────────────────────
Alternative: ~100ms per character (20 chars = 2s base + 1s buffer)
```

### 12.3 Placement

| Platform | Default Position | Why |
|----------|-----------------|-----|
| **Web desktop** | Top-right corner | Peripheral vision, doesn't overlap content |
| **Web mobile** | Top center (below header) | Thumb-safe, doesn't cover bottom nav |
| **Mobile app** | Top of screen | Safe from bottom nav/gestures |

### 12.4 Stacking Rules

- **Mobile:** NEVER show more than 1 toast at a time — queue and replace
- **Desktop:** Stack maximum 3, newest on top, auto-dismiss oldest
- **Animation:** Slide + fade, 200-400ms entrance/exit

### 12.5 Semantic Colors

```
SUCCESS:  Green left border or icon  → "Changes saved"
ERROR:    Red left border or icon    → "Failed to save"
WARNING:  Amber left border or icon  → "Connection unstable"
INFO:     Blue left border or icon   → "New version available"
```

---

## 13. Form Validation UX

**Principle:** Validate inline, validate on blur, never validate prematurely. Good validation guides — bad validation punishes.

### 13.1 When to Validate

| Trigger | Pattern | When to Use |
|---------|---------|-------------|
| **On blur** (leaving field) | Best default | Most fields — email, name, phone |
| **On input** (while typing) | Only for length/format | Password strength, character limits |
| **On submit** | Required fields only | Empty required fields that weren't touched |

> **Key Rule:** NEVER show an error while the user is still typing (premature validation). Wait until they leave the field (blur event).

### 13.2 Error Message Anatomy

```
FIELD WITH ERROR:
┌──────────────────────────────┐
│ Email                        │ ← Label stays visible (NOT placeholder-only)
│ john@                        │ ← Field with red border (2px)
└──────────────────────────────┘
  ⚠ Enter a valid email address  ← Error: red, below field, specific guidance
```

**Error message rules:**
- Placed BELOW the input (never above, never in a tooltip)
- Red text + red border on the field
- Human-readable: "Enter a valid email" NOT "Error: Invalid format (RFC 5322)"
- Specific: "Password needs 8+ characters" NOT "Invalid password"
- Disappears immediately when the user corrects the input

### 13.3 Positive Validation (Green Feedback)

Show a green checkmark or green border when a field is valid. This creates momentum:

```
VALID FIELD:
┌──────────────────────────────┐
│ Email                        │
│ john@example.com          ✓  │ ← Green checkmark + green border
└──────────────────────────────┘
```

> Studies show inline validation with positive feedback increases form completion by ~22%.

### 13.4 Mobile-Specific Form UX

- Error messages below fields (vertical flow matches mobile reading)
- Use the correct keyboard type per field (email, phone, number)
- Persist labels (don't rely on placeholder text which disappears on focus)
- Group related fields and validate groups together

---

## 14. Onboarding & Progressive Disclosure

**Principle:** Don't show everything at once. Reveal features progressively as users demonstrate readiness.

### 14.1 Onboarding Checklist Pattern

Use a persistent checklist to guide new users through setup:

```
ONBOARDING CHECKLIST:
┌─────────────────────────────────┐
│ Get started with [App Name]     │
│ ━━━━━━━━━━━━━━━░░░░  60%       │
│                                 │
│ ✓ Create your account           │
│ ✓ Set up your profile           │
│ ✓ Add your first service        │
│ ○ Invite a team member          │
│ ○ Configure business hours      │
│                                 │
│ [Continue Setup]                │
└─────────────────────────────────┘
```

**Rules:**
- 5-7 steps maximum
- Show progress (percentage or X/Y)
- Allow dismissing/minimizing (but keep accessible)
- Celebrate completion of each step (micro-animation)
- Celebrate 100% completion with a Peak moment

### 14.2 Progressive Feature Disclosure

Reveal advanced features ONLY after the user has mastered basics:

| User Stage | Features Shown | Hidden Features |
|-----------|---------------|----------------|
| First session | Core workflow (create, view, edit) | Reports, integrations, bulk actions |
| After 3 sessions | Core + secondary (filters, search) | Advanced analytics, API settings |
| After 10 sessions | Full feature set | Nothing hidden |

### 14.3 Contextual Tooltips (Not Tours)

- **Avoid** long product tours (users skip them or forget)
- **Prefer** contextual tooltips that appear when the user reaches a feature naturally
- Show tooltip once, with "Got it" dismiss
- Store dismissed state per user

### 14.4 Gamification Elements

| Element | Implementation | Effect |
|---------|---------------|--------|
| Progress bars | Show % of profile/setup completion | Creates "completion urge" |
| Badges | Award on milestones (first booking, 10th client) | Positive reinforcement |
| Streaks | "5-day login streak!" | Encourages habit formation |
| Confetti | On checklist completion | Peak-End moment |

---

## 15. Optimistic UI (The "Instant" Illusion)

**Principle:** Users perceive speed not by actual latency, but by how quickly the UI acknowledges their action. Update the UI BEFORE the server responds.

### 15.1 When to Use Optimistic Updates

| Scenario | Optimistic? | Why |
|----------|------------|-----|
| Toggle a setting | YES | High success rate, easy to revert |
| Add item to list | YES | User expects instant feedback |
| Delete an item | YES + undo snackbar | Give 5s to undo before confirming |
| Edit a field | YES | Success rate >99% |
| Payment/booking | NO | Too risky — show real loading |
| File upload | NO | Can't fake progress |

### 15.2 The Optimistic Pattern

```
USER ACTION → IMMEDIATELY UPDATE UI → SEND TO SERVER
                                        │
                                   ┌────┴────┐
                                   │ Success  │ Error
                                   │ (silent) │ → Rollback + Toast
                                   └─────────┘
```

> **Key:** The user should never WAIT for the server on routine actions. Reserve loading spinners for high-stakes operations only.

### 15.3 Perceived Performance Hierarchy

From most effective to least:

```
PERCEIVED SPEED TECHNIQUES (ranked):
──────────────────────────────────────
1. Optimistic update    → 0ms perceived (instant)
2. Prefetch on intent   → Data ready before click
3. Skeleton screens     → Structure visible immediately
4. LQIP blur-up         → Image space reserved, feels fast
5. Progress indicator   → User sees progress
6. Branded loader       → Better than spinner, still waiting
7. Generic spinner      → WORST — feels slow always
──────────────────────────────────────
```

### 15.4 Prefetch Opportunities

| Trigger | What to Prefetch |
|---------|-----------------|
| Link hover (200ms) | Target page data |
| Search input focus | Popular/recent results |
| Tab hover | Tab content data |
| Scroll near bottom | Next page of paginated data |
| After login | Dashboard data (critical path) |
### 15.5 Optimistic Updates Implementation (TanStack Query)

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'

function useUpdateAppointment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data) => api.updateAppointment(data),

    // BEFORE server responds: update cache immediately
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['appointments'] })
      const previous = queryClient.getQueryData(['appointments'])

      queryClient.setQueryData(['appointments'], (old) =>
        old.map(apt => apt.id === newData.id ? { ...apt, ...newData } : apt)
      )

      return { previous }
    },

    // ON ERROR: rollback to snapshot
    onError: (err, newData, context) => {
      queryClient.setQueryData(['appointments'], context.previous)
      toast.error('Failed to update. Changes reverted.')
    },

    // ALWAYS: refetch to ensure server state is accurate
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
    }
  })
}
```

### 15.6 Prefetching on Hover/Focus

```tsx
function AppointmentCard({ appointment }) {
  const queryClient = useQueryClient()

  const prefetch = () => {
    queryClient.prefetchQuery({
      queryKey: ['appointment', appointment.id],
      queryFn: () => api.getAppointment(appointment.id),
      staleTime: 30_000,
    })
  }

  return (
    <Link
      href={`/appointments/${appointment.id}`}
      onMouseEnter={prefetch}
      onFocus={prefetch}
    >
      {appointment.title}
    </Link>
  )
}
```

### 15.7 Route Prefetching (Next.js)

```tsx
import Link from 'next/link'

// Next.js prefetches linked routes automatically on viewport enter
<Link href="/appointments" prefetch={true}>
  Appointments
</Link>

// Programmatic prefetching
import { useRouter } from 'next/navigation'
const router = useRouter()
router.prefetch('/appointments')
```

---

## 16. Error Recovery UX

**Principle:** Errors are inevitable. Premium apps don't just show errors — they help users RECOVER. Every error should include a recovery path.

### 16.1 Error Recovery Hierarchy

```
ERROR SEVERITY → RECOVERY STRATEGY:
──────────────────────────────────────
Validation error   → Inline fix guidance (field-level)
Failed mutation    → Retry button + rollback animation
Network timeout    → Auto-retry (3x) + manual retry
Offline            → Queue changes + sync indicator
Server error (500) → Apologize + retry + support link
Auth expired       → Silent refresh + retry original request
──────────────────────────────────────
```

### 16.2 Inline Retry Pattern

```
FAILED ACTION → RETRY FLOW:
┌──────────────────────────────────┐
│ ✗ Failed to save changes         │
│                                  │
│ [Retry]  [Discard Changes]       │
└──────────────────────────────────┘
```

**Rules:**
- Auto-retry silently up to 3 times (with exponential backoff: 1s, 2s, 4s)
- If all retries fail, show manual retry button
- ALWAYS offer a "discard" or "cancel" escape hatch
- Toast with retry: "Failed to save. [Retry]" (Snackbar with action)

### 16.3 Offline UX Pattern

```
OFFLINE DETECTION:
──────────────────────────────────────
1. Detect: navigator.onLine + fetch fail
2. Show: persistent banner "You're offline"
3. Queue: store mutations locally
4. Sync: when back online, replay queue
5. Confirm: "Changes synced!" toast
──────────────────────────────────────
```

**UI Rules when offline:**
- Show persistent banner (NOT a toast — it should stay)
- Dim or disable actions that require server
- Allow viewing cached/local data
- Queue actions that can be replayed later
- Show sync indicator when reconnecting

### 16.4 Error Boundary with Recovery

For React rendering errors, the Error Boundary should offer recovery, not just "something went wrong":

```
ERROR BOUNDARY UX:
┌──────────────────────────────────┐
│                                  │
│     [Illustration: confused]     │
│                                  │
│   Something unexpected happened  │
│                                  │
│   [Reload this section]          │  ← Primary: reload just this section
│   [Go to Dashboard]             │  ← Escape: safe navigation
│   [Report Issue]                │  ← Optional: feedback loop
│                                  │
└──────────────────────────────────┘
```

### 16.5 Optimistic Rollback Animation

When an optimistic update fails and must revert:
- Animate the revert (don't just snap back)
- Show brief red flash or shake on the reverted element
- Display toast explaining what happened
- The user should understand WHY the state changed back


---

## 17. Button State Machine

**Principle:** Buttons should communicate their state clearly at every moment. A button that just says "Submit" in every state is a missed opportunity.

### State Flow

```
BUTTON STATE MACHINE:
u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}
idle u{2192} hover u{2192} pressed u{2192} loading u{2192} success/error u{2192} idle
                           |
                        disabled (during loading)
u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}u{2500}
```

### Implementation

```tsx
type ButtonState = 'idle' | 'loading' | 'success' | 'error'

export function StatefulButton({ onClick, children }: {
  onClick: () => Promise<void>
  children: React.ReactNode
}) {
  const [state, setState] = useState<ButtonState>('idle')

  const handleClick = async () => {
    setState('loading')
    try {
      await onClick()
      setState('success')
      setTimeout(() => setState('idle'), 2000)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  return (
    <Button onClick={handleClick} disabled={state === 'loading'}>
      <AnimatePresence mode="wait">
        {state === 'idle' && <span key="text">{children}</span>}
        {state === 'loading' && <Loader2 key="loader" className="animate-spin" />}
        {state === 'success' && <Check key="check" className="text-green-500" />}
        {state === 'error' && <X key="error" className="text-red-500" />}
      </AnimatePresence>
    </Button>
  )
}
```

### Timing Rules

| State Transition | Duration | Visual |
|-----------------|----------|--------|
| idle u{2192} hover | 100-150ms | Subtle color shift or scale 1.02 |
| hover u{2192} pressed | 100ms | Scale 0.97 or darken |
| pressed u{2192} loading | immediate | Morph text to spinner |
| loading u{2192} success | 200ms | Morph spinner to checkmark |
| success u{2192} idle | 2000ms | Fade back to text |
| loading u{2192} error | 200ms | Morph spinner to X + shake |
| error u{2192} idle | 3000ms | Fade back to text |


---

