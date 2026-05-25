// Vite-style raw imports for .sql files (handled by electron-vite and Vitest).
declare module '*.sql?raw' {
  const content: string;
  export default content;
}
