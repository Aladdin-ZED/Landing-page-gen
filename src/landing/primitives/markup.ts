/**
 * Parser for the tiny copy markup used in every text field (docs/SECTIONS.md):
 *   *emphasis*   **strong**   ***both***   \* (literal asterisk)
 * Block mode adds: blank line → new paragraph, single line break → <br>, "- " / "• " lines → bullet list.
 *
 * The output is a plain data tree; RichText turns it into React elements. Text is never
 * interpreted as HTML — React escapes every string — so there is no injection surface.
 *
 * Algorithm (CommonMark "delimiter run" rules, simplified to `*` only): the text is tokenized into
 * literal runs, line breaks and asterisk runs; a run can open when the next character is not
 * whitespace and close when the previous one is not. Closers are matched against a stack of open
 * runs (two asterisks at a time when both sides have two, else one). Every token is visited once
 * and every match pops or shrinks a stack entry, so parsing is linear in the input length — no
 * backtracking, whatever the shopper-facing copy contains. A blank line ends every open run.
 */

export type InlineNode =
  | string
  | { t: "em"; c: InlineNode[] }
  | { t: "strong"; c: InlineNode[] }
  | { t: "br" };

export type BlockNode = { t: "p"; c: InlineNode[] } | { t: "ul"; items: InlineNode[][] };

/** Deeper emphasis/strong nesting is flattened (the text stays, the extra wrappers go). */
const MAX_DEPTH = 4;

const normalize = (s: string) => s.replace(/\r\n?/g, "\n");
const isWs = (c: string | undefined) => c === undefined || /\s/.test(c);

interface Match {
  strong: boolean;
}

interface Run {
  k: "run";
  /** asterisks still unmatched */
  rem: number;
  canOpen: boolean;
  canClose: boolean;
  /** matches where this run closes, innermost first */
  closes: Match[];
  /** matches where this run opens, innermost first */
  opens: Match[];
}

type Token = { k: "text"; v: string } | { k: "br" } | Run;

function tokenize(s: string): Token[] {
  const out: Token[] = [];
  let buf = "";
  const flush = () => {
    if (buf) out.push({ k: "text", v: buf });
    buf = "";
  };
  let i = 0;
  while (i < s.length) {
    const ch = s[i]!;
    if (ch === "\\" && (s[i + 1] === "*" || s[i + 1] === "\\")) {
      buf += s[i + 1];
      i += 2;
      continue;
    }
    if (ch === "\n") {
      flush();
      out.push({ k: "br" });
      i++;
      continue;
    }
    if (ch === "*") {
      let n = 1;
      while (s[i + n] === "*") n++;
      flush();
      out.push({ k: "run", rem: n, canOpen: !isWs(s[i + n]), canClose: !isWs(s[i - 1]), closes: [], opens: [] });
      i += n;
      continue;
    }
    buf += ch;
    i++;
  }
  flush();
  return out;
}

/** Pair closers with openers (stack discipline keeps every match properly nested). */
function matchRuns(tokens: Token[]): void {
  const stack: Run[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    if (tok.k === "br") {
      // a blank line (two consecutive breaks) is a hard boundary for emphasis
      if (tokens[i - 1]?.k === "br") stack.length = 0;
      continue;
    }
    if (tok.k !== "run") continue;
    if (tok.canClose) {
      while (tok.rem > 0 && stack.length) {
        const opener = stack[stack.length - 1]!;
        const n = opener.rem >= 2 && tok.rem >= 2 ? 2 : 1;
        const m: Match = { strong: n === 2 };
        opener.opens.push(m);
        tok.closes.push(m);
        opener.rem -= n;
        tok.rem -= n;
        if (opener.rem === 0) stack.pop();
      }
    }
    if (tok.canOpen && tok.rem > 0) stack.push(tok);
  }
}

interface Frame {
  m: Match | null;
  c: InlineNode[];
}

function pushText(out: InlineNode[], s: string) {
  if (!s) return;
  const last = out[out.length - 1];
  if (typeof last === "string") out[out.length - 1] = last + s;
  else out.push(s);
}

function append(out: InlineNode[], nodes: readonly InlineNode[]) {
  for (const n of nodes) {
    if (typeof n === "string") pushText(out, n);
    else out.push(n);
  }
}

/** Parse inline markup. Single newlines become `{t:"br"}`. */
export function parseInline(src: string): InlineNode[] {
  const tokens = tokenize(normalize(src));
  matchRuns(tokens);

  const frames: Frame[] = [{ m: null, c: [] }];
  const top = () => frames[frames.length - 1]!;
  const closeFrame = () => {
    const f = frames.pop()!;
    const parent = top();
    // frames.length is now the depth of the closed wrapper (1 = outermost)
    if (frames.length > MAX_DEPTH) append(parent.c, f.c);
    else parent.c.push({ t: f.m!.strong ? "strong" : "em", c: f.c });
  };

  for (const tok of tokens) {
    if (tok.k === "text") pushText(top().c, tok.v);
    else if (tok.k === "br") top().c.push({ t: "br" });
    else {
      for (const m of tok.closes) {
        // matches are nested by construction; the guard only protects against a broken invariant
        if (!frames.some((f) => f.m === m)) continue;
        while (top().m !== m) closeFrame();
        closeFrame();
      }
      pushText(top().c, "*".repeat(tok.rem));
      for (let j = tok.opens.length - 1; j >= 0; j--) frames.push({ m: tok.opens[j]!, c: [] });
    }
  }
  // every recorded opener has a closer, so only the root frame is left
  while (frames.length > 1) closeFrame();
  return frames[0]!.c;
}

const BULLET = /^\s*[-•]\s+(.*)$/;

/** Parse block markup into paragraphs and bullet lists. */
export function parseBlocks(src: string): BlockNode[] {
  const text = normalize(src).trim();
  if (!text) return [];
  const blocks: BlockNode[] = [];
  for (const para of text.split(/\n[ \t]*\n+/)) {
    let lines: string[] = [];
    let items: string[] | null = null;
    const flushP = () => {
      if (lines.length) blocks.push({ t: "p", c: parseInline(lines.join("\n")) });
      lines = [];
    };
    const flushL = () => {
      if (items && items.length) blocks.push({ t: "ul", items: items.map((it) => parseInline(it)) });
      items = null;
    };
    for (const raw of para.split("\n")) {
      const m = BULLET.exec(raw);
      if (m && m[1]!.trim()) {
        flushP();
        (items ??= []).push(m[1]!.trim());
      } else if (items && /^\s{2,}\S/.test(raw)) {
        // indented continuation of the previous bullet
        items[items.length - 1] += " " + raw.trim();
      } else {
        flushL();
        if (raw.trim()) lines.push(raw.trim());
      }
    }
    flushP();
    flushL();
  }
  return blocks;
}

/** Concatenated visible text of inline nodes (breaks → spaces). */
export function inlineText(nodes: readonly InlineNode[]): string {
  let s = "";
  for (const n of nodes) {
    if (typeof n === "string") s += n;
    else if (n.t === "br") s += " ";
    else s += inlineText(n.c);
  }
  return s;
}

/** Strip the markup from a copy string (for alt text, aria-labels, meta descriptions). */
export function plainText(src: string | null | undefined): string {
  if (!src) return "";
  return parseBlocks(src)
    .map((b) => (b.t === "p" ? inlineText(b.c) : b.items.map(inlineText).join(" · ")))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
