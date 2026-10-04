const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
scripts.forEach(([,source]) => new vm.Script(source));
const source = scripts[0][1];
const helpers = source.slice(source.indexOf('function isoAny('), source.indexOf('const REFRESH_INTERVAL_MS'));
const sync = source.slice(source.indexOf('const REFRESH_INTERVAL_MS'));
const nodes = new Map();
const timers = []; const events = {};
const getNode = key => {
  if (!nodes.has(key)) nodes.set(key, {textContent:'',disabled:false,classList:{contains:()=>false}});
  return nodes.get(key);
};
const fixture = {
  base:[{OBJETO:'Viatura',UGE:'180180', 'VALOR TOTAL EMPENHADO':'R$ 38.792.907,00', 'QTDE TOTAL CONTRATADA 2':'4.200','ANO':'2026'}],
  atas:[{OBJETO:'Uniforme',UGE:'180180',SITUAÇÃO:'EM LICITAÇÃO','QUANTIDADE NEGOCIADA':'4.200','DATA DO ESTÁGIO CONFIRMADO':'01/10/2026 00:00'}],
  fetchedAt:'2026-10-04T05:30:00.000Z'
};
let failed = false; let fetches = 0; let rendered = 0;
const store = new Map();
const context = vm.createContext({
  Date,Number,String,Array,JSON,AbortController,Intl,
  base:[{objeto:'Cópia anterior'}],atas:[],navigator:{onLine:true},
  $:getNode, initFilters(){}, renderAll(){rendered++;}, closeDrawer(){},
  localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)},
  document:{hidden:false,addEventListener:(name,fn)=>{events[name]=fn;}},
  window:{addEventListener:(name,fn)=>{events[name]=fn;}},
  setInterval:(fn,ms)=>{timers.push({fn,ms});},setTimeout:()=>1,clearTimeout(){},
  fetch:async (url,options)=>{
    fetches++; assert.equal(url,'/api/pcae'); assert.equal(options.method,'GET'); assert.equal(options.credentials,'omit');
    if(failed) throw new Error('rede indisponível');
    return {ok:true,json:async()=>fixture};
  },
});

(async()=>{
  vm.runInContext(helpers + '\n' + sync, context);
  // A primeira consulta automática inicia assim que o painel é carregado.
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(fetches,1); assert.equal(context.base[0].valorEmpenhado,38792907);
  assert.equal(context.base[0].qtdContratada,4200); assert.equal(context.atas[0].qtdNegociada,4200);
  assert.equal(context.atas[0].dataEstagio,'2026-10-01'); assert(rendered>=2);
  assert(getNode('#sourcePill').textContent.includes('Dados consultados'));
  assert.equal(timers[0].ms,300000); assert(store.has('pcaePublicLastSyncV1'));
  failed=true; await vm.runInContext('syncOnline()',context);
  assert.equal(context.base[0].valorEmpenhado,38792907);
  assert(getNode('#syncMessage').textContent.includes('mantendo a última cópia'));
  assert.equal(getNode('#onlineSyncBtn').disabled,false);
  context.navigator.onLine=false;
  const previous=fetches; await vm.runInContext('syncOnline()',context); assert.equal(fetches,previous);
  context.navigator.onLine=true; failed=false;
  fixture.base[0]['VALOR TOTAL EMPENHADO']='R$ 40.000.000,00';
  timers[0].fn(); await new Promise(resolve=>setImmediate(resolve)); assert.equal(context.base[0].valorEmpenhado,40000000);
  context.document.hidden=true;
  const beforeHidden=fetches; await timers[0].fn(); assert.equal(fetches,beforeHidden);
  assert(!html.includes('credentials:\'include\'')); assert(!html.includes('ONLINE_SHEET_ID'));
  console.log('Painel: consulta inicial/periódica, valores brasileiros, datas, atualização dos totais, persistência, erro de rede e recuperação — OK.');
})().catch(e=>{console.error(e);process.exitCode=1;});
