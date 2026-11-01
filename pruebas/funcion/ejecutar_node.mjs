// Ejecutar los mismos casos del manejador sin instalar Deno (Node 24+).
import test from 'node:test';
globalThis.Deno = { test };
await import('./manejador_test.ts');
