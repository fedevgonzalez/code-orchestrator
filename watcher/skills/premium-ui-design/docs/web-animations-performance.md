# Premium UI Design - Web Animations & Performance
## 15. Web Animation Patterns (Framer Motion)

Implementation patterns for premium web animations using Framer Motion.

### Page Transitions

```tsx
import { motion, AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'

export function AnimatedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
```

### Staggered List Animation

```tsx
const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.2,
      staggerChildren: 0.08,
    }
  },
  exit: {
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
    }
  }
}

const childVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1, y: 0,
    transition: { type: 'spring', damping: 25, stiffness: 300 }
  },
  exit: { opacity: 0, y: -10 }
}

<motion.div variants={containerVariants} initial="hidden" animate="visible" exit="exit">
  {items.map(item => (
    <motion.div key={item.id} variants={childVariants}>
      <Card>{item.content}</Card>
    </motion.div>
  ))}
</motion.div>
```

### Hover & Press Feedback

```tsx
<motion.div
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.97 }}
  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
>
  <Card>...</Card>
</motion.div>
```

### Advanced Stagger Patterns

```tsx
import { stagger } from 'framer-motion'

// From center outward (great for grids)
transition={{ delayChildren: stagger(0.1, { from: "center" }) }}

// From last to first (exit)
transition={{ delayChildren: stagger(0.05, { from: "last" }) }}

// Custom delay per index
const childVariants = {
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, type: 'spring', damping: 25, stiffness: 300 }
  })
}
// Usage: <motion.div custom={index} variants={childVariants} />
```

### Skeleton Loading (shadcn)

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export function CardSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-[200px] w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  )
}
```

### Scroll Reveal (IntersectionObserver Fallback)

```tsx
import { useInView } from 'framer-motion'

function RevealOnScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
    >
      {children}
    </motion.div>
  )
}
```

### Spring Animation Physics (Deep Dive)

Spring animations are what make apps feel **alive** instead of robotic. Understanding the three parameters lets you tune ANY animation to feel exactly right.

**The Three Parameters:**

```
SPRING PHYSICS:
----------------------------------------------------------------------
Stiffness  = How quickly the spring pulls toward the target
             Higher = snappier, more forceful (100-500)

Damping    = How much the oscillation is reduced
             Higher = less bouncing, settles faster (10-40)
             Lower  = more bouncing, springy feel (5-15)

Mass       = Weight of the moving object
             Higher = more sluggish, heavier feel (1-5)
             Default: 1 (rarely changed)
----------------------------------------------------------------------
```

**Physics-Based vs Duration-Based Springs:**

```tsx
// PHYSICS-BASED: Natural, incorporates gesture velocity
// Use for: interactive elements (drag, swipe, press)
transition={{ type: "spring", stiffness: 300, damping: 25 }}

// DURATION-BASED: Predictable timing, no velocity transfer
// Use for: decorative animations (entrance, page transition)
transition={{ type: "spring", duration: 0.4, bounce: 0.25 }}
```

> **Rule:** If the animation responds to user gesture -> physics-based. If decorative -> duration-based is fine.

**Spring Presets by Use Case:**

```tsx
// INTERACTIVE
{ stiffness: 400, damping: 25, mass: 1 }    // Snappy (buttons, toggles)
{ stiffness: 500, damping: 30, mass: 0.8 }  // Press feedback (crisp, no overshoot)
{ stiffness: 350, damping: 20, mass: 1 }    // Drag release (responsive, slight bounce)

// TRANSITIONS
{ stiffness: 300, damping: 22, mass: 1 }    // Modal open/close (smooth, slight bounce)
{ stiffness: 150, damping: 30, mass: 1 }    // Page transition (gentle, no bounce)
{ stiffness: 250, damping: 28, mass: 1 }    // Sidebar slide (medium, smooth)

// CELEBRATIONS
{ stiffness: 200, damping: 12, mass: 1 }    // Bouncy entrance (confetti, checkmark)
{ stiffness: 300, damping: 10, mass: 0.8 }  // Scale pop (badge, notification)
{ stiffness: 120, damping: 14, mass: 0.6 }  // Float up (toast, element entrance)

