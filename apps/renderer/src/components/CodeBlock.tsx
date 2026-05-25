import { useEffect, useState } from 'react';
import { highlightCode } from '../lib/markdown';

export interface CodeBlockProps {
  readonly code: string;
  readonly lang: string;
}

export function CodeBlock({ code, lang }: CodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    highlightCode(code, lang)
      .then((result) => {
        if (active) setHtml(result);
      })
      .catch(() => {
        /* keep the plain-text fallback */
      });
    return () => {
      active = false;
    };
  }, [code, lang]);

  if (html) {
    // Shiki escapes the code it renders, so this HTML is safe to inject.
    return (
      <div
        className="overflow-x-auto rounded-lg text-sm [&_pre]:p-3"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 text-sm text-zinc-300">
      <code>{code}</code>
    </pre>
  );
}
