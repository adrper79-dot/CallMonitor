# Tailwind CSS + shadcn/ui Guide

## Versions
- `tailwindcss`: ^4.1.18 (@tailwindcss/postcss)
- `class-variance-authority` (cva): ^0.7.1
- `clsx`: ^2.1.1, `tailwind-merge`: ^3.4.0
- `lucide-react`: ^0.562.0 (icons)
- Radix UI: react-dialog, select, etc. ^1.x/2.x

## Setup
- `tailwind.config.js`: content paths, theme extend.
- `globals.css`: @tailwind base/components/utilities + css vars.
- PostCSS: tailwindcss + autoprefixer.

## shadcn/ui Pattern
- Copy-paste components/ui/* (Button.tsx, Input.tsx...)
- Variants via cva:
```tsx
// components/ui/button.tsx
import { cva } from 'class-variance-authority'
const buttonVariants = cva('...base...', {
  variants: { variant: { destructive: '...', outline: '...' } }
})
<Button className={buttonVariants({ variant: 'destructive' })} />
```

## Key Components Used
- Button, Input (EmailInput/PasswordInput custom)
- Dialog, Select, Switch, AlertDialog
- NavigationMenu? mode-toggle.tsx

## Examples
```tsx
// app/signin/page.tsx
<EmailInput id="email" value={email} onChange={setEmail} />
<Button disabled={!canSubmit}>Sign In</Button>
```

### cn() Utility (clsx + twMerge)
```ts
// lib/utils.ts (shadcn std)
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
```

## Best Practices
- Semantic + Tailwind: block text-sm font-medium
- Variants: cva for Button, Input.
- Dark mode: next-themes + css vars.
- Responsive: sm/md prefixes.

## Customization
- `components/ui/`: add FormValidation wrappers.
- tailwind.config.js: colors, fonts.

## Troubleshooting
- Purge: content paths include all.
- Tailwind 4: postcss plugin.
- IntelliSense: VSCode Tailwind CSS extension.

See 04-DESIGN/DESIGN_SYSTEM.md, components/ui/