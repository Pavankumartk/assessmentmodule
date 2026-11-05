/** Read the creator's plain-text or rich-text instructions without rendering HTML. */
export function creatorInstructionLines(...values: unknown[]): string[] {
  for (const value of values) {
    const parts = Array.isArray(value) ? value : [value];
    const lines = parts.flatMap(part => {
      if (typeof part !== "string") return [];
      const separated = part.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, "\n");
      let text = separated.replace(/<\/?[a-z][^>]*>/gi, " ");
      if (typeof document !== "undefined") {
        const element = document.createElement("textarea");
        element.innerHTML = text;
        text = element.value;
      } else {
        text = text.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
      }
      return text.split(/\r?\n/).map(line => line.replace(/\s+/g, " ").trim()).filter(Boolean);
    });
    if (lines.length) return lines;
  }
  return [];
}
