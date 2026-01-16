# UX Design Principles v3.0

**Last Updated:** January 15, 2026  
**Status:** Active - Professional Design System

---

## Philosophy

> "Simple can be harder than complex. You have to work hard to get your thinking clean to make it simple."  
> — Steve Jobs

Word Is Bond is designed for **SMBs who need to look competent and trustworthy** to their customers. Our design should make them feel like they have professional-grade tools without the complexity of enterprise software.

---

## Core Principles

### 1. Invisible Design

The best interface is one the user doesn't notice. Every element must justify its existence. If something doesn't help the user accomplish their task, remove it.

### 2. One Primary Action Per Screen

Every screen should have exactly ONE obvious thing to do. The Call button is primary. Everything else is secondary.

### 3. Data Over Decoration

- No emojis in professional UI
- Icons only when they add meaning (not decoration)
- Clean data presentation without visual clutter

### 4. Trust Through Restraint

SMBs are often insecure about competing with larger companies. Our design signals competence through:
- White space (confidence, not cramped)
- Consistent patterns (predictability)
- Clear feedback (reliability)

### 5. Light Theme by Default

Light themes signal professionalism and are easier to read in varied lighting conditions. Save dark themes for specialized tools.

---

## Color System

### Primary Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Navy Blue | `#1E3A5F` | Primary buttons, brand accent |
| Navy Dark | `#15294A` | Hover states |
| Navy Light | `#EFF6FF` | Selected states |

### Semantic Colors

| Status | Background | Text |
|--------|------------|------|
| Success | `#D1FAE5` | `#059669` |
| Warning | `#FEF3C7` | `#D97706` |
| Error | `#FEE2E2` | `#DC2626` |
| Info | `#DBEAFE` | `#2563EB` |

### Neutral Palette

- Background: `#FFFFFF` (white)
- Subtle Background: `#F9FAFB` (gray-50)
- Borders: `#E5E7EB` (gray-200)
- Primary Text: `#1F2937` (gray-800)
- Secondary Text: `#6B7280` (gray-500)

---

## Typography

### Font Stack

```
Primary: Inter, -apple-system, BlinkMacSystemFont, sans-serif
Mono: JetBrains Mono, Consolas, monospace
```

### Type Scale

| Name | Size | Weight | Use |
|------|------|--------|-----|
| Heading 1 | 24px | 600 | Page titles |
| Heading 2 | 20px | 600 | Section headers |
| Heading 3 | 16px | 600 | Card titles |
| Body | 14px | 400 | Default text |
| Small | 12px | 400 | Captions, hints |
| Tiny | 11px | 500 | Badges |

---

## Layout: Voice Operations Page

### Desktop (lg+)

```
┌────────────────────────────────────────────────────────────┐
│  Header (56px)                                             │
│  Word Is Bond  │  Org Name  │           Plan │ Role │       │
├────────────────────────────────────────────────────────────┤
│         │                                    │             │
│  Left   │         Main Content               │   Right     │
│  Rail   │                                    │   Rail      │
│  280px  │     ┌──────────────────────┐      │   280px     │
│         │     │   Phone Input        │      │             │
│  Call   │     │   _______________    │      │  Activity   │
│  List   │     │                      │      │  Feed       │
│         │     │      [ CALL ]        │      │             │
│         │     │                      │      │             │
│         │     │  Call Options        │      │             │
│         │     │  ○ Record            │      │             │
│         │     │  ○ Transcribe        │      │             │
│         │     │  ○ Translate         │      │             │
│         │     └──────────────────────┘      │             │
│         │                                    │             │
└────────────────────────────────────────────────────────────┘
```

### Mobile

```
┌─────────────────────┐
│  Header             │
├─────────────────────┤
│                     │
│  Phone Input        │
│  _______________    │
│                     │
│      [ CALL ]       │
│                     │
│  Options (collapse) │
│                     │
├─────────────────────┤
│ Dial │ Calls │ More │
└─────────────────────┘
```

---

## Component Guidelines

### Buttons

| Variant | Use Case | Per Screen |
|---------|----------|------------|
| Primary | Main action (Call button) | 1 only |
| Secondary | Secondary actions | Multiple OK |
| Outline | Tertiary actions | Multiple OK |
| Ghost | Inline/subtle actions | Multiple OK |
| Destructive | Delete/danger only | Rarely |

### Inputs

- Height: 40px
- Border: 1px gray-300
- Focus: 2px ring in primary color
- Clear placeholder text
- Required fields indicated with * or text

### Cards

- White background
- 1px gray-200 border
- 8px border radius
- 16px or 24px padding
- No shadow by default

### Badges

- Light backgrounds (not saturated)
- 4px border radius
- Font size: 11px
- Used for status only

---

## Accessibility Requirements

### WCAG 2.2 AA Compliance

- **Color contrast:** 4.5:1 minimum for text
- **Focus indicators:** 2px ring, always visible
- **Touch targets:** 44px minimum on mobile
- **Motion:** Respect `prefers-reduced-motion`
- **Labels:** All inputs have visible labels
- **Errors:** Indicated with text, not just color

### Keyboard Navigation

- Full Tab navigation through all interactive elements
- Arrow keys for list navigation
- Enter/Space to activate
- Escape to close modals

---

## What NOT to Do

1. ❌ Use emojis in UI
2. ❌ Use dark theme as default
3. ❌ Add decorative elements
4. ❌ Use more than 2-3 colors per screen
5. ❌ Use shadows everywhere
6. ❌ Add animations without purpose
7. ❌ Put icons without text labels
8. ❌ Use bright colors for backgrounds
9. ❌ Create "busy" interfaces
10. ❌ Use playful/casual language

---

## What TO Do

1. ✅ Use generous white space
2. ✅ Keep one primary action per screen
3. ✅ Present data cleanly
4. ✅ Use subtle borders and dividers
5. ✅ Make interactive elements obvious
6. ✅ Provide clear feedback
7. ✅ Design for scanning, not reading
8. ✅ Use professional, clear language
9. ✅ Maintain consistent patterns
10. ✅ Trust the user's intelligence

---

## Design System Reference

For detailed specifications, see: `ARCH_DOCS/04-DESIGN/DESIGN_SYSTEM.md`

---

*"Design is not just what it looks like and feels like. Design is how it works."*  
— Steve Jobs
