# Word Is Bond Design System v3.0

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
Show information, not decorations. No emojis in professional UI. Icons only when they add meaning.

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

### Spacing Rules

1. **Component internal padding: 16px (p-4)**.
2. **Between related items: 8px (space-y-2)**.
3. **Between sections: 24px (space-y-6)**.
4. **Page margins: 24px mobile, 32px desktop**.

---

## Component Specifications

### Buttons

```
┌─────────────────────────────────────────────────────────────┐
│  VARIANT         │  COLORS                   │  USE         │
├─────────────────────────────────────────────────────────────┤
│  primary         │  Navy bg, white text      │  1 per screen│
│  secondary       │  Gray-100 bg, gray-700    │  Secondary   │
│  outline         │  White bg, gray-300 border│  Tertiary    │
│  ghost           │  Transparent, gray-600    │  Inline      │
│  destructive     │  Red-600 bg, white text   │  Delete only │
└─────────────────────────────────────────────────────────────┘
```

Button specifications:
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

```
┌─────────────────────────────────────────────────────────────┐
│  STATUS          │  BACKGROUND    │  TEXT          │        │
├─────────────────────────────────────────────────────────────┤
│  default         │  gray-100      │  gray-700      │        │
│  success         │  emerald-100   │  emerald-700   │        │
│  warning         │  amber-100     │  amber-700     │        │
│  error           │  red-100       │  red-700       │        │
│  info            │  blue-100      │  blue-700      │        │
└─────────────────────────────────────────────────────────────┘
```

Badge specifications:
- Height: 20px
- Padding: 8px horizontal
- Font: 11px, weight 500
- Border radius: 4px
- NO borders (light bg provides enough contrast)

---

## Layout Patterns

### Voice Operations Page (Primary)

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER (56px)                                              │
│  Logo    Word Is Bond                    [User] [Settings]  │
├─────────────────────────────────────────────────────────────┤
│         │                                         │         │
│  LEFT   │            MAIN CONTENT                │  RIGHT  │
│  RAIL   │                                         │  RAIL   │
│  280px  │            flex-1                       │  280px  │
│         │                                         │         │
│  Call   │   ┌─────────────────────────────┐     │ Activity│
│  List   │   │                             │     │  Feed   │
│         │   │     PHONE INPUT             │     │         │
│         │   │     ________________        │     │         │
│         │   │                             │     │         │
│         │   │      [ CALL ]              │     │         │
│         │   │                             │     │         │
│         │   │  ○ Record  ○ Transcribe    │     │         │
│         │   │                             │     │         │
│         │   └─────────────────────────────┘     │         │
│         │                                         │         │
└─────────────────────────────────────────────────────────────┘
```

### Mobile Layout

```
┌───────────────────────┐
│  HEADER               │
├───────────────────────┤
│                       │
│  MAIN CONTENT         │
│  (full width)         │
│                       │
│  Phone input          │
│  _______________      │
│                       │
│     [ CALL ]          │
│                       │
│  Options (collapsed)  │
│                       │
├───────────────────────┤
│ [Dial] [Calls] [More] │
│  BOTTOM NAV           │
└───────────────────────┘
```

---

## Icon Usage

### Rules

1. **No emojis in professional UI**. Ever.
2. **Icons are supplements, not replacements** for text.
3. **Use Lucide icons** — consistent stroke width, professional appearance.
4. **Size: 16px (inline), 20px (buttons), 24px (navigation)**.
5. **Color: inherit from text** — don't add separate icon colors.

### When to Use Icons

- Navigation items (with text labels)
- Action buttons (secondary actions only)
- Status indicators (with aria-label)

### When NOT to Use Icons

- As the only identifier (always include text)
- For decoration
- In data tables (use text/badges instead)

---

## Interaction Patterns

### Focus States

Every interactive element must have:
- 2px focus ring
- Primary color (navy)
- 2px offset from element
- Visible on :focus-visible (not :focus)

### Hover States

- Buttons: darken background by 10%
- Cards: subtle shadow-sm
- Links: underline
- Rows: gray-50 background

### Loading States

- Primary action: spinner replaces text
- Page load: skeleton placeholders
- Data fetch: inline spinner

### Transitions

```css
--transition-fast: 100ms ease;
--transition-default: 150ms ease;
--transition-slow: 300ms ease;
```

---

## Accessibility Requirements

### WCAG 2.2 AA Compliance

| Requirement | Specification |
|-------------|---------------|
| Color contrast | 4.5:1 minimum for text |
| Focus visible | 2px ring, always visible |
| Touch targets | 44px minimum |
| Motion | Respect prefers-reduced-motion |
| Labels | All inputs have visible labels |
| Error states | Clear text, not color alone |

### Screen Reader Support

- All icons have aria-label or aria-hidden
- Live regions for dynamic updates
- Logical heading hierarchy (h1 > h2 > h3)
- Form error messages announced

---

## Anti-Patterns (What NOT to Do)

### DON'T

1. Use emojis in the UI
2. Use dark theme as default
3. Add decorative elements
4. Use more than 2 font weights per page
5. Create "busy" interfaces with many colors
6. Use shadows everywhere
7. Add animations that don't serve a purpose
8. Put icons without text labels
9. Use bright/saturated colors for backgrounds
10. Make everything "pop"

### DO

1. Let white space breathe
2. Use one primary action per screen
3. Show data cleanly
4. Use subtle borders and separators
5. Make interactive elements obvious
6. Keep navigation consistent
7. Provide clear feedback
8. Design for scanning, not reading
9. Reduce cognitive load
10. Trust the user's intelligence

---

## Implementation Checklist

- [ ] Replace tailwind.config.js with new palette
- [ ] Update globals.css with CSS variables
- [ ] Rebuild Button, Input, Badge, Card components
- [ ] Remove all emojis from components
- [ ] Switch to light theme
- [ ] Update VoiceOperationsClient layout
- [ ] Simplify CallModulations toggles
- [ ] Clean up ActivityFeedEmbed
- [ ] Update all remaining voice/* components
- [ ] Run accessibility audit
- [ ] Verify mobile responsiveness

---

## Related Documents

- **[UX Workflow Patterns](./UX_WORKFLOW_PATTERNS.md)** — Navigation, onboarding, progressive disclosure patterns
- **[UX Design Principles](./UX_DESIGN_PRINCIPLES.md)** — Core UX philosophy and principles
- **[Artifact Authority Contract](../01-CORE/ARTIFACT_AUTHORITY_CONTRACT.md)** — Data authority and evidence display rules

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 2026 | Initial Jetsons theme |
| 2.0 | Jan 2026 | Call-rooted UX |
| 3.0 | Jan 2026 | **Professional SMB redesign** |
| 3.1 | Jan 2026 | Added AppShell, onboarding, progressive disclosure |

---

*"Simplicity is the ultimate sophistication." — Leonardo da Vinci*
