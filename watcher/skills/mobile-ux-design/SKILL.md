---
name: mobile-ux-design
description: |
  Mobile-specific UX/UI design patterns for React Native and mobile web.
  Covers bottom navigation anatomy, haptic feedback system, safe areas, tap targets (44px),
  gesture design, page transitions, badge notifications, splash screens,
  thumb-zone ergonomics, mobile-first responsive patterns, performance optimization
  (FlatList, Reanimated, 120Hz), and keyboard management.
  Use this skill when building or reviewing mobile app screens or mobile web interfaces.
allowed-tools: Read, Glob, Grep, Edit, Write
version: 1.0.0
---

# Mobile UX Design

Comprehensive mobile-specific design patterns that make the difference between a
"works on mobile" app and a premium, native-feeling experience. Applies to React Native
apps AND mobile web (responsive) interfaces.

---

## When to Use This Skill

- Building or reviewing mobile app screens (React Native)
- Designing responsive mobile web interfaces
- Implementing bottom navigation bars
- Adding haptic feedback to interactions
- Designing mobile forms or input flows
- Optimizing touch targets and gesture areas
- Creating mobile page transitions and animations
- Designing notification badges and indicators
- Building splash screens or onboarding flows

---

## 1. Bottom Navigation Bar (The Backbone of Mobile UX)

The bottom nav is THE most critical usability element in mobile apps.

### 1.1 Content Strategy

**Include ONLY 3-5 essential destinations (MAXIMUM 6):**

| Good Candidates | Bad Candidates (put elsewhere) |
|----------------|-------------------------------|
| Home / Dashboard | Help / FAQ |
| Feed / Main content | Logout |
| Search | Privacy / Terms |
| Notifications | Settings (goes in Profile) |
| Profile / Account | About |

> **Fewer tabs = less "choice paralysis"**. If you have 7+ destinations, you're doing it wrong.

### 1.2 Central Action Button (CTA)

Consider a prominent center button for the PRIMARY action:

```
┌────────────────────────────────────────┐
│  🏠     🔍     [+]     🔔     👤     │
│  Home  Search  CREATE  Alerts Profile │
└────────────────────────────────────────┘
                  ↑
          Prominent, elevated,
          easy thumb reach
```

This facilitates one-handed use and highlights the most important action.

### 1.3 Visual State Design

Use AT LEAST TWO visual changes to indicate the active tab:

```
INACTIVE:  ○ outline icon + muted color + regular weight label
ACTIVE:    ● filled icon  + brand color  + bold label
```

**Implementation:**

```tsx
// React Native example
<TabIcon
  name={isActive ? 'home-filled' : 'home-outline'}
  color={isActive ? colors.primary : colors.muted}
  size={24}
/>
<Text style={[
  styles.tabLabel,
  isActive && { fontWeight: '700', color: colors.primary }
]}>
  {label}
</Text>
```

### 1.4 Dimensions & Safe Areas

```
BOTTOM NAV ANATOMY:
┌──────────────────────────────────────┐
│                                      │  ← Content area
├──────────────────────────────────────┤
│  ← separator: shadow/border/color →  │  ← 1px border OR subtle shadow
│                                      │
│   [24px]    [24px]    [24px]    [24]│  ← Icon size: 24px
│   Label     Label     Label    Label│  ← Label: 10-12px
│                                      │
├──────────────────────────────────────┤
│   ← Safe Area (home indicator) →     │  ← NEVER overlap this
└──────────────────────────────────────┘
```

**Critical Rules:**
- Icons: 24px
- Labels: 10-12px
- Tap area: MINIMUM 44x44px (even if icon is 24px, the touchable area must be 44px)
- **ALWAYS respect Safe Area** — never overlap the home indicator (bottom line on modern phones)
- Separate from content using: subtle shadow, 1px border, OR slightly different background

```tsx
// React Native Safe Area
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const TabBar = () => {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom }]}>
      {/* tab items */}
    </View>
  )
}
```

### 1.5 Labels

- **Keep labels SHORT** — one word, one line maximum
- For older or less technical audiences: labels are MANDATORY (not optional)
- Short and clear: "Home", "Search", "Profile" (NOT "My Account Settings")

