/* Remove exactly the Check Answer control from assessment viewer/preview TSX.
 * No changes to scoring, navigation, grading, state, answer validation or other controls.
 * Default --check lists matching files, --apply makes ONLY those JSX replacements.
 */
const fs=require('node:fs');
const path=require('node:path');
const root=process.cwd();
const apply=process.argv.includes('--apply');
let ts;
try { ts=require(path.join(root,'node_modules/typescript')); }
catch { console.error('STOPPED: TypeScript is required. Run npm install in the assessment project root.'); process.exit(1); }
const sourceRoots=[path.join(root,'src/app'),path.join(root,'src/modules/assessments')];
function collect(dir, out) {
  if(!fs.existsSync(dir)) return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(['node_modules','.next','.git'].includes(entry.name))continue;
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())collect(file,out);
    else if(/\.(tsx|jsx)$/.test(entry.name) && isViewer(file))out.push(file);
  }
}
function isViewer(file){
  const rel=path.relative(root,file).replaceAll(path.sep,'/');
  return /(?:^|\/)(?:viewer|viewers|preview|previews)(?:\/|\b)/i.test(rel)
    || /\/(?:[A-Za-z0-9_-]*Viewer|[A-Za-z0-9_-]*Preview)\.(tsx|jsx)$/i.test(rel)
    || /\/view[a-z0-9_-]+\/page\.(tsx|jsx)$/i.test(rel);
}
function attrValue(el,which){
  const attrs=ts.isJsxElement(el)?el.openingElement.attributes:el.attributes;
  const attr=attrs.properties.find(p=>ts.isJsxAttribute(p) && p.name.text===which);
  return attr && ts.isJsxAttribute(attr) && attr.initializer && ts.isStringLiteral(attr.initializer) ? attr.initializer.text : '';
}
function visibleText(nodes){
  let parts=[];
  function walk(node){
    if(ts.isJsxText(node)) parts.push(node.text);
    else if(ts.isJsxElement(node)||ts.isJsxFragment(node)) node.children.forEach(walk);
    else if(ts.isJsxExpression(node)&&node.expression){
      function strings(n){ if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))parts.push(n.text); else ts.forEachChild(n,strings); }
      strings(node.expression);
    }
  }
  nodes.forEach(walk);return parts.join(' ').replace(/\s+/g,' ').trim();
}
const files=[]; for(const d of sourceRoots)collect(d,files);
const staged=[];
for(const file of files){
  const src=fs.readFileSync(file,'utf8');
  if(!/check\s*answers?/i.test(src)) continue;
  const sf=ts.createSourceFile(file,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  if(sf.parseDiagnostics.length){console.error('STOPPED: Existing TSX parse error in',file);process.exit(2);}
  const patches=[];
  function visit(n){
    if(ts.isJsxElement(n)||ts.isJsxSelfClosingElement(n)){
      const tag=String((ts.isJsxElement(n)?n.openingElement.tagName:n.tagName).getText(sf)).toLowerCase();
      if(tag==='button'||tag==='input'){
        const label=(ts.isJsxElement(n)?visibleText(n.children):'')+' '+attrValue(n,'aria-label')+' '+attrValue(n,'value')+' '+attrValue(n,'title')+' '+attrValue(n,'label');
        if(/\bcheck\s+answers?\b/i.test(label)){
          patches.push({start:n.getStart(sf),end:n.getEnd(),label:label.trim()});
          return;
        }
      }
    }
    ts.forEachChild(n,visit);
  }
  visit(sf);
  if(!patches.length)continue;
  let next=src;
  for(const p of patches.sort((a,b)=>b.start-a.start)) next=next.slice(0,p.start)+'<></>'+next.slice(p.end);
  const check=ts.createSourceFile(file,next,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  if(check.parseDiagnostics.length){console.error('STOPPED: New TSX parse error in',file,check.parseDiagnostics[0].messageText);process.exit(2);}
  staged.push({file,next,count:patches.length});
}
for(const x of staged){console.log((apply?'REMOVE: ':'FOUND: ')+path.relative(root,x.file)+' — '+x.count+' Check Answer button(s)');}
if(apply) { for(const x of staged)fs.writeFileSync(x.file,x.next); console.log('DONE: Removed '+staged.reduce((s,x)=>s+x.count,0)+' Check Answer controls. No other elements modified.'); }
else console.log('CHECK ONLY: '+staged.reduce((s,x)=>s+x.count,0)+' Check Answer controls found. Run with --apply to remove.');
