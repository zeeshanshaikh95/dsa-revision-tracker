import type { ReactNode } from "react";

function inline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    const key = `${keyBase}-${i++}`;
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold text-zinc-100">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("*")) {
      nodes.push(
        <em key={key} className="italic text-zinc-300">
          {token.slice(1, -1)}
        </em>,
      );
    } else {
      nodes.push(
        <code
          key={key}
          className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[0.85em] text-emerald-300"
        >
          {token.slice(1, -1)}
        </code>,
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Minimal markdown renderer — headings, lists, blockquotes, and inline styles. */
export function Markdown({ text }: { text: string }): ReactNode {
  if (!text.trim()) {
    return (
      <p className="text-sm italic text-zinc-600">
        No notes yet — capture your intuition in plain English.
      </p>
    );
  }

  const blocks: ReactNode[] = [];
  let listBuffer: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    blocks.push(
      <ul key={`ul-${key++}`} className="my-2 space-y-1.5">
        {listBuffer.map((item, idx) => (
          <li key={idx} className="flex gap-2 text-sm leading-relaxed">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600" />
            <span>{inline(item, `li-${idx}`)}</span>
          </li>
        ))}
      </ul>,
    );
    listBuffer = [];
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.trim() === "") {
      flushList();
      continue;
    }
    if (/^-\s+/.test(line)) {
      listBuffer.push(line.replace(/^-\s+/, ""));
      continue;
    }
    flushList();

    if (/^#{1,3}\s+/.test(line)) {
      const level = line.match(/^#+/)![0].length;
      const content = line.replace(/^#+\s+/, "");
      const cls =
        level === 1
          ? "text-sm font-semibold text-zinc-100"
          : "text-sm font-semibold text-zinc-200";
      blocks.push(
        <p key={`h-${key++}`} className={`${cls} mb-1 mt-3`}>
          {inline(content, `h-${key}`)}
        </p>,
      );
    } else if (/^>\s+/.test(line)) {
      blocks.push(
        <blockquote
          key={`q-${key++}`}
          className="my-2 rounded-r-md border-l-2 border-amber-500/60 bg-amber-500/5 py-1.5 pl-3 pr-2 text-sm text-amber-200/90"
        >
          {inline(line.replace(/^>\s+/, ""), `q-${key}`)}
        </blockquote>,
      );
    } else {
      blocks.push(
        <p key={`p-${key++}`} className="my-1.5 text-sm leading-relaxed">
          {inline(line, `p-${key}`)}
        </p>,
      );
    }
  }
  flushList();
  return <div className="space-y-1">{blocks}</div>;
}
