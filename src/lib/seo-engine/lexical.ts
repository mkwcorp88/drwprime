/**
 * Structured blocks -> Payload Lexical `editorState`.
 *
 * Payload stores rich text as a Lexical JSON tree, not HTML. The official
 * `convertHTMLToLexical` helper needs JSDOM (not a dependency here, and a heavy
 * one to add for a cron job), so the article generator emits a small typed block
 * list instead and this module maps it onto the exact node shapes Payload
 * already writes — verified against a live post from `/cms-api/posts`.
 *
 * `<RichText>` in `src/app/(frontend)/blog/[slug]/page.tsx` renders these
 * natively, so real `heading` nodes give us real <h2>/<h3> instead of the bold
 * paragraphs the older hand-written posts used.
 */

export type ArticleBlock =
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] };

type LexicalNode = Record<string, unknown>;

/** Bold is Lexical text format bit 1. */
const FORMAT_BOLD = 1;

function textNode(text: string, format = 0): LexicalNode {
  return {
    detail: 0,
    format,
    mode: 'normal',
    style: '',
    text,
    type: 'text',
    version: 1,
  };
}

/**
 * Splits `**bold**` spans into separate text nodes. Gemini reaches for markdown
 * emphasis even when told to emit plain text, so rendering it rather than
 * leaking literal asterisks into the page is the safer default.
 */
function inlineNodes(raw: string): LexicalNode[] {
  const text = String(raw ?? '');
  if (!text) return [textNode('')];

  const nodes: LexicalNode[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(textNode(text.slice(cursor, match.index)));
    nodes.push(textNode(match[1], FORMAT_BOLD));
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) nodes.push(textNode(text.slice(cursor)));

  return nodes.length ? nodes : [textNode(text)];
}

function paragraph(text: string): LexicalNode {
  return {
    children: inlineNodes(text),
    direction: null,
    format: '',
    indent: 0,
    type: 'paragraph',
    version: 1,
    textFormat: 0,
    textStyle: '',
  };
}

function heading(text: string, tag: 'h2' | 'h3'): LexicalNode {
  return {
    children: inlineNodes(text),
    direction: null,
    format: '',
    indent: 0,
    type: 'heading',
    version: 1,
    tag,
  };
}

function bulletList(items: string[]): LexicalNode {
  return {
    children: items.map((item, index) => ({
      children: inlineNodes(item),
      direction: null,
      format: '',
      indent: 0,
      type: 'listitem',
      version: 1,
      value: index + 1,
    })),
    direction: null,
    format: '',
    indent: 0,
    type: 'list',
    version: 1,
    listType: 'bullet',
    start: 1,
    tag: 'ul',
  };
}

/** Build the full `content` value for a Payload `richText` field. */
export function blocksToLexical(blocks: ArticleBlock[]): { root: LexicalNode } {
  const children: LexicalNode[] = [];

  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;

    if (block.type === 'ul') {
      const items = (block.items ?? []).map((item) => String(item).trim()).filter(Boolean);
      if (items.length) children.push(bulletList(items));
      continue;
    }

    const text = String(block.text ?? '').trim();
    if (!text) continue;

    if (block.type === 'h2') children.push(heading(text, 'h2'));
    else if (block.type === 'h3') children.push(heading(text, 'h3'));
    else children.push(paragraph(text));
  }

  // Payload rejects an empty richText tree on a required field.
  if (children.length === 0) children.push(paragraph(''));

  return {
    root: {
      children,
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  };
}

/** Plain-text projection of the blocks — used for word counts and excerpts. */
export function blocksToPlainText(blocks: ArticleBlock[]): string {
  return blocks
    .map((block) =>
      block.type === 'ul' ? (block.items ?? []).join(' ') : String(block.text ?? '')
    )
    .join(' ')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
