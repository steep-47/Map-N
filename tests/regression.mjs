import fs from 'node:fs';
const url=new URL('../entity-core.js',import.meta.url);const source=fs.readFileSync(url,'utf8');const core=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const sceneUrl=new URL('../scene-scanner.js',import.meta.url),sceneSource=fs.readFileSync(sceneUrl,'utf8');
const storage=new Map();globalThis.localStorage={getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
const sceneModuleSource=sceneSource.replace(/\ninstall\(\);\s*$/u,'')+'\nexport {empty,learn,scanHeaders};';
const scene=await import(`data:text/javascript;base64,${Buffer.from(sceneModuleSource).toString('base64')}`);
const same=(actual,expected,name)=>{if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error(`${name}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`)};
same(core.normalizeLocationParts('08:00 | 沉陆'),['沉陆'],'timestamp stripped');
same(core.parseHeaderLocation('12500-01-01 08:00 | 云陆·大炎皇朝·青定府·永澄县·陈宅\n正文'),['云陆','大炎皇朝','青定府','永澄县','陈宅'],'five-digit numeric year header hierarchy');
same(core.parseHeaderLocation('【云陆／大黎王朝／苍梧郡／青溪镇｜12500年12月10日 08:00】\n正文'),['云陆','大黎王朝','苍梧郡','青溪镇'],'location-before-time header hierarchy');
const multi='【云陆／大黎王朝／苍梧郡／青溪镇｜12500年12月10日 08:00】\n第一段。\n【云陆／大黎王朝／苍梧郡／马集／牲口市｜12500年12月10日 11:00】\n第二段。';
same(core.parseHeaderLocations(multi),[['云陆','大黎王朝','苍梧郡','青溪镇'],['云陆','大黎王朝','苍梧郡','马集','牲口市']],'all scene headers in one reply');
same(core.parseHeaderLocation(multi),['云陆','大黎王朝','苍梧郡','马集','牲口市'],'last scene header is current location');
same(core.normalizeLocationParts('08:30 | 沉陆 · 石峪 · 石峪西侧旧谷道（老鹰崖塌方石堆北缘）'),['沉陆','石峪','石峪西侧旧谷道'],'parenthetical qualifier stripped');
same(core.parseHeaderLocation('【08:30 | 沉陆 · 石峪 · 石峪西侧旧谷道（旧墙墙根洞口旁）】\n正文'),['沉陆','石峪','石峪西侧旧谷道'],'header hierarchy');
same(core.parseHeaderLocation('12500年01月01日 08:00\n地点：云陆·青梧国·临川府·白石县·柳溪村\n柳溪村坐落在两道缓坡之间。'),['云陆','青梧国','临川府','白石县','柳溪村'],'explicit location label hierarchy');
same(core.parseHeaderLocation('时间：08:00\n当前位置: 云陆 / 青梧国 / 临川府 / 白石县 / 柳溪村\n正文'),['云陆','青梧国','临川府','白石县','柳溪村'],'current location label slash hierarchy');
same(core.parseHeaderLocation('### 位置｜云陆 › 青梧国 › 临川府 › 白石县 › 柳溪村\n正文'),['云陆','青梧国','临川府','白石县','柳溪村'],'markdown metadata and alternate separator');
same(core.parseHeaderLocation('📍 云陆／青梧国／临川府／白石县／柳溪村\n正文'),['云陆','青梧国','临川府','白石县','柳溪村'],'pin metadata hierarchy');
same(core.parseHeaderLocation('12500年01月01日 08:00\n云陆 → 青梧国 → 临川府 → 白石县 → 柳溪村\n正文'),['云陆','青梧国','临川府','白石县','柳溪村'],'time-adjacent unlabeled hierarchy');
same(core.parseHeaderLocation('时间：08:00\n柳溪村\n正文'),['柳溪村'],'time-adjacent single recognizable place');
same(core.parseHeaderLocation('场景：冬夜归乡\n他准备前往白石县·柳溪村。'),null,'scene title must not become location');
same(core.parseHeaderLocation('他准备前往白石县·柳溪村。\n正文继续。'),null,'narrative destination must not become current location');
if(!(core.parentScore('石峪西侧旧谷道','石峪')>0))throw new Error('峪 should parent compound 谷道');
if(!(core.parentScore('石峪西侧旧谷道北段','石峪西侧旧谷道')>core.parentScore('石峪西侧旧谷道北段','石峪')))throw new Error('longest semantic parent should win');
if(!(core.hierarchyRelationScore('石峪西侧旧谷道','石峪')>core.hierarchyRelationScore('石峪西侧旧谷道','沉陆',{explicit:true})))throw new Error('immediate semantic parent must beat broad explicit ancestor');
if(!(core.hierarchyRelationScore('石峪西侧旧谷道北段','石峪西侧旧谷道')>core.hierarchyRelationScore('石峪西侧旧谷道北段','沉陆',{explicit:true})))throw new Error('route segment must stay under route, not flatten to region');
if(!(core.hierarchyRelationScore('石峪西侧旧谷道','石峪')>core.hierarchyRelationScore('石峪西侧旧谷道','沉陆',{pathDepth:1})))throw new Error('sparse scene-header ancestry must not override missing intermediate semantic parent');
if(!(core.hierarchyRelationScore('石峪西侧旧谷道北段','石峪西侧旧谷道')>core.hierarchyRelationScore('石峪西侧旧谷道北段','沉陆',{pathDepth:1})))throw new Error('scene-header ancestor must not flatten route segment');
const ok=(value,name)=>{if(!value)throw new Error(name)};
function makeInst(chat=[]){
 return{memoryKey:'regression-'+Math.random(),ctx:{chat},__mapNSceneStore:scene.empty(),nodeMap:{},alias:new Map(),discovered:new Set(['世界舆图']),root:{id:'世界舆图',children:[],parent:null},path:['世界舆图'],currentPos:null,pathTo(id){return['世界舆图',...String(id).split('／')]},save(){},displayName(id){return this.nodeMap[id]?.displayName||id;}};
}

// Conflicting stable geography is rejected as a whole and current location becomes unknown.
{
 const i=makeInst([{is_user:false,mes:'old'},{is_user:true,mes:'去大炎王朝'},{is_user:false,mes:'wrong'}]);
 scene.learn(i,core,['云陆','大黎王朝','苍梧郡','青溪镇'],true,0,'old');
 scene.learn(i,core,['云陆','大炎皇朝','苍梧郡','白水镇'],true,2,'wrong');
 ok(!i.__mapNSceneStore.learnedLocations['云陆／大炎皇朝／苍梧郡'],'conflicting stable branch must not be created');
 ok(!i.__mapNSceneStore.learnedLocations['云陆／大黎王朝／苍梧郡／白水镇'],'tail of rejected branch must not be grafted onto old parent');
 same(i.currentPos,null,'conflict clears current location');
 same(i.path,['世界舆图'],'conflict resets current browse path');
 ok(i.__mapNSceneStore.conflicts.some(x=>x.segment==='苍梧郡'),'conflict must be recorded');
}

// Low-level duplicate names remain distinct under different complete paths.
{
 const i=makeInst();
 scene.learn(i,core,['云陆','大黎王朝','甲州','白水镇','东客栈'],true,0,'one');
 scene.learn(i,core,['云陆','大炎皇朝','乙州','白水镇','西客栈'],true,1,'two');
 ok(!!i.__mapNSceneStore.learnedLocations['云陆／大黎王朝／甲州／白水镇／东客栈'],'first same-name town path missing');
 ok(!!i.__mapNSceneStore.learnedLocations['云陆／大炎皇朝／乙州／白水镇／西客栈'],'second same-name town path missing');
}

// Explicit player geographic correction can rehome an existing subtree.
{
 const chat=Array.from({length:21},()=>({is_user:false,mes:''}));
 chat[19]={is_user:true,mes:'纠正一下，苍梧郡的归属前面写错了，属于大黎王朝，不是大炎皇朝。'};
 chat[20]={is_user:false,mes:'corrected'};
 const i=makeInst(chat);
 scene.learn(i,core,['云陆','大炎皇朝','苍梧郡','青溪镇'],true,1,'wrong-old');
 scene.learn(i,core,['云陆','大炎皇朝','苍梧郡','马集'],true,3,'wrong-child');
 scene.learn(i,core,['云陆','大黎王朝','苍梧郡','青溪镇'],true,20,'corrected');
 ok(!i.__mapNSceneStore.learnedLocations['云陆／大炎皇朝／苍梧郡'],'old corrected prefix must be removed');
 ok(!!i.__mapNSceneStore.learnedLocations['云陆／大黎王朝／苍梧郡／马集'],'corrected subtree child must migrate');
 same(i.currentPos,'云陆／大黎王朝／苍梧郡／青溪镇','explicit correction current location');
}

// A mere destination change is not a geographic correction.
{
 const i=makeInst([{is_user:false,mes:'old'},{is_user:true,mes:'我不是去大炎王朝，我改去大黎王朝。'},{is_user:false,mes:'next'}]);
 scene.learn(i,core,['云陆','大炎皇朝','苍梧郡','青溪镇'],true,0,'old');
 scene.learn(i,core,['云陆','大黎王朝','苍梧郡','青溪镇'],true,2,'next');
 ok(!!i.__mapNSceneStore.learnedLocations['云陆／大炎皇朝／苍梧郡'],'destination change must not rewrite old geography');
 ok(!i.__mapNSceneStore.learnedLocations['云陆／大黎王朝／苍梧郡'],'destination change must not create corrected branch');
}

// High-level root placeholder upgrades into its confirmed dynamic path without content growth.
{
 const i=makeInst();
 i.nodeMap['云陆']={id:'云陆',displayName:'云陆',aliases:['云陆'],content:'云陆资料',type:'location',children:[],parent:'世界舆图'};
 i.nodeMap['大炎皇朝']={id:'大炎皇朝',displayName:'大炎皇朝',aliases:['大炎皇朝','大炎'],content:'世界书固定资料。',type:'location',children:[],parent:'世界舆图'};
 i.root.children=['云陆','大炎皇朝'];i.alias.set('云陆','云陆');i.alias.set('大炎皇朝','大炎皇朝');i.alias.set('大炎','大炎皇朝');
 for(let n=0;n<100;n++)scene.learn(i,core,['云陆','大炎皇朝','京城'],true,n,`证据${n}`);
 const node=i.nodeMap['云陆／大炎皇朝'];
 ok(!i.nodeMap['大炎皇朝'],'high-level static placeholder must be removed after upgrade');
 ok(node?.worldbookBacked===true,'upgraded high-level node must remember worldbook backing');
 same(node?.worldbookContent,'世界书固定资料。','worldbook content stored separately');
 same((node?.content.match(/世界书固定资料。/g)||[]).length,1,'worldbook content must not duplicate');
 ok((node?.content.length||0)<500,'worldbook-backed content must remain bounded after repeated visits');
}

// Unknown-parent low-level worldbook placeholders do NOT attach to the first same-name dynamic location.
{
 const i=makeInst();
 i.nodeMap['白水镇']={id:'白水镇',displayName:'白水镇',aliases:['白水镇'],content:'世界书：白水镇盛产药材。',type:'location',children:[],parent:'世界舆图'};
 i.root.children=['白水镇'];i.alias.set('白水镇','白水镇');
 scene.learn(i,core,['云陆','大黎王朝','甲州','白水镇'],true,0,'first');
 ok(!!i.nodeMap['白水镇'],'low-level unknown-parent placeholder must remain unclaimed');
 ok(!String(i.nodeMap['云陆／大黎王朝／甲州／白水镇']?.content||'').includes('盛产药材'),'low-level placeholder content must not be assigned to first matching dynamic place');
}

// Full-history scene scan still reaches old headers beyond the automatic 50-message window.
{
 const i=makeInst(),chat=Array.from({length:80},(_,n)=>({is_user:n%2===0,mes:n===1?'【云陆／大黎王朝／苍梧郡／青溪镇｜12500年12月10日 08:00】':'无场景头'}));
 const result=scene.scanHeaders(i,core,chat,0,chat.length);
 same(result.count,1,'full history scene header count');
 ok(!!i.__mapNSceneStore.learnedLocations['云陆／大黎王朝／苍梧郡／青溪镇'],'full history scan must learn early header');
}

console.log('Map-N regression: OK');
