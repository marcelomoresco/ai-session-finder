interface RedactionRule {
  readonly pattern: RegExp;
  readonly replacement: string;
}

/**
 * Secret-only redaction applied by the Pipeline before turns are persisted.
 *
 * This is intentionally NARROWER than `@asf/test-fixtures`' redactSecrets: the
 * index is a *local* database the user searches, so emails, usernames and
 * filesystem paths are kept (people search by them). Only true credentials —
 * which must never land in the DB — are stripped.
 *
 * Order matters: structural patterns (PEM, JWT, URL creds) run before the
 * token/key patterns.
 */
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
];

/**
 * Replaces credentials (API keys, tokens, JWTs, PEM private keys, URL-embedded
 * passwords) with placeholders. Best-effort and idempotent: re-running over
 * already-redacted text is a no-op.
 */
export function redactSecrets(input: string): string {
  return RULES.reduce((text, rule) => text.replace(rule.pattern, rule.replacement), input);
}