// MOBILE (Reanimated)
withSpring(value, { damping: 15, stiffness: 300 })  // Card press
withSpring(value, { damping: 50, stiffness: 500 })  // Bottom sheet snap
withSpring(value, { damping: 12, stiffness: 200 })  // List item bounce
```

---

## 16. Scroll & Image Patterns (Web)

### Sticky Headers

```css
.header {
  position: sticky;
  top: 0;
  z-index: 40;
  transition: height 200ms ease, padding 200ms ease;
}

/* Chrome 133+: shrink on stick without JS */
@container scroll-state(stuck: top) {
  .header { height: 48px; padding: 4px 16px; }
}
```

### Scroll Snap (Carousels, Onboarding)

```css
.carousel {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}

.carousel-item {
  scroll-snap-align: start;
  flex-shrink: 0;
}
```

### Scroll-Linked Animations (CSS-Only)

```css
/* Reading progress bar */
.progress-bar {
  position: fixed;
  top: 0; left: 0;
  height: 3px;
  background: oklch(var(--primary));
  transform-origin: left;
  animation: grow-progress linear;
  animation-timeline: scroll();
}

@keyframes grow-progress {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}

/* Reveal-on-scroll (elements fade in as they enter viewport) */
.reveal-on-scroll {
  animation: reveal linear both;
  animation-timeline: view();
  animation-range: entry 0% entry 100%;
}

