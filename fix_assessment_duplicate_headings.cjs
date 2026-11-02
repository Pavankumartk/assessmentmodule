#!/usr/bin/env node
/*
 * Conservative JSX heading cleanup for the assessment creator UI.
 * Removes an outside duplicate heading ONLY where its next sibling is a
 * single toggle row already containing that same label, and has NO dropdown.
 * Leaves the inner label and switch unchanged. Everything else is untouched.
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : ".");
const flags = new Set(process.argv.slice(2).filter(a => a.startsWith("--")));
const apply = flags.has("--apply");
const verify = flags.has("--verify");
if (flags.has("--help")) {
  console.log("Usage: node fix_assessment_duplicate_headings.cjs [project-root] --check|--apply|--verify\n" +
    "--check (default): list safe matches and preview only\n--apply: back up and remove confirmed duplicate outer headings\n--verify: report any matches remaining");
  process.exit(0);
}
let ts;
try { ts = require(require.resolve("typescript", {paths:[root, process.cwd(), __dirname]})); }
catch { console.error("TypeScript not found. Run npm install in the Next.js project first."); process.exit(2); }
const candidates = [];
const skipped = [];
const changed = [];
const scanRoots = [path.join(root,"src","modules","assessments"),path.join(root,"src","app")];
const OMIT = new Set(["node_modules",".next","dist","out","coverage",".git"]);
const appScope = /(?:^|\/)(?:assessments?|mcq|one[-_]?word|short[-_]?answers?|long[-_]?answers?|fill[-_]?blanks?|true[-_]?false|drag[-_]?drop|memory[-_]?game|match|image|assignment|problem[-_]?solving|connect[-_]?dot|clickable[-_]?hotspot|sequenc|sorting)(?:\/|[-_.])/i;
const tagName = n => n?.tagName?.getText?.() || n?.openingElement?.tagName?.getText?.() || "";
const attrsOf = n => n?.openingElement?.attributes?.properties || n?.attributes?.properties || [];
function attr(n,key) {
  for (const prop of attrsOf(n)) {
    if (prop.name?.getText?.() !== key) continue;
    const init = prop.initializer;
    if (!init) return "";
    if (ts.isStringLiteral(init)) return init.text;
    if (ts.isJsxExpression(init) && init.expression && ts.isStringLiteral(init.expression)) return init.expression.text;
    return init.getText();
  }
  return "";
}
const normal = s => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ");
function staticText(n) {
  if (ts.isJsxText(n)) return n.getText();
  if (ts.isJsxExpression(n)) {
    if (n.expression && ts.isStringLiteral(n.expression)) return n.expression.text;
    return null;
  }
  if (ts.isJsxElement(n)) {
    if (/^(button|input|select|textarea|a)$/i.test(tagName(n))) return null;
    let value="";
    for (const child of n.children) {
      const v=staticText(child);
      if (v===null) return null;
      value+=v+" ";
    }
    return value;
  }
  return null;
}
function isHeading(n) {
  if (!ts.isJsxElement(n)) return false;
  if (attrsOf(n).some(p => /^(?:on\w+|htmlFor|aria-controls|aria-expanded)$/i.test(p.name?.getText?.()||""))) return false;
  const tag=tagName(n).toLowerCase();
  const classes=attr(n,"className");
  const headingTag=/^(h[1-6]|label|p|strong)$/.test(tag);
  const headingClass=/\b(?:heading|title|label|caption|field-name|setting-name|subheading)\b/i.test(classes);
  if (!headingTag && !(headingClass && /^(div|span)$/.test(tag))) return false;
  const txt=staticText(n);
  if (!txt || !normal(txt) || normal(txt).length > 95 || normal(txt).split(" ").length < 2) return false;
  return true;
}
function nodeDetails(n) {
  let switches=0, explicitSwitches=0, dropdowns=0, otherControls=0, labels=[];
  function visit(item,depth) {
    if (!item || depth>12) return;
    if (ts.isJsxElement(item) || ts.isJsxSelfClosingElement(item)) {
      const tag=tagName(item).toLowerCase();
      const classes=attr(item,"className");
      const role=attr(item,"role");
      const inputType=attr(item,"type");
      const props=attrsOf(item);
      const hasSwitchName=/(?:^|\.)\w*(toggle|switch)\w*$/i.test(tag);
      const hasSwitchClass=/(?:^|\s|[-_])(?:toggle|switch)(?:[-_]|\s|$)/i.test(classes);
      const switchRole=role.replace(/['"{}]/g,"").trim()==="switch";
      const checkedAttr=props.some(p => /^(checked|aria-checked)$/i.test(p.name?.getText?.()||""));
      const isExplicitToggle=hasSwitchName || switchRole || (tag==="input" && (/checkbox/i.test(inputType)||checkedAttr));
      const isToggle=isExplicitToggle || hasSwitchClass;
      const isDrop=/(?:^|\.)(?:\w*dropdown\w*|\w*select\w*|combobox)$/i.test(tag) || tag==="select" || /\b(?:select|dropdown|combobox)\b/i.test(classes) || /combobox|listbox/i.test(role) || props.some(p=>/^(aria-haspopup|aria-expanded)$/i.test(p.name?.getText?.()||""));
      if (isDrop) dropdowns++;
      if (isToggle) switches++;
      if (isExplicitToggle) explicitSwitches++;
      if (/^(input|textarea|button|select)$/.test(tag) && !isToggle && !isDrop) otherControls++;
      for (const key of ["label","title","text"]) {
        const value=attr(item,key);
        if (/^[\p{L}\p{N}][\p{L}\p{N}\s,'’()\-./]{1,100}$/u.test(value)) labels.push(value);
      }
      if (ts.isJsxElement(item)) {
        const pure=staticText(item);
        if (pure && normal(pure).length<=100 && normal(pure).split(" ").length>=2) labels.push(pure);
        for (const child of item.children) if (ts.isJsxElement(child)||ts.isJsxSelfClosingElement(child)||ts.isJsxFragment(child)) visit(child,depth+1);
      }
      return;
    }
    if (ts.isJsxFragment(item)) for(const child of item.children) visit(child,depth+1);
  }
  visit(n,0);
  return {switches,explicitSwitches,dropdowns,otherControls,labels};
}
function matches(outside,inside) {
  const o=normal(outside),i=normal(inside);
  if (!o||!i||o.split(" ").length<2||i.split(" ").length<2) return false;
  if (o===i) return true;
  // Screenshot's 'Notify learners when published' versus 'Notify Learners'.
  // Only a short descriptive tail on the OUTSIDE label is allowed.
  if(o.startsWith(i+" ") && (o.split(" ").length-i.split(" ").length)<=3) return true;
  return false;
}
function inspect(src, file) {
  const source=ts.createSourceFile(file,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  if(source.parseDiagnostics?.length) {skipped.push(`${path.relative(root,file)}: syntax errors: skipped`);return []}
  const edits=[];
  function walk(n) {
    if(ts.isJsxElement(n)||ts.isJsxFragment(n)) {
      const children=n.children||[];
      const nodes=children.filter(child=>ts.isJsxElement(child)||ts.isJsxSelfClosingElement(child)||ts.isJsxFragment(child));
      for (let j=0;j<nodes.length-1;j++) {
        const head=nodes[j], box=nodes[j+1];
        if(!isHeading(head))continue;
        const title=staticText(head)?.trim().replace(/\s+/g," ");
        const detail=nodeDetails(box);
        if(detail.dropdowns||detail.otherControls||detail.switches===0||detail.explicitSwitches>1) continue;
        // Several CSS layers may make up one physical neumorphic switch.
        if(detail.explicitSwitches===0 && detail.switches>5) continue;
        const inner=detail.labels.find(label=>matches(title,label));
        if(!inner)continue;
        const hEnd=head.getEnd();
        const bStart=box.getStart(source);
        if(src.slice(hEnd,bStart).replace(/\{\/\*[\s\S]*?\*\/\}/g,"").trim())continue;
        // Avoid removing a heading with conditional, list content, or JSX events.
        const start=head.getStart(source), end=head.getEnd();
        const lineStart=src.lastIndexOf("\n",start-1)+1;
        const nextNewline=src.indexOf("\n",end);
        const soleLine=src.slice(lineStart,start).trim()==="" && (nextNewline===-1||src.slice(end,nextNewline).trim()==="");
        const a=soleLine ? lineStart : start;
        const b=soleLine ? (nextNewline===-1 ? end : nextNewline+1) : end;
        const line=source.getLineAndCharacterOfPosition(start).line+1;
        edits.push({start:a,end:b,line,outer:title,inner:inner.trim().replace(/\s+/g," ")});
      }
    }
    ts.forEachChild(n,walk);
  }
  walk(source);
  return edits.filter((e,index,arr)=>arr.findIndex(x=>x.start===e.start)===index);
}
function collect(dir,fromApp=false) {
  if(!fs.existsSync(dir))return;
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})) {
    if(ent.isSymbolicLink()||OMIT.has(ent.name))continue;
    const file=path.join(dir,ent.name);
    if(ent.isDirectory()) collect(file,fromApp);
    else if(ent.isFile() && /\.tsx$/.test(ent.name)) {
      if(fromApp && !appScope.test(path.relative(path.join(root,"src","app"),file).replaceAll(path.sep,"/")))continue;
      let src;try{src=fs.readFileSync(file,"utf8")}catch{continue}
      if(!/toggle|switch|checked|aria-checked/i.test(src))continue;
      const edits=inspect(src,file);
      if(edits.length)candidates.push({file,src,edits});
    }
  }
}
collect(scanRoots[0]); collect(scanRoots[1],true);
const count=candidates.reduce((sum,item)=>sum+item.edits.length,0);
console.log(`Assessment JSX files with eligible duplicate toggle headings: ${candidates.length}; headings: ${count}`);
for(const {file,edits} of candidates) for(const e of edits) console.log(`  ${path.relative(root,file)}:${e.line}\n    remove OUTSIDE: ${JSON.stringify(e.outer)}\n    keep INSIDE:    ${JSON.stringify(e.inner)} + toggle`);
if(skipped.length) {console.log("Skipped files:"); skipped.forEach(x=>console.log("  "+x));}
if (apply && count) {
  const base=path.resolve(root,"..",`assessment-heading-backups-${new Date().toISOString().replace(/[:.]/g,"-")}`);
  for(const {file,src,edits} of candidates) {
    const backup=path.join(base,path.relative(root,file));
    fs.mkdirSync(path.dirname(backup),{recursive:true});fs.writeFileSync(backup,src);
    let next=src;
    for(const edit of edits.sort((a,b)=>b.start-a.start)) next=next.slice(0,edit.start)+next.slice(edit.end);
    const ast=ts.createSourceFile(file,next,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    if(ast.parseDiagnostics?.length) {console.error(`Safety stop: transformed ${file} would not parse`);process.exitCode=2;continue;}
    fs.writeFileSync(file,next);changed.push(file);
  }
  console.log(`Updated ${changed.length} files. Original files backed up at: ${base}`);
} else if(!apply) {
  console.log(verify ? (count===0 ? "VERIFY PASSED: no safe duplicate headings remain." : "VERIFY: run --apply to remove remaining safe duplicates.") : "CHECK ONLY: no files modified. Use --apply to remove listed headings.");
} else console.log("No matching headings found; no changes made.");
console.log("Note: Ambiguous or differently structured duplicate labels are intentionally NOT removed.");
