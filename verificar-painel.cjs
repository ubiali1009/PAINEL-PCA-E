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
  base:[{OBJETO:'Capacete balístico',UGE:'180180',ÁREA:'EQUIPAMENTOS POLICIAIS',SUBÁREA:'MATERIAL BÉLICO','FORMA DE CONTRATAÇÃO':'CONTRATAÇÃO DIRETA','FORMA/MODALIDADE':'PREGÃO ELETRÔNICO','VALOR UNIT CONTRATADO (REAIS)':'R$ 1.000,00','VALOR TOTAL EMPENHADO':'R$ 4.200.000,00','VALOR TOTAL LIQUIDADO':'R$ 2.100.000,00','QTDE TOTAL CONTRATADA 2':'4.200','QTDE ENTREGUE':'2.100','ANO':'2026'}],
  atas:[{OBJETO:'Munição',UGE:'180180',ÁREA:'EQUIPAMENTOS POLICIAIS',SUBÁREA:'MATERIAL BÉLICO',SITUAÇÃO:'EM LICITAÇÃO','QUANTIDADE NEGOCIADA':'4.200','DATA DO ESTÁGIO CONFIRMADO':'01/10/2026 00:00'}],
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
  assert.equal(context.base[0].area,'EQUIPAMENTOS POLICIAIS'); assert.equal(context.base[0].subarea,'MATERIAL BÉLICO');
  assert.equal(context.base[0].formaContratacao,'CONTRATAÇÃO DIRETA'); assert.equal(context.base[0].formaModalidade,'PREGÃO ELETRÔNICO');
  assert.equal(context.base[0].valorUnitContratado,1000); assert.equal(context.base[0].valorLiquidado,2100000);
  assert.equal(context.base[0].qtdContratadaRaw,'4.200'); assert.equal(context.base[0].qtdEntregueRaw,'2.100');
  assert.equal(context.base[0].valorUnitContratadoRaw,'R$ 1.000,00'); assert.equal(context.base[0].valorEmpenhadoRaw,'R$ 4.200.000,00');
  assert.equal(context.atas[0].area,'EQUIPAMENTOS POLICIAIS'); assert.equal(context.atas[0].subarea,'MATERIAL BÉLICO');
  assert.equal(context.atas[0].dataEstagio,'2026-10-01'); assert(rendered>=2);
  assert(getNode('#sourcePill').textContent.includes('Dados consultados'));
  assert.equal(timers[0].ms,300000); assert(store.has('pcaePublicLastSyncV4'));
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
  assert(html.includes('if(key==="equipamentos")return a==="EQUIPAMENTOS POLICIAIS";'));
  assert(html.includes('if(key==="belico")return a==="EQUIPAMENTOS POLICIAIS"&&s==="MATERIAL BELICO";'));
  assert(!html.includes('COLDRE|FIEL RETRAT|ESPADA'));
  assert(html.includes('Forma de contratação')); assert(html.includes('Valor total da aquisição')); assert(html.includes('Valor pago'));
  console.log('Painel: sincronização, hierarquia, classificação da contratação, detalhes financeiros e recuperação — OK.');
})().catch(e=>{console.error(e);process.exitCode=1;});
