// Minimal module declaration to allow TypeScript to resolve `@/` imports
declare module "@/*";
// Declarations for packages lacking type-exported subpath declarations used in the project
declare module 'next-auth/next';
declare module 'next-auth/react';

// Override Body.json() to return Promise<any> instead of Promise<unknown>
// This matches the fetch spec behaviour and prevents 45+ false-positive TS errors
interface Body {
  json(): Promise<any>
}