### 1.6 Badge Notifications

```
BADGE PLACEMENT:
     ●  ← small circle (no number) for minor updates
    [3] ← number badge for countable items (messages, alerts)
   [24px icon]
    Label
```

**Rules:**
- Use colored circles OR numbers in the top-right corner of icons
- DON'T overuse badges (badge fatigue → user ignores all of them)
- Reserve number badges for truly countable items (unread messages)
- Use simple colored dots for "something new" indicators

---

## 2. Haptic Feedback System (Mobile App Only)

Haptic feedback makes the app feel "addictive" and physical — like pressing real buttons.

### 2.1 Intensity Hierarchy

| Intensity | When to Use | Examples |
|-----------|-------------|---------|
| **Light** (selection) | Repetitive actions, frequent taps | Data entry, small toggles, list item selection |
| **Medium** (impact) | Significant state changes | Tab switch, toggle important setting, add to cart |
| **Heavy** (notification) | Critical confirmations | Payment confirmed, delete confirmed, error alert |
| **Success** | Positive completions | Form submitted, booking confirmed |
| **Warning** | Attention needed | Approaching limit, validation error |
| **Error** | Something went wrong | Failed action, network error |

### 2.2 Implementation

```tsx
import * as Haptics from 'expo-haptics'

// Light - for repetitive actions
const onItemPress = () => {
  Haptics.selectionAsync()
  // handle action
}

// Medium - for significant changes
const onTabSwitch = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  // switch tab
}

// Heavy - for critical confirmations
const onPaymentConfirm = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  // confirm payment
}

// Error
const onError = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
  // show error
}
```

### 2.3 Where to Add Haptics

| Component | Haptic Type |
|-----------|------------|
| Regular button press | Light (selection) |
| Bottom nav tab switch | Medium (impact) |
| Pull-to-refresh trigger | Medium (impact) |
| Toggle switch | Light (selection) |
| Slider snapping to value | Light (selection) |
| Form submission success | Success (notification) |
| Delete confirmation | Heavy + Warning |
| Payment completion | Heavy + Success |
| Error occurrence | Error (notification) |
| Long press activated | Medium (impact) |
| Drag-and-drop start/end | Light → Medium |

### 2.4 Rules

