// Executed inside use_figma after a literal ledger and source-icon map are injected.
const made=[];
await Promise.all(['Regular','Semi Bold'].map(style=>figma.loadFontAsync({family:'Inter',style})));
const V={},D={};
for(const [name,id]of Object.entries(L.entities.variables))V[name]=await figma.variables.getVariableByIdAsync(id);
for(const [name,id]of Object.entries(L.entities.dimensions))D[name]=await figma.variables.getVariableByIdAsync(id);
const collection=await figma.variables.getVariableCollectionByIdAsync(L.entities.collections.color);
function track(n){made.push(n.id);return n;}
function tree(n){track(n);if('children'in n)for(const child of n.children)tree(child);return n;}
function paint(token){return figma.variables.setBoundVariableForPaint({type:'SOLID',color:{r:0,g:0,b:0}},'color',V[token]);}
function fill(n,token){n.fills=[paint(token)];return n;}
function stroke(n,token='border/subtle',weight=1){n.strokes=[paint(token)];n.strokeWeight=weight;return n;}
function radius(n,key='radius/control'){for(const edge of ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius'])n.setBoundVariable(edge,D[key]);}
function box(parent,name,width=1104,bg='surface/card',direction='VERTICAL',padding=24,gap=16){const n=track(figma.createAutoLayout(direction));n.name=name;n.resize(width,10);n.layoutSizingHorizontal='FIXED';n.layoutSizingVertical='HUG';n.itemSpacing=gap;n.paddingTop=n.paddingBottom=n.paddingLeft=n.paddingRight=padding;if(D['space/'+gap])n.setBoundVariable('itemSpacing',D['space/'+gap]);if(D['space/'+padding])for(const p of ['paddingTop','paddingBottom','paddingLeft','paddingRight'])n.setBoundVariable(p,D['space/'+padding]);if(bg)fill(n,bg);else n.fills=[];if(parent)parent.appendChild(n);return n;}
async function text(parent,value,style='Body',token='text/primary',width){const t=track(figma.createText());t.name=value.slice(0,70);t.fontName={family:'Inter',style:'Regular'};await t.setTextStyleIdAsync(L.entities.styles[style]);t.characters=value;fill(t,token);parent.appendChild(t);if(width){t.textAutoResize='HEIGHT';t.resize(width,t.height);t.layoutSizingHorizontal='FIXED';}return t;}
function mode(node,name){node.setExplicitVariableModeForCollection(collection,L.entities.modes[name]);}
async function board(page,name,kicker,title,description,width=1200){const b=box(page,name,width,'surface/window','VERTICAL',48,32);b.x=80;b.y=80;await text(b,kicker,'Caption','accent/fill',width-96);await text(b,title,'Portfolio display','text/primary',width-96);await text(b,description,'Body','text/secondary',width-96);return b;}
async function section(parent,title,copy){const n=box(parent,title,parent.width-96,null,'VERTICAL',0,12);await text(n,title,'Section','text/primary',n.width);if(copy)await text(n,copy,'Body','text/secondary',n.width);return n;}
function row(parent,name,width,gap=16){return box(parent,name,width,null,'HORIZONTAL',0,gap);}
function line(parent,width,token='border/subtle'){const n=track(figma.createRectangle());n.name='Divider';n.resize(width,1);fill(n,token);parent.appendChild(n);return n;}
function focus(n){n.clipsContent=false;const r=track(figma.createRectangle());r.name='Keyboard focus · 2px outline / 2px offset';n.appendChild(r);r.layoutPositioning='ABSOLUTE';r.x=-4;r.y=-4;r.resize(n.width+8,n.height+8);r.fills=[];radius(r);stroke(r,'focus/ring',2);}
function main(page,name,width,height){const c=track(figma.createComponent());c.name=name;c.layoutMode='HORIZONTAL';c.resize(width,height);c.primaryAxisSizingMode='FIXED';c.counterAxisSizingMode='FIXED';c.primaryAxisAlignItems='CENTER';c.counterAxisAlignItems='CENTER';c.itemSpacing=8;c.setBoundVariable('itemSpacing',D['space/8']);radius(c);page.appendChild(c);return c;}
function combine(page,name,variants,columns,cellWidth,cellHeight){const set=track(figma.combineAsVariants(variants,page));set.name=name;set.x=80;set.y=2200;for(const [i,n]of variants.entries()){n.x=24+(i%columns)*cellWidth;n.y=24+Math.floor(i/columns)*cellHeight;}set.resize(48+columns*cellWidth,48+Math.ceil(variants.length/columns)*cellHeight);return set;}
async function instance(parent,comp){const i=tree(comp.createInstance());parent.appendChild(i);return i;}
async function note(parent,title,copy){const n=box(parent,title,parent.width-parent.paddingLeft-parent.paddingRight,'surface/card','VERTICAL',16,8);radius(n,'radius/container');stroke(n);await text(n,title,'Body strong','text/primary',n.width-32);await text(n,copy,'Body','text/secondary',n.width-32);return n;}
function evidence(root){const nodes=root.findAllWithCriteria({types:['TEXT']});return{rootId:root.id,width:root.width,height:root.height,textCount:nodes.length,zeroWidthText:nodes.filter(n=>n.width<1).map(n=>n.id)};}
