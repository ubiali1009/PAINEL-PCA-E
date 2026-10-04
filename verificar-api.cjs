const assert = require('node:assert/strict');
const handler = require('./api/pcae.js');

function response() {
  return { code: 0, headers: {}, body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

(async () => {
  assert.deepEqual(handler.parseCsv('\uFEFFOBJETO,OBSERVAÇÕES\r\n"Uniforme, operacional","Linha 1\nLinha 2 ""citada"""\r\n'), [['OBJETO','OBSERVAÇÕES'],['Uniforme, operacional','Linha 1\nLinha 2 "citada"']]);
  assert.throws(() => handler.parseCsv('OBJETO\n"linha incompleta'));
  assert.throws(() => handler.toObjects('<html>login</html>', ['OBJETO']));
  const originalFetch = global.fetch;
  let calls = [];
  try {
    global.fetch = async (url, options) => {
      calls.push({url, options});
      const gid = url.searchParams.get('gid');
      return new Response(gid === '0'
        ? 'OBJETO,UGE,VALOR TOTAL EMPENHADO,VALOR TOTAL LIQUIDADO\nViatura,180180,"R$ 38.792.907,00","R$ 38.792.907,00"\n'
        : 'OBJETO,SITUAÇÃO,UGE,ESTÁGIO LICITATÓRIO\nUniforme,EM LICITAÇÃO,180180,EM ANÁLISE\n',
        {headers:{'Content-Type':'text/csv'}});
    };
    const denied = response();
    await handler({method:'POST'}, denied);
    assert.equal(denied.code,405); assert.equal(calls.length,0);
    assert.equal(denied.headers.Allow,'GET');
    const ok = response();
    await handler({method:'GET'}, ok);
    assert.equal(ok.code,200); assert.equal(calls.length,2);
    assert.deepEqual(calls.map(c=>c.url.searchParams.get('gid')).sort(), ['0','1223289174']);
    assert(calls.every(c=>c.options.method==='GET' && c.options.credentials==='omit'));
    assert.equal(ok.body.base[0]['VALOR TOTAL EMPENHADO'],'R$ 38.792.907,00');
    assert.equal(ok.body.atas.length,1); assert(Number.isFinite(Date.parse(ok.body.fetchedAt)));
    global.fetch = async () => new Response('<html>login</html>', {headers:{'Content-Type':'text/html'}});
    const inaccessible = response(); await handler({method:'GET'}, inaccessible);
    assert.equal(inaccessible.code,503); assert.equal(inaccessible.headers['Cache-Control'],'no-store');
    global.fetch = async (url) => new Response(url.searchParams.get('gid') === '0'
      ? 'OBJETO,UGE,VALOR TOTAL EMPENHADO,VALOR TOTAL LIQUIDADO\nViatura,180180,1,1'
      : 'OBJETO,SITUAÇÃO,UGE,ESTÁGIO LICITATÓRIO\n');
    const emptyAtas = response(); await handler({method:'GET'}, emptyAtas);
    assert.equal(emptyAtas.code,200); assert.equal(emptyAtas.body.atas.length,0);
    global.fetch = async () => {throw new Error('Rede indisponível');};
    const unavailable = response(); await handler({method:'GET'}, unavailable);
    assert.equal(unavailable.code,503);
    console.log('API: CSV com vírgulas/aspas/quebras de linha, leitura das duas abas, bloqueio de escrita, erro de acesso e ata vazia — OK.');
  } finally {global.fetch = originalFetch;}
})().catch(e => {console.error(e); process.exitCode=1;});
