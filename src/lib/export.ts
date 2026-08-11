import type { Problem } from "../types";

/** Quote a CSV field per RFC 4180 (double internal quotes, wrap in quotes). */
function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function problemsToCsv(problems: Problem[]): string {
  const header = [
    "Title",
    "URL",
    "Module",
    "Difficulty",
    "Confidence",
    "Status",
    "Pattern",
    "Intuition",
    "Time Complexity",
    "Space Complexity",
    "Last Solved",
    "Next Review",
    "Re-solve Count",
  ];
  const rows = problems.map((p) =>
    [
      csvField(p.title),
      csvField(p.url),
      csvField(p.module),
      p.difficulty,
      p.confidence,
      p.status,
      csvField(p.pattern),
      csvField(p.intuition),
      csvField(p.timeComplexity),
      csvField(p.spaceComplexity),
      p.lastSolved,
      p.nextReview,
      String(p.reviewCount),
    ].join(","),
  );
  return [header.map(csvField).join(","), ...rows].join("\r\n");
}

/** Trigger a client-side download of a text blob. */
export function downloadText(
  filename: string,
  text: string,
  mime = "text/csv",
): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