- NEVER add haptics to EVERY interaction (fatigue)
- Haptics should feel NATURAL, not annoying
- Test on real device (simulator doesn't reproduce haptics)
- Provide a setting to disable haptics for accessibility

---

## 3. Touch Targets & Ergonomics

### 3.1 Minimum Tap Area: 44x44px

**Every interactive element MUST have a minimum touch area of 44x44 pixels**, even if the visual element is smaller:

```tsx
// Visual icon is 24px, but touch target is 44px
<Pressable
  style={{ padding: 10 }} // 24 + 10 + 10 = 44px touch target
  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
  onPress={handlePress}
>
  <Icon size={24} />
</Pressable>
```

### 3.2 Thumb Zone Design

Organize content by reachability for one-handed use:

```
THUMB ZONE MAP (right hand):
┌──────────────────────┐
│                      │  ← HARD to reach
│   Status bar         │     (put read-only info here)
│   Headers            │
│                      │
├──────────────────────┤
│                      │  ← POSSIBLE to reach
│   Content area       │     (scrollable content)
│   Lists              │
│                      │
├──────────────────────┤
│                      │  ← EASY to reach
│   Primary actions    │     (CTAs, navigation, FAB)
│   Bottom nav         │
└──────────────────────┘
```

**Rule:** Primary actions go at the BOTTOM. Read-only info goes at the TOP.

### 3.3 Mobile Grid System (3-Column)

For mobile layouts, implement a **3-column grid** and align elements to it:

```
MOBILE 3-COLUMN GRID:
┌──────┬──────┬──────┐
│  1   │  2   │  3   │
│      │      │      │
│      │      │      │
│      │      │      │
│      │      │      │
└──────┴──────┴──────┘
```

- Use Auto Layout (Figma) or flexbox with consistent spacing
- Don't fear whitespace — let content "breathe"
- Group related elements deliberately
- Maintain consistent vertical spacing between groups

### 3.4 Spacing Between Touch Targets

- Minimum 8px between adjacent tap targets
- For destructive actions next to common actions: minimum 16px gap
- Group related actions, separate dangerous ones

---

## 4. Page Transitions & Animations

### 4.1 Transition Types

| Navigation Type | Animation | Duration |
|----------------|-----------|----------|
| Tab switch (same level) | Crossfade or none | 150-200ms |
| Push to detail | Slide from right | 250-350ms |
| Pop back | Slide to right | 250-350ms |
| Modal open | Slide from bottom | 300ms |
| Modal close | Slide to bottom | 250ms |
| Sheet open | Slide from bottom (partial) | 300ms |

### 4.2 Complex Animation Sequences

For key moments (form submit, voice command, booking confirmation), break the animation into sub-steps:

```
ANIMATION SEQUENCE EXAMPLE (Booking Confirmation):
──────────────────────────────────────
Step 1: Button morphs (text → loader)          0-200ms
Step 2: Loader spins                           200-800ms
Step 3: Loader morphs to checkmark             800-1100ms
Step 4: Background expands from button center  1100-1400ms
Step 5: Success text fades in with spring      1400-1800ms
Step 6: Confetti particles (optional)          1600-2200ms
──────────────────────────────────────
```

### 4.3 Spring Animations

Use spring physics (not linear/ease) for natural-feeling motion:

```tsx
// React Native Reanimated
import Animated, { withSpring } from 'react-native-reanimated'

const animatedStyle = useAnimatedStyle(() => ({
  transform: [{
    scale: withSpring(isPressed.value ? 0.95 : 1, {
      damping: 15,
      stiffness: 300,
    })
  }]
}))
```

### 4.3.1 AnimatedPressable Component

Reusable press feedback wrapper with spring physics:

```tsx
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

export function AnimatedPressable({ children, onPress, style }) {
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }))

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 })
  }

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 })
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  )
}
```

### 4.3.2 Success Animation Sequence

Multi-step celebration with haptic feedback:

```tsx
import Animated, {
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

export function useSuccessAnimation() {
  const checkScale = useSharedValue(0)
  const bgOpacity = useSharedValue(0)
  const textOpacity = useSharedValue(0)

  const play = () => {
    bgOpacity.value = withTiming(1, { duration: 200 })
    checkScale.value = withDelay(200,
      withSpring(1, { damping: 12, stiffness: 200 })
    )
    textOpacity.value = withDelay(500,
      withTiming(1, { duration: 300 })
    )
    runOnJS(Haptics.notificationAsync)(
      Haptics.NotificationFeedbackType.Success
    )
  }

  return { checkScale, bgOpacity, textOpacity, play }
}
```
### 4.4 Feedback Animations

- **Button press:** Scale down to 0.95-0.97 with spring
- **Success:** Checkmark draw animation + scale bounce
- **Error:** Shake animation (horizontal oscillation, 3-4 cycles)
- **Loading:** Subtle pulse or custom branded animation (NOT a generic spinner)
- **Pull-to-refresh:** Custom animation at top (e.g., mascot pulling a rope)

### 4.5 Respect `prefers-reduced-motion`

Users with vestibular disorders enable this setting. You MUST respect it:

```tsx
// React Native: Check AccessibilityInfo
import { AccessibilityInfo } from 'react-native'

const [reduceMotion, setReduceMotion] = useState(false)
useEffect(() => {
  AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion)
  const sub = AccessibilityInfo.addEventListener(
    'reduceMotionChanged', setReduceMotion
  )
  return () => sub.remove()
}, [])

// Use in animations
const duration = reduceMotion ? 0 : 300
```

When reduced motion is enabled:
- Replace slide/scale animations with simple fade or instant transitions
- Keep skeleton shimmer (it's subtle enough)
- Disable confetti/particle effects
- Keep haptic feedback (it's non-visual)

---


## Reference Documentation

For detailed patterns and code examples, read:

- **docs/advanced-mobile-patterns.md** - Mobile form design, navigation patterns, splash screen, loading/empty states, responsive adaptation, illustration/visual identity, performance/frame rate optimization

---
## Anti-Patterns

| Anti-Pattern | Why It's Bad | Fix |
|-------------|-------------|-----|
| More than 5 bottom nav items | Choice paralysis | Max 5, use "More" sheet for extras |
| No safe area respect | Content hidden behind home indicator | Always use SafeAreaView |
| Tap targets < 44px | Frustrating mis-taps | Minimum 44x44px hitbox |
| Haptics on every single tap | Annoying, numbing | Use sparingly on significant actions |
| Generic spinner for loading | Feels slow and cheap | Skeleton screens or branded animation |
| Full-page modal for simple action | Heavy, jarring | Bottom sheet instead |
| Horizontal scroll for content | Easy to miss items | Vertical scroll with clear layout |
| Text-only empty states | Feels broken | Illustration + CTA |
| Same icon weight active/inactive | Hard to distinguish | Outline → filled on activation |
| Linear animations (not spring) | Feels robotic | Spring physics for natural motion |
| Ignoring reduce-motion preference | Vestibular disorder users get sick | Check AccessibilityInfo, disable animations |
| No gesture alternative for swipe actions | Motor impairment users can't use | Always provide button/menu fallback |
| KeyboardAvoidingView without platform config | Works on iOS, breaks on Android | Use KeyboardAwareScrollView instead |
| No auto-advance between form fields | User must manually tap each field | returnKeyType="next" + onSubmitEditing chain |
| Keyboard covers submit button | User can't submit without dismissing | extraScrollHeight or sticky submit |
| Default `<Image>` without caching | Re-downloads on every mount, slow | expo-image with cachePolicy="memory-disk" |
| JS thread animations for interactions | Competes with React, drops frames | Reanimated worklets on UI thread |
| Unoptimized FlatList (no memo, no getItemLayout) | Janky scrolling on 50+ items | React.memo + getItemLayout + windowSize |
| setTimeout-based animation timing | Frame tearing at 120Hz | Reanimated (adapts to refresh rate) |
| Inline arrow functions in renderItem | New function every render, breaks memo | useCallback + memoized component |

---

## Checklist

Before shipping ANY mobile screen:

- [ ] Bottom nav has 3-5 items maximum?
- [ ] Active tab shows filled icon + brand color + bold label?
- [ ] Safe area is respected (no overlap with home indicator)?
- [ ] All tap targets are minimum 44x44px?
- [ ] Haptic feedback added to significant interactions?
- [ ] Haptic intensity matches action importance?
- [ ] Page transitions use spring physics (not linear)?
- [ ] Loading states use skeletons (not generic spinners)?
- [ ] Empty states have illustration + headline + CTA?
- [ ] Forms use correct keyboard type for each field?
- [ ] Multi-step forms have progress indicator?
- [ ] Primary actions are in the thumb-easy zone (bottom)?
- [ ] Badges are used sparingly (not on every tab)?
- [ ] Navigation uses neutral colors (brand color for content only)?
- [ ] Splash screen transitions smoothly to main screen?
- [ ] Pull-to-refresh has custom animation + haptic feedback?
- [ ] `prefers-reduced-motion` / AccessibilityInfo.isReduceMotionEnabled respected?
- [ ] Swipe gestures have alternative button/menu fallbacks?
- [ ] Forms use KeyboardAwareScrollView (not bare KeyboardAvoidingView)?
- [ ] returnKeyType="next" chains through all fields, "done" on last?
- [ ] Submit button stays visible above keyboard?
- [ ] FlatList items wrapped in React.memo?
- [ ] FlatList has getItemLayout for fixed-height items?
- [ ] Interactive animations use Reanimated worklets (not Animated API)?
- [ ] Images use expo-image with cachePolicy and blur placeholder?
- [ ] No JS thread animations for gestures or interactive elements?
- [ ] Lists with 100+ items use FlashList instead of FlatList?

---

## Related Skills

- `frontend-design` - Orchestrator (execution modes, task routing, review workflow)
- `premium-ui-design` - Visual design rules (color, typography, spacing, web animations)
- `premium-ux-patterns` - UX psychology (flows, states, validation, button behavior)
- `accessibility` - WCAG compliance (touch targets, contrast)
- `shadcn-components` - Web component patterns
