# Word Is Bond Design System v4.0

**Philosophy:** Professional, trustworthy, invisible.  
**Target:** SMBs who need to look competent to their customers.  
**Inspiration:** Stripe, Linear, Notion — tools that disappear so work can happen.

---

## Core Principles

### 1. Invisible Design
> "The best interface is no interface." — Golden Krishna

Users should forget they're using software. Every element must justify its existence.

### 2. Trust Through Restraint
SMBs are often insecure about competing with larger companies. Our design should make them feel like they have professional-grade tools without the complexity.

### 3. One Primary Action
Every screen has ONE obvious thing to do. Everything else is secondary.

### 4. Data Over Decoration
Show information, not decorations. No emojis in professional UI. Icons only when they add meaning (use Lucide).

### 5. White Space = Confidence
Cramped interfaces feel cheap. Generous spacing signals quality and control.

---

## Color System

### Brand Colors

```
┌─────────────────────────────────────────────────────────────┐
│  PRIMARY         │  USAGE                                   │
├─────────────────────────────────────────────────────────────┤
│  Navy #1E3A5F    │  Headers, primary buttons, brand accent  │
│  Navy-dark #15294A│  Hover states, emphasis                 │
│  Navy-light #2D4A6F│ Subtle backgrounds                     │
└─────────────────────────────────────────────────────────────┘
```

### Semantic Colors

```
┌─────────────────────────────────────────────────────────────┐
│  SUCCESS         │  #059669 (Emerald)                       │
│  SUCCESS-LIGHT   │  #D1FAE5 (Emerald 100)                   │
│  WARNING         │  #D97706 (Amber)                         │
│  WARNING-LIGHT   │  #FEF3C7 (Amber 100)                     │
│  ERROR           │  #DC2626 (Red)                           │
│  ERROR-LIGHT     │  #FEE2E2 (Red 100)                       │
│  INFO            │  #2563EB (Blue)                          │
│  INFO-LIGHT      │  #DBEAFE (Blue 100)                      │
└─────────────────────────────────────────────────────────────┘
```

### Neutral Palette

```
┌─────────────────────────────────────────────────────────────┐
│  white           │  #FFFFFF     │  Page background          │
│  gray-50         │  #F9FAFB     │  Card backgrounds         │
│  gray-100        │  #F3F4F6     │  Subtle dividers          │
│  gray-200        │  #E5E7EB     │  Borders                  │
│  gray-300        │  #D1D5DB     │  Disabled states          │
│  gray-400        │  #9CA3AF     │  Placeholder text         │
│  gray-500        │  #6B7280     │  Secondary text           │
│  gray-600        │  #4B5563     │  Body text                │
│  gray-700        │  #374151     │  Headings                 │
│  gray-800        │  #1F2937     │  Primary text             │
│  gray-900        │  #111827     │  Maximum contrast         │
└─────────────────────────────────────────────────────────────┘
```

### Color Usage Rules

