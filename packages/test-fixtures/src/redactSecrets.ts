interface RedactionRule {
  readonly pattern: RegExp;
  readonly replacement: string;
}

// Order matters: more specific / structural patterns run before generic ones.
const RULES: ReadonlyArray<RedactionRule> = [
  {
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replacement: '[REDACTED_PRIVATE_KEY]',
  },
  { pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, replacement: '[REDACTED_JWT]' },
  {
    pattern: /([a-z][a-z0-9+.-]*:\/\/)[^:@/\s]+:[^@/\s]+@/gi,
    replacement: '$1[REDACTED]:[REDACTED]@',
  },
  { pattern: /sk-(?:ant-)?[A-Za-z0-9_-]{20,}/g, replacement: '[REDACTED_API_KEY]' },
  { pattern: /AIza[A-Za-z0-9_-]{35}/g, replacement: '[REDACTED_API_KEY]' },
  { pattern: /gh[posru]_[A-Za-z0-9]{20,}/g, replacement: '[REDACTED_TOKEN]' },
  { pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/g, replacement: '[REDACTED_TOKEN]' },
  { pattern: /AKIA[0-9A-Z]{16}/g, replacement: '[REDACTED_AWS_KEY]' },
  { pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, replacement: '[REDACTED_EMAIL]' },
  { pattern: /(\/(?:Users|home)\/)[^/\s]+/g, replacement: '$1[USER]' },
];

/**
 * Replaces common secrets and PII with placeholders so real session data can be
 * committed as test fixtures. Run on real sessions BEFORE committing them.
 *
 * Covers: PEM private keys, JWTs, URL-embedded credentials, OpenAI/Anthropic
 * (`sk-`), Google (`AIza`), GitHub (`gh*_`), Slack (`xox*`) and AWS (`AKIA`)
 * keys, email addresses, and usernames in `/Users` and `/home` paths.
 *
 * Best-effort: review the output. It can miss bespoke secret formats and may
 * over-redact (e.g. any long `sk-` string). Tune the rules as new formats appear.
 */
export function redactSecrets(input: string): string {
  return RULES.reduce((text, rule) => text.replace(rule.pattern, rule.replacement), input);
}
