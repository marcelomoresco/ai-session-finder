import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { redactSecrets } from './redactSecrets';

const alnum = fc
  .array(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')),
    { minLength: 24, maxLength: 40 },
  )
  .map((chars) => chars.join(''));

describe('redactSecrets — concrete patterns', () => {
  const cases: ReadonlyArray<readonly [string, string, string]> = [
    ['OpenAI key', `sk-${'a'.repeat(40)}`, '[REDACTED_API_KEY]'],
    ['Anthropic key', `sk-ant-${'A1b2'.repeat(8)}`, '[REDACTED_API_KEY]'],
    ['Google key', `AIza${'B'.repeat(35)}`, '[REDACTED_API_KEY]'],
    ['GitHub token', `ghp_${'a'.repeat(36)}`, '[REDACTED_TOKEN]'],
    ['Slack token', `xoxb-${'1'.repeat(20)}`, '[REDACTED_TOKEN]'],
    ['AWS key', `AKIA${'ABCD1234EFGH5678'}`, '[REDACTED_AWS_KEY]'],
    ['JWT', `eyJhbGciOi.eyJzdWIiOi.${'s'.repeat(20)}`, '[REDACTED_JWT]'],
  ];

  it.each(cases)('redacts a %s', (_label, secret, placeholder) => {
    const out = redactSecrets(`before ${secret} after`);
    expect(out).toContain(placeholder);
    expect(out).not.toContain(secret);
  });

  it('redacts credentials embedded in a URL but keeps the scheme/host', () => {
    const out = redactSecrets('clone https://user:s3cr3tpass@github.com/acme/repo.git');
    expect(out).not.toContain('s3cr3tpass');
    expect(out).toContain('https://[REDACTED]:[REDACTED]@github.com/acme/repo.git');
  });

  it('redacts a PEM private key block', () => {
    const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIxyz\n-----END RSA PRIVATE KEY-----';
    expect(redactSecrets(`key: ${pem}`)).toContain('[REDACTED_PRIVATE_KEY]');
  });

  it('does NOT redact ordinary text, emails, or filesystem paths (kept searchable)', () => {
    const text = 'See /Users/marcelo/dev and email me at marcelo@example.com about commit abc123.';
    expect(redactSecrets(text)).toBe(text);
  });

  it('does NOT redact a too-short sk- string', () => {
    expect(redactSecrets('sk-short')).toBe('sk-short');
  });
});

describe('redactSecrets — properties (generated)', () => {
  it('always removes an OpenAI key from arbitrary prose', () => {
    fc.assert(
      fc.property(fc.lorem({ maxCount: 12 }), fc.lorem({ maxCount: 12 }), alnum, (pre, post, body) => {
        const secret = `sk-${body}`;
        const out = redactSecrets(`${pre} ${secret} ${post}`);
        expect(out).not.toContain(secret);
        expect(out).toContain('[REDACTED_API_KEY]');
      }),
      { numRuns: 100 },
    );
  });

  it('leaves ordinary prose untouched', () => {
    fc.assert(
      fc.property(fc.lorem({ maxCount: 40 }), (text) => {
        expect(redactSecrets(text)).toBe(text);
      }),
      { numRuns: 100 },
    );
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(fc.lorem({ maxCount: 12 }), alnum, (noise, body) => {
        const once = redactSecrets(`${noise} ghp_${body}${'x'.repeat(36)}`);
        expect(redactSecrets(once)).toBe(once);
      }),
      { numRuns: 100 },
    );
  });
});
