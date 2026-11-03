import { defineConfig } from 'vitest/config';

// The upstream suite was written for euro accounts; V Media CRM's own default (INR) is covered by tests/currency.test.ts.
export default defineConfig({ test: { include: ['tests/**/*.test.ts'], testTimeout: 20000, env: { PGHL_CURRENCY: 'EUR' } } });
