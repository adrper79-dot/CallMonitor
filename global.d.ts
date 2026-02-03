// Minimal module declaration to allow TypeScript to resolve `@/` imports
declare module "@/*";
// Declarations for packages lacking type-exported subpath declarations used in the project
declare module 'next-auth/next';
declare module 'next-auth/react';

// SignalWire JS SDK types
declare module '@signalwire/js' {
  export interface SignalWireOptions {
    host: string
    project: string
    token: string
  }
  
  export interface SignalWireClient {
    dial(options: DialOptions): Promise<Call>
    on(event: string, handler: (data: any) => void): void
    disconnect(): Promise<void>
  }
  
  export interface DialOptions {
    to: string
    nodeId?: string
    record?: boolean
    transcribe?: boolean
  }
  
  export interface Call {
    id: string
    hangup(): Promise<void>
    mute(): void
    unmute(): void
    sendDTMF(digits: string): void
    getStats(): Promise<CallStats | null>
    on(event: string, handler: (data: any) => void): void
  }
  
  export interface CallStats {
    audio?: {
      bitrate?: number
      packetsLost?: number
      jitter?: number
      roundTripTime?: number
    }
  }
  
  export function SignalWire(options: SignalWireOptions): Promise<SignalWireClient>
}
