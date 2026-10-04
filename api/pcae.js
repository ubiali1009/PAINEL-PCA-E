// API pública de consulta. Não recebe alterações nem encaminha credenciais de visitantes.
const SHEET_ID = '1n_bRcmzb9W45D3nzCXo9kYGliOuGSNyjVWxxXUBjhBs';
const TABS = [
  { key: 'base', gid: '0', required: ['OBJETO', 'UGE', 'VALOR TOTAL EMPENHADO', 'VALOR TOTAL LIQUIDADO', 'QTDE ENTREGUE'] },
  { key: 'atas', gid: '1223289174', required: ['OBJETO', 'SITUAÇÃO', 'UGE', 'ESTÁGIO LICITATÓRIO'] },
];

// A exportação CSV mantém valores mistos, datas e identificadores como aparecem na planilha.
function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (quoted) throw new Error('CSV incompleto.');
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function toObjects(csv, required) {
  const matrix = parseCsv(csv);
  const headers = (matrix.shift() || []).map(h => h.trim());
  if (required.some(h => !headers.includes(h))) throw new Error('Cabeçalhos da planilha não reconhecidos.');
  return matrix.filter(row => row.some(value => value.trim())).map(row => {
    const result = {};
    headers.forEach((header, index) => { if (header) result[header] = row[index] || ''; });
    return result;
  }).filter(row => String(row.OBJETO || '').trim());
}

async function readTab(tab, signal) {
  const url = new URL('https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/export');
  url.searchParams.set('format', 'csv');
  url.searchParams.set('gid', tab.gid);
  // Evita uma exportação antiga no cache da origem.
  url.searchParams.set('_', String(Date.now()));
  const response = await fetch(url, { method: 'GET', credentials: 'omit', redirect: 'follow', cache: 'no-store', signal });
  if (!response.ok) throw new Error('Leitura indisponível.');
  if ((response.headers.get('content-type') || '').includes('text/html')) throw new Error('Planilha requer acesso.');
  const csv = await response.text();
  if (csv.length > 8000000 || /^\s*</.test(csv)) throw new Error('Resposta inválida.');
  return toObjects(csv, tab.required);
}

async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).json({ error: 'Este painel permite apenas consultas.' });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const [base, atas] = await Promise.all(TABS.map(tab => readTab(tab, controller.signal)));
    if (!base.length) throw new Error('Base sem registros.');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
    return res.status(200).json({ base, atas, fetchedAt: new Date().toISOString() });
  } catch {
    controller.abort();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'Não foi possível consultar a planilha agora. Tente novamente em alguns minutos.' });
  } finally {
    clearTimeout(timer);
  }
}
module.exports = handler;
// Auxiliares para verificação local; a única rota pública é o handler acima.
module.exports.parseCsv = parseCsv;
module.exports.toObjects = toObjects;

