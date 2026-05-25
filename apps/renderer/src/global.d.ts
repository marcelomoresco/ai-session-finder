export {};

declare global {
  interface Window {
    /** Typed tRPC bridge injected by the preload script. */
    readonly trpc: {
      invoke(path: string, type: 'query' | 'mutation', input: unknown): Promise<unknown>;
    };
    readonly asf?: { readonly electronVersion: string };
  }
}
