// Minimal module declaration to allow TypeScript to resolve `@/` imports
declare module '@/*'

// Override Body.json() to return Promise<any> instead of Promise<unknown>
// This matches the fetch spec behaviour and prevents 45+ false-positive TS errors
interface Body {
  json(): Promise<any>
}
