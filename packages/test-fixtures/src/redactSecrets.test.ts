import { describe, it, expect } from 'vitest';
import { redactSecrets } from './redactSecrets';

describe('redactSecrets', () => {
  it('leaves ordinary prose untouched', () => {
    const text = 'we fixed a race condition in the scheduler loop';
    expect(redactSecrets(text)).toBe(text);
  });

  it('redacts OpenAI-style sk- keys', () => {
    const out = redactSecrets('OPENAI_API_KEY=sk-abcDEF123456ghiJKL789mnoPQR012');
    expect(out).not.toContain('sk-abcDEF123456');
    expect(out).toContain('[REDACTED_API_KEY]');
  });

  it('redacts Anthropic sk-ant- keys', () => {
    const out = redactSecrets('key: sk-ant-api03-AbCdEf123456GhIjKl789MnOpQr');
    expect(out).not.toContain('sk-ant-api03');
    expect(out).toContain('[REDACTED_API_KEY]');
  });

  it('redacts GitHub tokens', () => {
    const out = redactSecrets('token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');
    expect(out).not.toContain('ghp_ABCDEFGH');
    expect(out).toContain('[REDACTED_TOKEN]');
  });

  it('redacts AWS access key ids', () => {
    expect(redactSecrets('AKIAIOSFODNN7EXAMPLE')).toBe('[REDACTED_AWS_KEY]');
  });

  it('redacts JWTs', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.dozjgNryP4J3jVmNHl0w5N';
    expect(redactSecrets(`auth ${jwt}`)).toContain('[REDACTED_JWT]');
    expect(redactSecrets(`auth ${jwt}`)).not.toContain('eyJzdWIi');
  });

  it('redacts PEM private key blocks', () => {
    const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIabc123\n-----END RSA PRIVATE KEY-----';
    const out = redactSecrets(`key:\n${pem}`);
    expect(out).toContain('[REDACTED_PRIVATE_KEY]');
    expect(out).not.toContain('MIIabc123');
  });

  it('redacts email addresses', () => {
    expect(redactSecrets('contact marcelo@example.com please')).toBe(
      'contact [REDACTED_EMAIL] please',
    );
  });

  it('redacts credentials embedded in URLs', () => {
    const out = redactSecrets('postgres://admin:s3cr3t@db.host:5432/app');
    expect(out).not.toContain('s3cr3t');
    expect(out).toContain('[REDACTED]');
  });

  it('redacts the username in macOS and Linux home paths', () => {
    expect(redactSecrets('/Users/marcelo/dev/proj')).toBe('/Users/[USER]/dev/proj');
    expect(redactSecrets('/home/marcelo/dev')).toBe('/home/[USER]/dev');
  });

  it('redacts multiple secrets in one string', () => {
    const out = redactSecrets('sk-abcDEF123456ghiJKL789mnoPQR012 and dev@corp.io at /Users/dev/x');
    expect(out).toContain('[REDACTED_API_KEY]');
    expect(out).toContain('[REDACTED_EMAIL]');
    expect(out).toContain('/Users/[USER]/x');
  });
});
