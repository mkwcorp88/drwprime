import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(__dirname, '../../.env.local') });
config({ path: path.resolve(__dirname, '../../.env') });

// Ensure test environment
(process.env as Record<string, string>).NODE_ENV = 'test';

// Silence console during tests except for explicit debugging
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

if (process.env.VERBOSE_TESTS !== '1') {
  console.log = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].startsWith('[TEST')) {
      originalLog(...args);
    }
  };
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].startsWith('[TEST')) {
      originalError(...args);
    }
  };
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].startsWith('[TEST')) {
      originalWarn(...args);
    }
  };
}
