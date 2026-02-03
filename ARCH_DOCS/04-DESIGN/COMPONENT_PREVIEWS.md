# Component Previews

Live HTML/Tailwind previews for core components. Copy-paste ready. Uses Tailwind + shadcn-ui patterns.

## Setup (for local preview)
```html
<!DOCTYPE html>
<html class="dark">
<head>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/@shadcn/ui@latest/dist/index.js"></script> <!-- shadcn example -->
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap">
</head>
<body class="p-8 font-sans antialiased bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-50">
```

## Buttons

```html
<button class="inline-flex h-10 items-center justify-center rounded-md bg-navy px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-navy-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
  Primary Button
</button>

<button class="inline-flex h-10 items-center justify-center rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800">
  Secondary Button
</button>

<button class="inline-flex h-10 items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
  Success Button
</button>
```

**Dark Mode Preview** (add `dark:` classes as per globals.css)

## Inputs

```html
<div class="grid w-full max-w-sm items-center space-y-2">
  <label class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Email</label>
  <input class="flex h-10 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:ring-offset-slate-950 dark:placeholder:text-slate-500 dark:focus-visible:ring-navy" placeholder="your@email.com" />
</div>
```

## Cards

```html
<div class="rounded-lg border bg-card text-card-foreground shadow-sm w-80">
  <div class="p-6">
    <h3 class="font-semibold text-lg mb-2">Card Title</h3>
    <p class="text-sm text-muted-foreground mb-4">Card description...</p>
    <div class="flex gap-2">
      <button class="h-9 px-4 py-2 rounded-md bg-primary text-primary-foreground">Action</button>
      <button class="h-9 px-4 py-2 rounded-md border">Secondary</button>
    </div>
  </div>
</div>
```

## Badges

```html
<span class="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-50">Success</span>
<span class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-800 dark:text-gray-200">Default</span>
<span class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-50">Error</span>
```

## Data Tables (Simple)

```html
<table class="w-full caption-bottom text-sm">
  <thead>
    <tr class="border-b bg-muted/50">
      <th class="h-12 px-4 text-left align-middle font-medium">Name</th>
      <th class="h-12 px-4 text-left align-middle font-medium">Status</th>
      <th class="h-12 px-4 text-left align-middle font-medium">Action</th>
    </tr>
  </thead>
  <tbody class="divide-y">
    <tr class="hover:bg-muted/50">
      <td class="h-12 px-4 align-middle">Call #123</td>
      <td class="h-12 px-4 align-middle">
        <span class="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">Completed</span>
      </td>
      <td class="h-12 px-4 align-middle">
        <button class="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs">View</button>
      </td>
    </tr>
  </tbody>
</table>
```

## Modals (CSS only preview)

```html
<div class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
  <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
    <div class="fixed inset-0 bg-black/50 transition-opacity" aria-hidden="true"></div>
    <div class="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
      <div class="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
        <div class="sm:flex sm:items-start">
          <div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-navy-100 sm:mx-0 sm:h-10 sm:w-10">
            <svg class="h-6 w-6 text-navy" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
            <h3 id="modal-title" class="text-base font-semibold leading-6 text-gray-900">Confirm Action</h3>
            <div class="mt-2">
              <p class="text-sm text-gray-500">Are you sure?</p>
            </div>
          </div>
        </div>
      </div>
      <div class="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
        <button type="button" class="inline-flex w-full justify-center rounded-md bg-navy px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-navy-dark sm:ml-3 sm:w-auto">Confirm</button>
        <button type="button" class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto">Cancel</button>
      </div>
    </div>
  </div>
</div>
```

## Usage Notes
- Previews use Tailwind classes matching globals.css/tailwind.config.js.
- Dark mode: Toggle `dark` class on html.
- shadcn-ui: Install via CLI for full components.
- Responsive: All previews mobile-ready.

**Last Updated:** Feb 2, 2026