import { describe, it, expect } from 'vitest';
import { decodeCwdFromDir } from './decodeCwdFromDir';

describe('decodeCwdFromDir', () => {
  it('reconstructs an absolute path from the encoded folder name', () => {
    expect(decodeCwdFromDir('-Users-marcelo-foo')).toBe('/Users/marcelo/foo');
  });

  it('handles a name without a leading dash', () => {
    expect(decodeCwdFromDir('Users-x')).toBe('/Users/x');
  });
});
