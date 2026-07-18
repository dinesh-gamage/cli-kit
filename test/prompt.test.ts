import { describe, it, expect, beforeEach } from 'vitest';
import { input, password, confirm, select, multiselect } from '../src/prompt.js';
import { colorSupport } from '../src/ansi.js';
import { createMockReadStream, createMockWriteStream } from './helpers.js';

// Note: interactive raw-mode paths (arrow-key navigation, masked password
// echo, live re-painting) are only exercised by the demo script
// (examples/demo.ts), not by these unit tests — driving readline's
// keypress/raw-mode machinery deterministically in vitest is out of scope
// here. These tests cover the non-TTY fallback contract only.

describe('prompt (non-TTY)', () => {
  beforeEach(() => {
    colorSupport.enabled = false;
  });

  describe('input', () => {
    it('returns the default when provided', async () => {
      const io = { input: createMockReadStream(false), output: createMockWriteStream(false) };
      await expect(input('name?', { default: 'bob', ...io })).resolves.toBe('bob');
    });

    it('throws when no default is provided', async () => {
      const io = { input: createMockReadStream(false), output: createMockWriteStream(false) };
      await expect(input('name?', io)).rejects.toThrow(/Interactive prompt requires a TTY/);
    });
  });

  describe('password', () => {
    it('always throws, even with no default concept', async () => {
      const io = { input: createMockReadStream(false), output: createMockWriteStream(false) };
      await expect(password('secret?', io)).rejects.toThrow(/Interactive prompt requires a TTY/);
    });
  });

  describe('confirm', () => {
    it('returns the default when provided', async () => {
      const io = { input: createMockReadStream(false), output: createMockWriteStream(false) };
      await expect(confirm('sure?', { default: true, ...io })).resolves.toBe(true);
      await expect(confirm('sure?', { default: false, ...io })).resolves.toBe(false);
    });

    it('throws when no default is provided', async () => {
      const io = { input: createMockReadStream(false), output: createMockWriteStream(false) };
      await expect(confirm('sure?', io)).rejects.toThrow(/Interactive prompt requires a TTY/);
    });
  });

  describe('select', () => {
    it('returns the default when provided', async () => {
      const io = { input: createMockReadStream(false), output: createMockWriteStream(false) };
      await expect(
        select('pick one', ['a', 'b', 'c'], { default: 'b', ...io })
      ).resolves.toBe('b');
    });

    it('throws when no default is provided', async () => {
      const io = { input: createMockReadStream(false), output: createMockWriteStream(false) };
      await expect(select('pick one', ['a', 'b', 'c'], io)).rejects.toThrow(
        /Interactive prompt requires a TTY/
      );
    });
  });

  describe('multiselect', () => {
    it('returns the default array when provided', async () => {
      const io = { input: createMockReadStream(false), output: createMockWriteStream(false) };
      await expect(
        multiselect('pick some', ['a', 'b', 'c'], { default: ['a', 'c'], ...io })
      ).resolves.toEqual(['a', 'c']);
    });

    it('throws when no default is provided', async () => {
      const io = { input: createMockReadStream(false), output: createMockWriteStream(false) };
      await expect(multiselect('pick some', ['a', 'b', 'c'], io)).rejects.toThrow(
        /Interactive prompt requires a TTY/
      );
    });
  });
});
