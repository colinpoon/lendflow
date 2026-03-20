// Mock for 'server-only' package — allows server-only modules to be imported in vitest.
// The real package throws at import time in non-server environments.
export {};
