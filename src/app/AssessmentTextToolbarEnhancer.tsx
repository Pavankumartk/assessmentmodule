"use client";
import { applyAssessmentFont } from "@/modules/assessments/components/common/assessment-editor-font";

import { useEffect } from "react";
import "./assessment-text-tools.css";

/** Add missing rich-text actions without replacing assessment-specific editors. */
export default function AssessmentTextToolbarEnhancer() {
  useEffect(() => {
    const creatorPaths = /(?:\/assessments\/create(?:\/|$)|\/(?:mcq|mcqs|one_word|oneword|one-word|short_answers|short-answers|long_answers|long-answers|fill-in-the-blanks|fillblanks|fill_blanks|truefalse|true_false|true-false|match_the_following|match-the-following|drag-drop|dragdrop|drag_and_drop|memory-game|memory_game|image-matching|image_matching|image-labeling|image_labeling|image-sorting|image_sorting|image-sequence|image_sequence|problem-solving|problem_solving|assignment|practical-assessments|clickable-hotspot|clickable_hotspot|connect-the-dots|connect_the_dots)(?:\/|$))/;
    const excludedPaths = /(?:\/viewer(?:\/|$)|\/results?(?:\/|$)|\/review(?:\/|$)|\/calculator(?:\/|$)|\/scratch(?:\/|$)|\/formulasheet(?:\/|$)|\/preview(?:\/|$))/;
    const isCreatorPage = () => {
      const path = window.location.pathname.toLowerCase();
      return creatorPaths.test(path) && !excludedPaths.test(path);
    };

    // Remove the old, always-visible second row from the previous extension.
    document.querySelectorAll(".assessment-toolbar-extension").forEach(node => node.remove());
    document.querySelectorAll("[data-assessment-extra-tools-applied]").forEach(node => node.removeAttribute("data-assessment-extra-tools-applied"));
    document.querySelectorAll(".assessment-editor-has-extra-tools").forEach(node => node.classList.remove("assessment-editor-has-extra-tools"));

    type Mounted = { toolbar: HTMLElement | null; button: HTMLButtonElement; menu: HTMLDivElement; close: () => void; dispose: () => void };
    const mounted = new Map<HTMLElement, Mounted>();
    const selections = new WeakMap<HTMLElement, Range>();
    let stopped = false;
    let scheduled = false;
    const remember = (editor: HTMLElement) => {
      const sel = window.getSelection();
      if (sel?.rangeCount && editor.contains(sel.anchorNode)) selections.set(editor, sel.getRangeAt(0).cloneRange());
    };
    const restore = (editor: HTMLElement) => {
      editor.focus();
      const saved = selections.get(editor);
      if (!saved || !editor.contains(saved.commonAncestorContainer)) return;
      try { const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(saved.cloneRange()); } catch { /* DOM was refreshed */ }
    };
    const command = (editor: HTMLElement, name: string, value?: string) => {
      restore(editor);
      if (name === "fontName" && value) applyAssessmentFont(editor, value); else document.execCommand(name, false, name === "fontSize" ? "7" : value);
      if (name === "fontSize" && value) {
        editor.querySelectorAll('font[size="7"]').forEach(node => { node.removeAttribute("size"); (node as HTMLElement).style.fontSize = `${value}px`; });
      }
      remember(editor);
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const visibleText = (el: HTMLElement) => (el.textContent || "").trim().replace(/\s+/g, " ");
    const norm = (s: string) => s.toLowerCase().replace(/colour/g, "color").replace(/[^a-z0-9]+/g, " ").trim();
    /** Work from each native control, never the whole toolbar's combined text. */
    const existingKeys = (toolbar: HTMLElement | null): Set<string> => {
      const found = new Set<string>();
      if (!toolbar) return found;
      const elements = toolbar.querySelectorAll<HTMLElement>("button,select,input[type=color],[role=button],[role=combobox]");
      elements.forEach(el => {
        if (el.closest(".assessment-more-menu, .assessment-more-button")) return;
        const imageSources = [...el.querySelectorAll<HTMLImageElement>("img")].map(img => `${img.src} ${img.alt}`).join(" ");
        const meta = norm([el.getAttribute("aria-label"), el.getAttribute("title"), el.getAttribute("data-tooltip"), el.getAttribute("data-title"), el.getAttribute("name"), el.getAttribute("data-state"), el.className || "", imageSources, [...el.querySelectorAll("svg use")].map(n => n.getAttribute("href") || "").join(" ")].filter(Boolean).join(" "));
        const label = norm(visibleText(el));
        const options = el instanceof HTMLSelectElement ? norm([...el.options].slice(0, 25).map(o => o.textContent || "").join(" ")) : "";
        const full = `${meta} ${label}`;
        const has = (re: RegExp) => re.test(full);
        if (has(/\bundo\b|\bctrl z\b|\bbackward undo\b/)) found.add("undo");
        if (has(/\bredo\b|\bctrl y\b/)) found.add("redo");
        if (has(/\bbold\b/) || label === "b") found.add("bold");
        if (has(/\bitalic\b/) || label === "i") found.add("italic");
        if (has(/\bunderline\b/) || label === "u") found.add("underline");
        if (has(/\bstrike\s?through\b|\bstrike\b/) || label === "s") found.add("strike");
        if (has(/\bfont (family|name)\b|\bfontfamily\b/) || (el instanceof HTMLSelectElement && /\barial\b|\bsegoe\b|\bgeorgia\b|\bverdana\b/.test(options))) found.add("font");
        if (has(/\bfont size\b|\bfontsize\b/) || (el instanceof HTMLSelectElement && /^\s*\d+\s*$/.test(el.value) && /\b12\b/.test(options) && /\b16\b/.test(options))) found.add("size");
        if (has(/\bhighlight\b|\bmarker\b|\bbackground color\b/)) found.add("highlight");
        if (has(/\btext color\b|\bforecolor\b|\bfont color\b|\btext colour\b/) || label === "a" || (el instanceof HTMLInputElement && el.type === "color" && !has(/highlight|background/))) found.add("color");
        if (has(/\bunordered\b|\bbullet\b|\blist ul\b/) || label === "•") found.add("bullets");
        if (has(/\bordered\b|\bnumbered\b|\bnumber list\b|\bol list\b/) || label === "1" || label === "1.") found.add("numbered");
        if (has(/\boutdent\b|\bdecrease indent\b|\bindent decrease\b/)) found.add("outdent");
        if (has(/\bindent\b|\bincrease indent\b|\bindent increase\b/) && !found.has("outdent")) found.add("indent");
        if (has(/\balign left\b|\bjustifyleft\b|\btext left\b/)) found.add("left");
        if (has(/\balign center\b|\bjusti(fy)?center\b|\btext center\b/)) found.add("center");
        if (has(/\balign right\b|\bjustifyright\b|\btext right\b/)) found.add("right");
        if (has(/\bjustify\b|\bjustifyfull\b/)) found.add("justify");
        if (has(/\bheading\b|\bformat block\b/) || (el instanceof HTMLSelectElement && /\bheading\b|\bh1\b|\bh2\b/.test(options))) found.add("heading");
        if (has(/\bparagraph\b|\bnormal text\b/)) found.add("paragraph");
        if (has(/\binsert link\b|\bhyperlink\b|\blink\b/)) found.add("link");
        if (has(/\binsert image\b|\bimage upload\b|\bpicture\b/)) found.add("image");
        if (has(/\binsert table\b|\btable\b/)) found.add("table");
        if (has(/\bblockquote\b|\bquote block\b/)) found.add("quote");
        if (has(/\bcode block\b|\bcodeblock\b/)) found.add("code");
        if (has(/\bsuperscript\b|\bscript super\b/)) found.add("super");
        if (has(/\bsubscript\b|\bscript sub\b/)) found.add("sub");
        if (has(/\bclear formatting\b|\bremove format\b|\bremoveformat\b/)) found.add("clear");
        if (has(/\bspecial character\b|\binsert symbol\b|\bcharacter map\b/)) found.add("symbol");
      });
      return found;
    };
    const findToolbar = (editor: HTMLElement): HTMLElement | null => {
      let parent = editor.parentElement;
      for (let depth = 0; depth < 5 && parent; depth++, parent = parent.parentElement) {
        const direct = [...parent.children].find(node => node instanceof HTMLElement && !node.contains(editor) && (
          node.getAttribute("role") === "toolbar" || /\b(?:asgn-toolbar|mcqcRichToolbar|rich-toolbar|editor-toolbar|toolbar|richToolbar)\b/i.test(node.className)));
        if (direct instanceof HTMLElement) return direct;
        const candidates = [...parent.querySelectorAll<HTMLElement>('[role="toolbar"], [class*="toolbar"], [class*="Toolbar"]')];
        const match = candidates.find(node => !node.contains(editor) && !node.closest(".assessment-more-menu") && node.querySelector("button,select,[role=button]"));
        if (match) return match;
        if (parent.querySelectorAll('[contenteditable="true"], [contenteditable="plaintext-only"]').length > 1) break;
      }
      return null;
    };
    const attach = (editor: HTMLElement) => {
      const current = mounted.get(editor);
      if (current?.button.isConnected) return;
      if (current) { current.dispose(); mounted.delete(editor); }
      if (editor.closest(".assessment-more-menu,[aria-hidden=true],[hidden]") || editor.getAttribute("data-assessment-extra-tools") === "off") return;
      const toolbar = findToolbar(editor);
      // An editor with its own toolbar already has its intended controls.
      // Do not add another menu of duplicate formatting controls to it.
      if (toolbar?.matches('[role="toolbar"], [class*="toolbar"], [class*="Toolbar"]')) return;
      if (toolbar?.querySelector(".assessment-more-button")) return;
      const keys = existingKeys(toolbar);
      // Older icon-only toolbars may omit titles/ARIA labels. Avoid re-adding
      // their standard controls when the layout clearly contains that group.
      if (toolbar) {
        const nativeButtons = toolbar.querySelectorAll("button,[role=button]");
        const nativeSelects = toolbar.querySelectorAll("select,[role=combobox]");
        if (nativeButtons.length >= 7 && nativeSelects.length >= 2) {
          ["undo","redo","bold","italic","underline","font","size"].forEach(key => keys.add(key));
        }
      }
      const menu = document.createElement("div");
      menu.className = "assessment-more-menu";
      menu.id = `assessment-more-menu-${Math.random().toString(36).slice(2)}`;
      menu.setAttribute("role", "toolbar");
      menu.setAttribute("aria-label", "More text formatting tools");
      menu.hidden = true;
      const add = (key: string, label: string, text: string, fn: () => void) => {
        if (keys.has(key)) return;
        const b = document.createElement("button");
        b.type = "button"; b.className = "assessment-more-tool"; b.title = label; b.setAttribute("aria-label", label); b.textContent = text;
        b.addEventListener("pointerdown", ev => { ev.preventDefault(); remember(editor); });
        b.addEventListener("click", fn);
        menu.appendChild(b);
      };
      const choose = (key: string, label: string, values: [string, string][], initial: string, fn: (value: string) => void) => {
        if (keys.has(key)) return;
        const wrapper = document.createElement("label");
        wrapper.className = "assessment-more-field";
        wrapper.title = label;
        const sel = document.createElement("select");
        sel.className = "assessment-more-select"; sel.setAttribute("aria-label", label);
        values.forEach(([v, t]) => { const opt = document.createElement("option"); opt.value = v; opt.textContent = t; sel.appendChild(opt); });
        sel.value = initial;
        sel.addEventListener("pointerdown", () => remember(editor));
        sel.addEventListener("change", () => { if (sel.value) fn(sel.value); if (key === "heading" || key === "lists") sel.value = ""; });
        wrapper.appendChild(sel); menu.appendChild(wrapper);
      };
      const color = (key: string, label: string, initial: string, action: string) => {
        if (keys.has(key)) return;
        const wrapper = document.createElement("label");
        wrapper.className = "assessment-more-color"; wrapper.title = label;
        const span = document.createElement("span"); span.textContent = key === "color" ? "A" : "▰"; wrapper.appendChild(span);
        const input = document.createElement("input"); input.type = "color"; input.value = initial; input.setAttribute("aria-label", label);
        input.addEventListener("pointerdown", () => remember(editor));
        input.addEventListener("input", () => command(editor, action, input.value));
        wrapper.appendChild(input); menu.appendChild(wrapper);
      };
      add("undo", "Undo", "↶", () => command(editor, "undo"));
      add("redo", "Redo", "↷", () => command(editor, "redo"));
      choose("font", "Font family", [["Segoe UI","Segoe UI"],["Inter","Inter"],["Arial","Arial"],["Georgia","Georgia"],["Times New Roman","Times New Roman"],["Verdana","Verdana"]],"Segoe UI", v => command(editor,"fontName",v));
      choose("size", "Font size", ["12","14","16","18","20","24","28","32"].map(v => [v,v]),"16", v => command(editor,"fontSize",v));
      add("bold", "Bold", "B", () => command(editor, "bold"));
      add("italic", "Italic", "I", () => command(editor, "italic"));
      add("underline", "Underline", "U̲", () => command(editor, "underline"));
      add("strike", "Strikethrough", "S̶", () => command(editor, "strikeThrough"));
      color("color", "Text colour", "#2f3547", "foreColor");
      color("highlight", "Highlight colour", "#fff0a8", "hiliteColor");
      add("bullets", "Bulleted list", "• List", () => command(editor, "insertUnorderedList"));
      add("numbered", "Numbered list", "1. List", () => command(editor, "insertOrderedList"));
      add("outdent", "Outdent", "⇤", () => command(editor, "outdent"));
      add("indent", "Indent", "⇥", () => command(editor, "indent"));
      add("left", "Align left", "≡", () => command(editor, "justifyLeft"));
      add("center", "Align centre", "≡", () => command(editor, "justifyCenter"));
      add("right", "Align right", "≡", () => command(editor, "justifyRight"));
      add("justify", "Justify", "☷", () => command(editor, "justifyFull"));
      choose("heading", "Headings", [["","Headings"],["h1","Heading 1"],["h2","Heading 2"],["h3","Heading 3"],["h4","Heading 4"]], "", v => command(editor,"formatBlock",v));
      add("paragraph", "Paragraph", "¶", () => command(editor, "formatBlock", "p"));
      add("link", "Insert link", "🔗", () => {
        remember(editor);
        const url = window.prompt("Enter link URL (https://...):");
        if (!url) return;
        try { const parsed = new URL(url); if (!["https:","http:"].includes(parsed.protocol)) return; command(editor,"createLink",parsed.href); }
        catch { window.alert("Please enter a valid http or https URL."); }
      });
      if (!keys.has("image")) {
        const input = document.createElement("input"); input.type = "file"; input.accept = "image/*"; input.hidden = true;
        input.className = "assessment-more-hidden-file";
        input.addEventListener("change", () => {
          const file = input.files?.[0]; if (!file) return;
          if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) { window.alert("Choose an image smaller than 2 MB."); input.value = ""; return; }
          const reader = new FileReader();
          reader.onload = () => { if (typeof reader.result === "string") command(editor,"insertImage",reader.result); };
          reader.readAsDataURL(file); input.value = "";
        });
        add("image", "Insert image", "▧", () => { remember(editor); input.click(); });
        menu.appendChild(input);
      }
      add("table", "Insert table", "▦", () => {
        remember(editor);
        const answer = window.prompt("Table size (rows x columns)", "2x3");
        if (!answer) return;
        const match = /^\s*(\d{1,2})\s*[x×,]\s*(\d{1,2})\s*$/i.exec(answer);
        if (!match) { window.alert("Use a size such as 2x3."); return; }
        const rows = Math.min(12,Math.max(1,Number(match[1])));
        const cols = Math.min(10,Math.max(1,Number(match[2])));
        command(editor,"insertHTML",`<table border="1" style="border-collapse:collapse;width:100%"><tbody>${Array.from({length:rows},()=>`<tr>${"<td style=\"padding:8px\">&nbsp;</td>".repeat(cols)}</tr>`).join("")}</tbody></table><p><br></p>`);
      });
      add("quote", "Blockquote", "❝", () => command(editor,"formatBlock","blockquote"));
      add("code", "Code block", "{ }", () => command(editor,"formatBlock","pre"));
      add("super", "Superscript", "x²", () => command(editor,"superscript"));
      add("sub", "Subscript", "x₂", () => command(editor,"subscript"));
      add("clear", "Clear formatting", "Tx", () => command(editor,"removeFormat"));
      // Additional list style options are supplied only when not present in the original editor.
      if (!keys.has("bullets") && !keys.has("numbered")) choose("lists", "More list styles", [["","List styles"],["circle","◦ Circle"],["square","▪ Square"],["lower-alpha","a. Letters"],["upper-alpha","A. Letters"],["lower-roman","i. Roman"],["upper-roman","I. Roman"]],"", v => {
        restore(editor);
        const ordered = !["circle","square"].includes(v);
        const tag = ordered ? "OL" : "UL";
        command(editor, ordered ? "insertOrderedList" : "insertUnorderedList");
        let node: Node | null = window.getSelection()?.anchorNode || null;
        while (node && node !== editor) {
          if (node instanceof HTMLElement && node.tagName === tag) { node.style.listStyleType = v; break; }
          node = node.parentNode;
        }
        editor.dispatchEvent(new Event("input",{bubbles:true}));
      });
      if (!menu.children.length || [...menu.children].every(el => el instanceof HTMLInputElement)) return;
      const more = document.createElement("button");
      more.type = "button"; more.className = "assessment-more-button"; more.textContent = "⋯";
      more.setAttribute("aria-label", "More text editor tools"); more.title = "More text editor tools";
      more.setAttribute("aria-expanded", "false"); more.setAttribute("aria-controls", menu.id);
      // Put the small trigger in the existing toolbar, not an entire second toolbar.
      if (toolbar) {
        toolbar.classList.add("assessment-editor-toolbar-has-more");
        toolbar.appendChild(more);
      } else {
        const holder = document.createElement("div"); holder.className = "assessment-editor-single-more-holder";
        holder.appendChild(more); editor.insertAdjacentElement("beforebegin",holder);
      }
      document.body.appendChild(menu);
      const positionMenu = () => {
        const rect = more.getBoundingClientRect();
        const available = Math.max(240,window.innerWidth - 20);
        const width = Math.min(930,available);
        menu.style.width = `${width}px`;
        menu.style.left = `${Math.max(10,Math.min(rect.right - width,window.innerWidth - width - 10))}px`;
        const menuHeight = menu.offsetHeight || 52;
        menu.style.top = `${rect.bottom + 7 + menuHeight > window.innerHeight ? Math.max(8,rect.top - menuHeight - 7) : rect.bottom + 7}px`;
      };
      const close = () => { menu.hidden = true; more.setAttribute("aria-expanded", "false"); };
      const toggle = () => {
        const open = menu.hidden;
        document.querySelectorAll<HTMLElement>(".assessment-more-menu:not([hidden])").forEach(el => { if (el !== menu) el.dispatchEvent(new Event("assessment-close")); });
        menu.hidden = !open; more.setAttribute("aria-expanded", String(open));
        if (open) positionMenu();
      };
      const outside = (event: PointerEvent) => { if (!menu.hidden && !menu.contains(event.target as Node) && !more.contains(event.target as Node)) close(); };
      const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !menu.hidden) { close(); more.focus(); } };
      const move = () => { if (!menu.hidden) positionMenu(); };
      const onClose = () => close();
      more.addEventListener("pointerdown", ev => { ev.preventDefault(); remember(editor); });
      more.addEventListener("click", toggle);
      document.addEventListener("pointerdown", outside, true);
      document.addEventListener("keydown", escape);
      window.addEventListener("resize", move);
      window.addEventListener("scroll", move, true);
      menu.addEventListener("assessment-close", onClose);
      const dispose = () => {
        document.removeEventListener("pointerdown", outside, true);
        document.removeEventListener("keydown", escape);
        window.removeEventListener("resize", move);
        window.removeEventListener("scroll", move, true);
        menu.removeEventListener("assessment-close", onClose);
        const holder = more.closest(".assessment-editor-single-more-holder");
        more.remove(); if (holder) holder.remove(); menu.remove();
        toolbar?.classList.remove("assessment-editor-toolbar-has-more");
      };
      mounted.set(editor,{toolbar,button:more,menu,close,dispose});
      editor.setAttribute("data-assessment-extra-tools-applied", "true");
      editor.addEventListener("keyup", () => remember(editor));
      editor.addEventListener("mouseup", () => remember(editor));
    };
    const scan = () => {
      if (stopped) return;
      // Keep the enhancer mounted globally but only display controls on creator pages.
      // This also cleans up when Next.js navigates from a creator to a viewer route.
      if (!isCreatorPage()) {
        for (const [editor, current] of mounted) {
          current.dispose();
          editor.removeAttribute("data-assessment-extra-tools-applied");
        }
        mounted.clear();
        return;
      }
      for (const [editor, current] of mounted) {
        if (!editor.isConnected || !current.button.isConnected) { current.dispose(); mounted.delete(editor); editor.removeAttribute("data-assessment-extra-tools-applied"); }
      }
      document.querySelectorAll<HTMLElement>('[contenteditable="true"], [contenteditable="plaintext-only"]').forEach(attach);
    };
    let observedPath = window.location.pathname.toLowerCase();
    const observer = new MutationObserver(changes => {
      // App Router updates the path without necessarily firing popstate.
      // React route transitions update the DOM; observe those changes as well.
      const currentPath = window.location.pathname.toLowerCase();
      const pathChanged = observedPath !== currentPath;
      if (pathChanged) observedPath = currentPath;
      if (scheduled) return;
      if (!pathChanged && !changes.some(change => [...change.addedNodes,...change.removedNodes].some(node => node instanceof HTMLElement && (node.matches('[contenteditable],.assessment-more-button') || node.querySelector('[contenteditable],.assessment-more-button'))))) return;
      scheduled = true;
      queueMicrotask(() => { scheduled = false; scan(); });
    });
    // Back/forward may change routes before any DOM mutation is observed.
    const onPopState = () => { observedPath = window.location.pathname.toLowerCase(); scan(); };
    window.addEventListener("popstate", onPopState);
    scan();
    observer.observe(document.body,{subtree:true,childList:true});
    return () => { stopped = true; window.removeEventListener("popstate", onPopState); observer.disconnect(); for (const [editor, mountedItem] of mounted) { mountedItem.dispose(); editor.removeAttribute("data-assessment-extra-tools-applied"); } mounted.clear(); };
  }, []);
  return null;
}
