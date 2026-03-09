# Mobile UX Design - Advanced Reference
## 5. Mobile Form Design

### 5.1 Input Rules

| Context | Best Input | Reasoning |
|---------|-----------|-----------|
| One-time setup (age, height) | Slider / Scroll wheel | Fun, precision not critical |
| Daily entry (amounts, calories) | Text + keyboard | Speed critical for repeated use |
| Date selection | Calendar with swipe | Shows context (availability) |
| Time selection | Scroll wheel | Natural mobile mental model |
| Yes/No | Toggle switch | Clear binary state |
| Select from 3-6 options | Segmented control | All visible, easy comparison |
| Select from 7+ options | Bottom sheet list | Scrollable, searchable |

### 5.2 Keyboard Optimization

Always set the correct keyboard type:

```tsx
<TextInput keyboardType="email-address" />    // Email
<TextInput keyboardType="phone-pad" />         // Phone
<TextInput keyboardType="numeric" />           // Numbers
<TextInput keyboardType="decimal-pad" />       // Money/decimals
<TextInput returnKeyType="next" />             // Shows "Next" button
<TextInput returnKeyType="done" />             // Shows "Done" button
<TextInput autoComplete="name" />              // Autofill support
```

### 5.3 Keyboard Management

The keyboard covers ~50% of the screen. Handling it poorly makes forms unusable.

```tsx
// USE KeyboardAwareScrollView (better than KeyboardAvoidingView)
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'

<KeyboardAwareScrollView
  enableOnAndroid={true}
  extraScrollHeight={20}     // Extra space above focused input
  keyboardShouldPersistTaps="handled" // Allow tapping buttons while keyboard open
>
  <TextInput ... />
  <TextInput ... />
  <Button ... />  {/* Button stays accessible above keyboard */}
</KeyboardAwareScrollView>
```

**Auto-Advance Between Fields:**

```tsx
// Create refs for each field
const emailRef = useRef<TextInput>(null)
const passwordRef = useRef<TextInput>(null)

<TextInput
  returnKeyType="next"           // Shows "Next" on keyboard
  onSubmitEditing={() => emailRef.current?.focus()} // Jump to next field
/>
<TextInput
  ref={emailRef}
  returnKeyType="next"
  onSubmitEditing={() => passwordRef.current?.focus()}
/>
<TextInput
  ref={passwordRef}
  returnKeyType="done"           // Shows "Done" on last field
  onSubmitEditing={handleSubmit} // Submit form
/>
```

**Keyboard Rules:**
- Use `KeyboardAwareScrollView` (not `KeyboardAvoidingView` which requires platform config)
- `keyboardShouldPersistTaps="handled"` — allows tapping buttons/links while keyboard is open
- `returnKeyType="next"` for all fields except last (use `"done"`)
- `onSubmitEditing` chains focus to next field
- Dismiss keyboard on scroll: `keyboardDismissMode="on-drag"`
- For bottom-positioned submit buttons, add `extraScrollHeight` to keep them visible

### 5.4 Multi-Step Forms

