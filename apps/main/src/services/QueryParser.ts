import { isTool, type Tool } from '@asf/domain';

export interface ParsedQuery {
  readonly text: string;
  readonly tools: ReadonlyArray<Tool>;
  readonly projectPath: string | null;
  readonly after: Date | null;
  readonly before: Date | null;
}

/**
 * Splits a raw search string into free text plus filter operators:
 * `tool:<tool>`, `project:<path>`, `>YYYY-MM-DD` (after), `<YYYY-MM-DD` (before).
 * Unknown tools and unparseable dates are ignored. Pure and stateless.
 */
export class QueryParser {
  parse(raw: string): ParsedQuery {
    const tools: Tool[] = [];
    let projectPath: string | null = null;
    let after: Date | null = null;
    let before: Date | null = null;
    const textTokens: string[] = [];

    for (const token of raw.split(/\s+/).filter(Boolean)) {
      if (token.startsWith('tool:')) {
        const value = token.slice(5);
        if (isTool(value)) tools.push(value);
      } else if (token.startsWith('project:')) {
        projectPath = token.slice(8);
      } else if (token.startsWith('>')) {
        const date = new Date(token.slice(1));
        if (!Number.isNaN(date.getTime())) after = date;
      } else if (token.startsWith('<')) {
        const date = new Date(token.slice(1));
        if (!Number.isNaN(date.getTime())) before = date;
      } else {
        textTokens.push(token);
      }
    }

    return { text: textTokens.join(' '), tools, projectPath, after, before };
  }
}
