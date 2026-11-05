/** Apply a font to the selection, or to the existing editor text when only a caret is present. */
export function applyAssessmentFont(editor: HTMLElement | null, family: string): void {
  if (!editor || !family || typeof window === "undefined") return;
  editor.focus();
  const selection = window.getSelection();
  if (!selection) return;
  if (!selection.rangeCount || !editor.contains(selection.anchorNode) || !editor.contains(selection.focusNode)) {
    const end = document.createRange();
    end.selectNodeContents(editor);
    end.collapse(false);
    selection.removeAllRanges();
    selection.addRange(end);
  }
  if (!selection.isCollapsed || !(editor.textContent || "").length) {
    document.execCommand("fontName", false, family);
    return;
  }
  const current = selection.getRangeAt(0);
  let offset = 0;
  try {
    const prefix = document.createRange();
    prefix.selectNodeContents(editor);
    prefix.setEnd(current.startContainer, current.startOffset);
    offset = prefix.toString().length;
  } catch { offset = (editor.textContent || "").length; }
  const all = document.createRange();
  all.selectNodeContents(editor);
  selection.removeAllRanges();
  selection.addRange(all);
  document.execCommand("fontName", false, family);
  try {
    const caret = document.createRange();
    const walker = document.createTreeWalker(editor, 4);
    let text = walker.nextNode();
    let remaining = offset;
    while (text && remaining > (text.textContent || "").length) {
      remaining -= (text.textContent || "").length;
      text = walker.nextNode();
    }
    if (text) caret.setStart(text, Math.min(remaining, (text.textContent || "").length));
    else { caret.selectNodeContents(editor); caret.collapse(false); }
    caret.collapse(true);
    selection.removeAllRanges();
    selection.addRange(caret);
  } catch { /* Keep the browser's selection if the editor DOM changed. */ }
}
