// Minimal module declaration to allow TypeScript to resolve `@/` imports
declare module "@/*";
// Declarations for packages lacking type-exported subpath declarations used in the project
declare module 'next-auth/next';
declare module 'next-auth/react';