@keyframes reveal {
  from { opacity: 0; transform: translateY(30px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

Browser support: Chrome/Edge 115+. Always provide IntersectionObserver JS fallback for Safari/Firefox.

### Smooth Scroll with Accessibility

```css
html { scroll-behavior: smooth; }

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
}
```

### LQIP (Low-Quality Image Placeholder)

```tsx
import Image from 'next/image'

<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,/9j/4AAQ..."
  priority // For above-the-fold images
/>
```

Image format priority: **AVIF > WebP > JPEG**. Next.js `<Image>` handles format negotiation automatically.

For hero images: use `fetchpriority="high"` above the fold, `loading="lazy"` below.

---

## 17. Shared Element Transitions (View Transitions API)

The View Transitions API creates smooth morph animations between screens.

### CSS View Transitions

```css
/* Assign matching names to elements that morph between views */
.product-thumbnail { view-transition-name: product-image; }
.product-hero      { view-transition-name: product-image; }

::view-transition-old(product-image) {
  animation: fade-out 0.25s ease-in;
}
::view-transition-new(product-image) {
  animation: fade-in 0.25s ease-out;
}
```

### When to Use

```
USE SHARED ELEMENTS:
  List → Detail     (thumbnail → full image)
  Grid → Expanded   (grid item → overlay)
  Tab switch        (element morphs between content)

DON'T USE (overkill):
  Simple page navigation  (use fade/slide)
  Within same page        (use layout animations)
  Every link click        (too much motion)
```

Browser support: Chrome/Edge full, Safari 18+ same-document. Always provide CSS fade fallback:

```css
@supports not (view-transition-name: test) {
  .page-enter { animation: fadeIn 0.3s ease; }
  .page-exit { animation: fadeOut 0.2s ease; }
}
```

---

## 18. Modal & Dialog Accessibility

### Focus Trap Pattern

When a modal opens, keyboard focus MUST be trapped inside it:
- On open: move focus to first focusable element (or dialog itself)
- Tab/Shift+Tab cycles within dialog only
- Escape key closes dialog
- On close: return focus to trigger element
- Background content is inert

> With shadcn/ui Dialog (Radix-based), this is handled automatically.

### Required ARIA Attributes

```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
>
  <h2 id="dialog-title">Confirm Deletion</h2>
  <p id="dialog-description">This action cannot be undone.</p>
</div>
```

### Background Inert

```tsx
<main inert={isDialogOpen}>
  {/* Page content — not focusable, not clickable */}
</main>
<Dialog open={isDialogOpen}>
  {/* Dialog content */}
</Dialog>
```

---

## 19. INP & Core Web Vitals (Interaction Performance)

INP (Interaction to Next Paint) measures how fast your app **responds to user input**. A sluggish click or janky toggle destroys the premium feel. Google uses INP as a Core Web Vital ranking signal.

### Core Web Vitals Targets

```
METRIC        TARGET     WHAT IT MEASURES
----------------------------------------------------------------------
LCP           < 2.5s     Largest Contentful Paint (loading)
INP           < 200ms    Interaction to Next Paint (responsiveness)
CLS           < 0.1      Cumulative Layout Shift (visual stability)
----------------------------------------------------------------------
```

### INP Anatomy

```
INP = Input Delay + Processing Time + Presentation Delay

Input Delay       = event queued (main thread busy)
Processing Time   = your handler runs
Presentation Delay = browser renders next frame

Target: total < 200ms
```

### Reducing Input Delay

```tsx
// BAD: Heavy computation blocks the main thread
function handleSearch(query: string) {
  const results = expensiveFilter(allItems, query) // 300ms+
  setResults(results)
}

// GOOD: useTransition marks the update as non-urgent
import { useTransition } from 'react'

function handleSearch(query: string) {
  setQuery(query)
  startTransition(() => {
    setResults(expensiveFilter(allItems, query))
  })
}
```

Key techniques: `useTransition` for non-urgent updates, code splitting with `React.lazy`, `React.memo` to prevent unnecessary re-renders.

### Reducing Processing Time

```tsx
// BAD: Entire list re-renders on every toggle
function TodoList({ items }: { items: Todo[] }) {
  return items.map(item => (
    <div key={item.id} onClick={() => toggle(item.id)}>
      {item.title}
    </div>
  ))
}

// GOOD: Memoized child prevents cascade re-renders
const TodoItem = React.memo(function TodoItem({ item, onToggle }: Props) {
  return (
    <div onClick={() => onToggle(item.id)}>
      {item.title}
    </div>
  )
})

function TodoList({ items }: { items: Todo[] }) {
  const toggle = useCallback((id: string) => { /* ... */ }, [])
  return items.map(item => (
    <TodoItem key={item.id} item={item} onToggle={toggle} />
  ))
}
```

### Reducing Presentation Delay

```
CSS PROPERTY COST:
----------------------------------------------------------------------
CHEAP (compositor only)      -> transform, opacity
MEDIUM (repaint only)        -> color, background, box-shadow
EXPENSIVE (layout + repaint) -> width, height, top, left, padding, margin
----------------------------------------------------------------------
RULE: Animate ONLY transform + opacity for 60fps guaranteed.
```

### Next.js Specific Optimizations

```tsx
// 1. Server Components reduce JS bundle (no JS shipped to client)
async function ProductList() {
  const products = await db.products.findMany()
  return <ProductGrid products={products} />
}

// 2. Streaming with Suspense for progressive rendering
export default function Page() {
  return (
    <div>
      <Header />
      <Suspense fallback={<TableSkeleton />}>
        <DataTable />
      </Suspense>
    </div>
  )
}

// 3. next/dynamic for client-side heavy components
import dynamic from 'next/dynamic'
const HeavyChart = dynamic(() => import('./HeavyChart'), {
  loading: () => <ChartSkeleton />,
  ssr: false
})
```

### INP Debugging

```typescript
if (typeof window !== 'undefined') {
  import('web-vitals').then(({ onINP }) => {
    onINP((metric) => {
      console.log('INP:', metric.value, 'ms')
      if (metric.value > 200) {
        console.warn('POOR INP! Target:', metric.entries[0]?.target)
      }
    })
  })
}
```

### INP Quick Fixes Checklist

```
FIX                          IMPACT    EFFORT
----------------------------------------------------------------------
useTransition for filters    HIGH      LOW
React.memo on list items     HIGH      LOW
Code split heavy routes      HIGH      MEDIUM
Animate transform+opacity    HIGH      LOW
Debounce rapid inputs        MEDIUM    LOW
Move to Server Components    HIGH      HIGH
Web Worker for computation   MEDIUM    HIGH
Virtualize long lists        HIGH      MEDIUM
----------------------------------------------------------------------
```

---

## Theming (Multi-Theme Support)

To create color variations (red theme, blue theme, green theme):

1. Use OKLCH as the color space
2. Convert neutral grays to subtle tints by adjusting Hue to match the theme color
3. Keep Lightness and Chroma systematic across all tints

```css
/* Blue theme neutrals */
--bg: oklch(0.98 0.005 250);
--surface: oklch(0.96 0.005 250);

/* Green theme neutrals */
--bg: oklch(0.98 0.005 145);
--surface: oklch(0.96 0.005 145);
```

---

## Related Skills

- `premium-ux-patterns` - UX psychology and behavioral patterns
- `mobile-ux-design` - Mobile-specific design patterns
- `frontend-design` - Implementation patterns (code)
- `shadcn-theming` - shadcn/ui CSS variable system
- `tailwind-theming` - Tailwind CSS theming
- `design-system` - Design token mapping
