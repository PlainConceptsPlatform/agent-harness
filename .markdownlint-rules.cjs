module.exports = {
  names: ["no-hard-wrapped-prose"],
  description: "Prose paragraphs should stay on a single line",
  tags: ["style", "prose"],
  function: (params, onError) => {
    for (const token of params.tokens) {
      if (token.type !== "paragraph_open" || !Array.isArray(token.map)) {
        continue;
      }

      const [firstLine, endLine] = token.map;
      if (params.lines[firstLine]?.trimStart().startsWith("<Mermaid")) {
        continue;
      }

      const lineCount = endLine - firstLine;
      if (lineCount > 1) {
        onError({
          lineNumber: firstLine + 1,
          detail: `Paragraph is wrapped across ${lineCount} lines. Keep it on one line instead of hard-wrapping at a fixed column width.`,
          context: (params.lines[firstLine] || "").slice(0, 80),
        });
      }
    }
  },
};