1. **Never use pure black (#000)** — it's harsh. Use gray-900 for darkest text.
2. **Color for meaning, not decoration** — green means success, red means error.
3. **Primary color sparingly** — only for the ONE primary action per screen.
4. **Status badges use light backgrounds** — not saturated colors.

---

## Typography

### Font Stack

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
```

### Type Scale

```
┌─────────────────────────────────────────────────────────────┐
│  NAME            │  SIZE    │  WEIGHT  │  USE               │
├─────────────────────────────────────────────────────────────┤
│  display         │  30px    │  600     │  Page titles       │
│  heading-1       │  24px    │  600     │  Section headers   │
│  heading-2       │  20px    │  600     │  Card titles       │
│  heading-3       │  16px    │  600     │  Subsections       │
│  body            │  14px    │  400     │  Default text      │
│  body-large      │  16px    │  400     │  Emphasized body   │
│  small           │  12px    │  400     │  Captions, hints   │
│  tiny            │  11px    │  500     │  Badges, labels    │
└─────────────────────────────────────────────────────────────┘
```

### Typography Rules

1. **Headings use font-weight 600** — not bold (700), which feels aggressive.
2. **Body text is 14px base** — readable without feeling childish.
3. **Line height 1.5 for body, 1.25 for headings**.
4. **Tabular figures for data** — numbers should align in columns.

---

## Spacing System

Based on 4px unit. Use these values consistently:

```
1   =  4px   (micro adjustments)
2   =  8px   (tight spacing)
3   = 12px   (compact spacing)
4   = 16px   (default spacing)
5   = 20px   (comfortable spacing)
6   = 24px   (section spacing)
8   = 32px   (large gaps)
10  = 40px   (major sections)
12  = 48px   (page sections)
16  = 64px   (hero spacing)
```

---

## Component Specifications

### Buttons

- Height: 40px (default), 36px (sm), 48px (lg)
- Border radius: 6px
- Font weight: 500
- Padding: 16px horizontal
- Transition: 150ms ease
- Focus ring: 2px offset, primary color

### Inputs

- Height: 40px
- Border: 1px gray-300
- Border radius: 6px
- Focus: 2px ring primary color
- Placeholder: gray-400
- Background: white (not gray)

### Cards

- Background: white
- Border: 1px gray-200
- Border radius: 8px
- Shadow: none by default (shadow-sm on hover optional)
- Padding: 16px or 24px

### Badges

- Height: 20px
- Padding: 8px horizontal
- Font: 11px, weight 500
- Border radius: 4px
- NO borders (light bg provides enough contrast)

### Data Tables
- Header: Gray-50 background, gray-500 text, 12px uppercase
- Rows: White background, border-b gray-100
- Hover: Gray-50
- Cell Padding: 16px

### Modals / Dialogs
- Backdrop: bg-black/50 (backdrop-blur-sm optional)
- Panel: White, rounded-lg, shadow-xl
- Max Width: sm (400px), md (600px), lg (800px)

---

## Layout Patterns

### Desktop (Desktop First, but Mobile Capable)
- **Sidebar**: 280px fixed width (collapsible on tablet)
- **Main Area**: Flex-1, max-width constrained for readability (e.g. prose)
- **Right Rail**: Optional 280px for context/activity

### Mobile Responsiveness
**Breakpoints**:
- `sm`: 640px (Mobile landscape)
- `md`: 768px (Tablet portrait)
- `lg`: 1024px (Tablet landscape / Laptop)
- `xl`: 1280px (Desktop)

**Mobile Patterns**:
- **Navigation**: Bottom tab bar (fixed) or Hamburger menu.
- **Sidebar**: Hidden by default, slides in (Sheet).
- **Tables**: Horizontally scrollable or stacked cards.
- **Actions**: Floating Action Button (FAB) or sticky bottom bar.

---

## Themes & Dark Mode

### Strategy
- **Default**: System preference.
- **Toggle**: Explicit user toggle in Settings (Light / Dark / System).
- **Implementation**: `next-themes` + Tailwind `dark:` variant.

### Dark Palette Mapping
- Background: White → Slate-950
- Card: White → Slate-900
- Border: Gray-200 → Slate-800
- Text: Gray-900 → Slate-50
- Muted: Gray-500 → Slate-400

---

## Icon Usage

### Rules

1. **No emojis in professional UI**. Ever.
2. **Icons are supplements, not replacements** for text.
3. **Use Lucide icons** — consistent stroke width, professional appearance.
4. **Size: 16px (inline), 20px (buttons), 24px (navigation)**.
5. **Color: inherit from text** — don't add separate icon colors.

---

## Interaction Patterns

### Focus States
- 2px focus ring
- Primary color (navy)
- 2px offset from element
- Visible on :focus-visible (not :focus)

### Hover States
- Buttons: darken background by 10%
- Cards: subtle shadow-sm
- Links: underline
- Rows: gray-50 background

---

## Technical Implementation

### CSS Variables
Use CSS variables in `globals.css` for runtime theme switching:
```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  /* ...shadcn variables */
}
```

### Motion
- **Library**: `framer-motion` (optional) or CSS transitions
- **Duration**: Fast (150ms), Medium (300ms)
- **Curve**: Ease-out

---

## Implementation Checklist (v4.0)

- [ ] Complete emoji audit (replace with Icons).
- [ ] Enforce font-weight: 600 max (no bold/700).
- [ ] Audit shadows (reduce usage of shadow-xl).
- [ ] Implement dark mode toggle.
- [ ] Verify mobile layout (bottom nav/sidebar sheet).
- [ ] Add `data-tour` attributes to Billing/Settings pages.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 2026 | Initial Jetsons theme |
| 2.0 | Jan 2026 | Call-rooted UX |
| 3.0 | Jan 2026 | Professional SMB redesign |
| 4.0 | Jan 2026 | **Consolidated System**. Added Dark Mode intro, Mobile patterns, Component Catalog. |

---

*"Simplicity is the ultimate sophistication." — Leonardo da Vinci*
