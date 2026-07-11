export {};

declare global {
  interface Body {
    // Browser/API responses are validated at each call site before use.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    json(): Promise<Record<string, any>>;
  }
}
