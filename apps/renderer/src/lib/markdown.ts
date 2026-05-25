import { codeToHtml } from 'shiki';

export interface ContentSegment {
  readonly type: 'text' | 'code';
  readonly value: string;
  readonly lang?: string;
}

const FENCE = /```(\w*)\n?([\s\S]*?)```/g;

/**
 * Splits turn content into prose and fenced code segments. Prose is rendered as
 * safe preformatted text; only code is highlighted — so arbitrary session
 * content is never injected as HTML.
 */
export function parseContent(text: string): ReadonlyArray<ContentSegment> {
  const segments: ContentSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  FENCE.lastIndex = 0;
  while ((match = FENCE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'code', value: match[2] ?? '', lang: match[1] || 'text' });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return segments;
}

const SUPPORTED_LANGS = new Set([
  'typescript', 'javascript', 'tsx', 'jsx', 'python', 'rust', 'go',
  'bash', 'shell', 'sql', 'json', 'html', 'css', 'yaml', 'markdown',
]);

/** Highlights a code block with Shiki (escapes its output → safe HTML). */
export function highlightCode(code: string, lang: string, theme: 'light' | 'dark' = 'dark'): Promise<string> {
  const language = SUPPORTED_LANGS.has(lang) ? lang : 'text';
  return codeToHtml(code, { lang: language, theme: theme === 'light' ? 'github-light' : 'github-dark' });
}
