// Map-N presence resolver v2.0.0
// Consumes strict per-message person candidates; never invents names itself.
const wait=ms=>new Promise(r=>setTimeout(r,ms)),VERSION=3,uniq=a=>[...new Set((a||[]).map(x=>String(x).trim()).filter(Boolean))];
const EXIT_RE=/(?:离开(?:了)?|走了|走开|离去|离场|退下|退了出去|告辞|转身离开|转身离去|出了门|走出(?:去)?|先回去了|回去了|独自离开|自行离开|被带走|被抬走|被送走)/u;
const ARRIVE_RE=/(?:赶到|来到|过来|进来|走来|出现|迎出来|迎上来|凑过来|靠过来|跟上|追上|返回|回来|留下|留在|仍在|还在|守在|站在|坐在|待在|陪着)/u;
const MOVE_RE=/(?:你|你们|众人|几人|一行人|两人|三人|大家|他们|她们)[^。！？!?；;\n]{0,18}(?:来到|抵达|到达|进入|走进|赶到|回到|返回|离开|走出|前往|转到|转入)/u;
const key=i=>`${i.memoryKey}:presence-v1`;
function empty(){return{version:VERSION,current:[],lastLocation:null}}
function load(i){try{const d=JSON.parse(localStorage.getItem(key(i))||'null');return d?.version===VERSION?d:empty()}catch{return empty()}}
function save(i,s){try{s.version=VERSION;localStorage.setItem(key(i),JSON.stringify(s))}catch{}}
function local(text,name){const x=text.indexOf(name);return x<0?'':text.slice(Math.max(0,x-20),Math.min(text.length,x+name.length+24));}
function resolve(i,core,text,raw){const s=i.__mapNPresenceState||=load(i),src=String(text||''),now=uniq(raw),parts=core.parseHeaderLocation(src),loc=parts?.join('／')||null,changed=!!(loc&&s.lastLocation&&loc!==s.lastLocation);let present=new Set(changed||MOVE_RE.test(src)?[]:uniq(s.current));for(const n of now)present.add(n);for(const n of uniq([...present,...now])){const ctx=local(src,n);if(!ctx)continue;if(EXIT_RE.test(ctx)&&!ARRIVE_RE.test(ctx))present.delete(n);else if(ARRIVE_RE.test(ctx))present.add(n);}s.current=uniq([...present]).slice(0,12);if(loc)s.lastLocation=loc;save(i,s);return s.current;}
async function install(){for(let n=0;n<200&&(!window.MapNInstance||!globalThis.MapNEntityCore);n++)await wait(50);const i=window.MapNInstance,core=globalThis.MapNEntityCore;if(!i||!core||i.__presence200)return;for(let n=0;n<80&&!i.__strictEntity200;n++)await wait(50);i.__presence200=true;i.__mapNPresenceState=load(i);const old=i.process.bind(i);i.process=function(text,isUser=false){const before=[...(this.currentChars||[])];old(text,isUser);if(isUser||!text){if(isUser)this.currentChars=before;return;}this.currentChars=resolve(this,core,String(text),this.currentChars||[]);for(const x of this.currentChars)this.encountered.add(x);this.save?.();if(this.container?.classList.contains('open'))this.render?.();};const chat=i.ctx?.chat||[];for(let n=chat.length-1;n>=0;n--){const m=chat[n];if(m?.mes&&!m.is_user){i.currentChars=resolve(i,core,String(m.mes),i.currentChars||[]);break;}}i.save?.();i.render?.();console.log('[Map-N] presence resolver v2.0.0 installed');}
install();
