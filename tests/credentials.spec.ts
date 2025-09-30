import { describe, expect, it } from 'vitest';
import { extractValidKey, normalizeAuthorization } from '../public/assets/js/credentials.js';

const PLACEHOLDER_SENTINEL = "__VITE" + "_BDL_KEY__";

describe('extractValidKey', () => {
  it('removes bearer prefix and rejects sentinel', () => {
    expect(extractValidKey(`Bearer token-123`)).toBe('token-123');
    expect(extractValidKey(`Bearer   token-123`)).toBe('token-123');
    expect(extractValidKey(`bearer TOKEN`)).toBe('TOKEN');
    expect(extractValidKey(PLACEHOLDER_SENTINEL)).toBeNull();
    expect(extractValidKey(`Bearer ${PLACEHOLDER_SENTINEL}`)).toBeNull();
  });
});

describe('normalizeAuthorization', () => {
  it('adds bearer prefix exactly once', () => {
    expect(normalizeAuthorization('token-456')).toBe('Bearer token-456');
    expect(normalizeAuthorization('Bearer token-456')).toBe('Bearer token-456');
    expect(normalizeAuthorization('bearer token-456')).toBe('bearer token-456');
  });
});