- Use a progress indicator (steps or progress bar)
- Allow backward navigation
- Persist data between steps (don't lose on back press)
- Skip button for optional steps
- Search bar on selection screens

---

## 6. Mobile Navigation Patterns

### 6.1 Navigation Color Strategy

- **Bottom nav:** Neutral colors (white, gray, dark) — NOT brand-colored
- **Reserve brand colors** for actions WITHIN the content area
- **Contrast:** Minimum 3:1 ratio for inactive elements to remain legible

```
NAVIGATION COLOR PALETTE:
──────────────────────────────────────
Background:      White / Near-white (light) or Dark gray (dark)
Inactive icons:  40-50% gray
Active icon:     Brand color (primary)
Active label:    Brand color + bold weight
Separator:       5% opacity border or subtle shadow
──────────────────────────────────────
```

### 6.2 Gestures

| Gesture | Standard Action |
|---------|----------------|
| Swipe left | Delete / secondary action |
| Swipe right | Primary action (mark done, archive) |
| Long press | Context menu / multi-select |
| Pull down | Refresh content |
| Pinch | Zoom (images/maps) |
| Swipe between tabs | Tab navigation |

### 6.3 Sheet Pattern (Bottom Sheets)

Use bottom sheets instead of full-page navigations for:
- Quick actions (share, more options)
- Filters
- Brief forms (< 5 fields)
- Confirmations

```
SHEET ANATOMY:
┌──────────────────────────────┐
│                              │  ← Content (dimmed)
│                              │
├──────────────────────────────┤
│          ═══                 │  ← Handle (drag indicator)
│                              │
│   Sheet content              │  ← Actions, forms, etc.
│                              │
│   [Primary Action Button]    │
│                              │
├──────────────────────────────┤
│   ← Safe Area →              │
└──────────────────────────────┘
```

---

## 7. Splash Screen & First Launch

### 7.1 Splash Screen

- Show brand logo or icon centered
- Match background to the app's primary color or white
- Duration: 1-2 seconds max (or until app is ready)
- Transition to main screen with a fade (not an abrupt jump)

### 7.2 Onboarding

- Maximum 3-4 screens
- Each screen: ONE idea, ONE illustration, ONE sentence
- Allow skipping at any point
- Show progress dots
- Final screen: clear CTA ("Get Started")

```
ONBOARDING SCREEN:
┌──────────────────────┐
│                      │
│   [Illustration]     │
│                      │
│   Title (1 line)     │
│   Subtitle (2 lines) │
│                      │
│                      │
│   ● ○ ○              │  ← Progress dots
│                      │
│   [Get Started]      │  ← or [Next] / [Skip]
│                      │
└──────────────────────┘
```

---

## 8. Loading & Empty States (Mobile-Specific)

### 8.1 Skeleton Screens

Instead of spinners, use skeleton placeholders that mirror the actual content layout:

```
SKELETON EXAMPLE:
┌──────────────────────────┐
│ ▓▓▓▓▓  ░░░░░░░░░░░░░░░ │
│        ░░░░░░░░░░░      │
│ ▓▓▓▓▓  ░░░░░░░░░░░░░░░ │
│        ░░░░░░░░░░░      │
│ ▓▓▓▓▓  ░░░░░░░░░░░░░░░ │
│        ░░░░░░░░░░░      │
└──────────────────────────┘
  avatars   text lines (shimmer animation)
```

### 8.2 Pull-to-Refresh

- Custom animation (not just the default spinner)
- Show haptic feedback when threshold is reached
- Brief success indicator before content updates

### 8.3 Empty States

- Include illustration (mascot, contextual image)
- Clear headline + supportive text
- Primary CTA to resolve the empty state
- Consider animation (Lottie) for extra delight

### 8.4 Empty State Component (React Native)

```tsx
import LottieView from 'lottie-react-native'

export function EmptyState({ title, subtitle, animation, onAction }) {
  return (
    <View style={styles.container}>
      <LottieView
        source={animation}
        autoPlay
        loop
        style={{ width: 200, height: 200 }}
      />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {onAction && (
        <AnimatedButton onPress={onAction.handler}>
          {onAction.label}
        </AnimatedButton>
      )}
    </View>
  )
}
```

---

## 9. Responsive Web → Mobile Adaptation

### 9.1 Dashboard Adaptation

When adapting a web dashboard for mobile web:

| Web Element | Mobile Adaptation |
|-------------|-------------------|
| Sidebar navigation | Bottom nav bar |
| Data tables | Card lists with key data |
| Complex charts | Simplified charts or summary cards |
| Multi-column layouts | Single column stacked |
| Hover tooltips | Tap-to-expand or inline display |
| Dropdown menus | Bottom sheets |
| Modal dialogs | Full-screen sheets |
| Horizontal tabs | Swipeable tabs |

### 9.2 Priority for Belleza Project

Based on target users:
- **Professionals/Admin** → Web Desktop + Native Mobile App
- **Clients** → **Web Mobile** (primary mobile web audience)

Prioritize mobile-responsive design for:
1. Booking flow (client-facing)
2. Appointment status page (client-facing)
3. Client profile/history (client-facing)
4. Dashboard is "nice to have" responsive (admins use native app)

---

## 10. Illustration & Visual Identity

### 10.1 Mascots and Brand Characters

Create a base illustration/mascot and generate contextual variations:

| Context | Mascot State |
|---------|-------------|
| Empty list | Sleeping or idle |
| Searching | Holding magnifying glass |
| Error | Confused or shrugging |
| Success | Celebrating |
| Loading | Working or running |
| No internet | Disconnected cable visual |

### 10.2 Animation of Illustrations

- Use **Lottie** (After Effects → JSON) for complex character animations
- Use **Rive** for interactive, state-driven illustrations
- Use CSS/Reanimated for simple motion (floating, breathing)

### 10.3 Consistency

- All illustrations must use the SAME artistic style
- Consistent color palette matching the theme
- Same line weight and proportions across all variations

---

## 11. Performance & Frame Rate (The Invisible UX)

A beautiful app that stutters, drops frames, or feels laggy is worse than an ugly one that's fast. Users perceive jank as **broken**, not slow. 60fps (16.6ms/frame) is the minimum; 120fps (8.3ms/frame) is the new premium bar on modern devices.

### 11.1 The Performance Mental Model

```
FRAME BUDGET:
──────────────────────────────────────────────
60fps  → 16.6ms per frame (standard)
120fps →  8.3ms per frame (Pro Motion / high refresh)
──────────────────────────────────────────────

WHAT EATS YOUR FRAME BUDGET:
┌─────────────────────────────────────────┐
│  JS Thread        │  UI Thread          │
│  (React logic)    │  (native rendering) │
│                   │                     │
│  State updates    │  Layout calc        │
│  Re-renders       │  Drawing views      │
│  API calls        │  Animations*        │
│  Business logic   │  Gestures*          │
└─────────────────────────────────────────┘
        * Reanimated runs these on UI thread
          (bypassing JS thread entirely)
```

### 11.2 FlatList Optimization (The #1 Performance Fix)

FlatList is the biggest source of jank in React Native. Every optimization matters:

```tsx
// ❌ BAD: Unoptimized FlatList
<FlatList
  data={items}
  renderItem={({ item }) => <ItemCard item={item} />}
/>

// ✅ GOOD: Fully optimized FlatList
const MemoizedItem = React.memo(ItemCard)

<FlatList
  data={items}
  renderItem={({ item }) => <MemoizedItem item={item} />}
  keyExtractor={(item) => item.id}
  // Windowing (only render visible + buffer)
  windowSize={10}              // Render 10 screens worth (5 above + 5 below)
  maxToRenderPerBatch={10}     // Render 10 items per batch
  initialNumToRender={10}      // First render: 10 items
  updateCellsBatchingPeriod={50} // Batch updates every 50ms
  // Layout optimization
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,       // Skip measurement if height is fixed
    offset: ITEM_HEIGHT * index,
    index,
  })}
  // Memory optimization
  removeClippedSubviews={true} // Detach off-screen views (Android)
/>
```

**FlatList optimization priority:**

```
FIX                              IMPACT    EFFORT
──────────────────────────────────────────────────
React.memo on renderItem         HIGH      LOW     ← Do this FIRST
getItemLayout (fixed height)     HIGH      LOW
keyExtractor (stable keys)       HIGH      LOW
windowSize tuning (10-15)        MEDIUM    LOW
maxToRenderPerBatch              MEDIUM    LOW
removeClippedSubviews            MEDIUM    LOW
FlashList (drop-in replacement)  HIGH      MEDIUM
──────────────────────────────────────────────────
```

> **FlashList** (`@shopify/flash-list`) is a drop-in replacement for FlatList that's 5x faster. Use it for lists with 100+ items.

### 11.3 Reanimated: UI Thread Animations

Regular `Animated` API runs on the JS thread → competes with React for frame budget → jank. Reanimated v3/v4 worklets run **directly on the native UI thread**.

```tsx
// ❌ BAD: JS thread animation (janky during re-renders)
import { Animated } from 'react-native'
const opacity = useRef(new Animated.Value(0)).current
Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start()

// ✅ GOOD: UI thread animation (butter smooth always)
import Animated, { useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated'

const scale = useSharedValue(1)
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: scale.value }],
}))

// Trigger: runs entirely on UI thread
const handlePress = () => {
  scale.value = withSpring(0.95, { damping: 15, stiffness: 400 })
}

return <Animated.View style={animatedStyle} />
```

**Rules for Reanimated:**
- ALL interactive animations (press, drag, swipe) → Reanimated worklets
- Decorative/entrance animations → can use `Animated` with `useNativeDriver: true`
- Gesture handlers (`react-native-gesture-handler`) + Reanimated = 60fps gestures
- NEVER read `.value` synchronously in render — always use `useAnimatedStyle`

### 11.4 React.memo & Re-render Prevention

```tsx
// ❌ BAD: Parent re-render causes ALL children to re-render
function AppointmentList({ appointments, onSelect }) {
  return appointments.map(apt => (
    <AppointmentCard
      key={apt.id}
      appointment={apt}
      onSelect={() => onSelect(apt.id)}  // New function every render!
    />
  ))
}

// ✅ GOOD: Memoized children + stable callbacks
const AppointmentCard = React.memo(function AppointmentCard({ appointment, onSelect }) {
  return (/* ... */)
})

function AppointmentList({ appointments, onSelect }) {
  const handleSelect = useCallback((id: string) => onSelect(id), [onSelect])
  return appointments.map(apt => (
    <AppointmentCard
      key={apt.id}
      appointment={apt}
      onSelect={handleSelect}
    />
  ))
}
```

### 11.5 Image Performance

```tsx
// ❌ BAD: Default Image component (no caching, no progressive loading)
import { Image } from 'react-native'
<Image source={{ uri: photoUrl }} />

// ✅ GOOD: expo-image with caching + blur placeholder
import { Image } from 'expo-image'
<Image
  source={photoUrl}
  placeholder={blurhash}          // LQIP blur while loading
  contentFit="cover"
  transition={200}                // Smooth fade-in
  cachePolicy="memory-disk"       // Cache aggressively
/>
```

> Use **expo-image** (or react-native-fast-image) over the default Image component. Default Image has no disk cache and re-downloads images on every mount.

### 11.6 120Hz / Pro Motion Considerations

Modern devices (iPhone Pro, Samsung Galaxy S series) support 120Hz displays:

```
RULE: If the app targets premium devices, test at 120Hz.

What breaks at 120Hz:
- setTimeout/setInterval-based animations (frame tearing)
- requestAnimationFrame logic assuming 16.6ms frames
- JS thread animations that barely hit 60fps

What works perfectly at 120Hz:
- Reanimated worklets (native driver, adapts automatically)
- CSS transitions (web mobile)
- Native gesture handlers

ACTION: Use Reanimated for ALL animations → automatic 120Hz support.
```

---

