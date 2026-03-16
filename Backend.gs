// ============================================================
// HUEVOS LA CAMPESTRE — Backend Apps Script v3
// ============================================================
const SHEET_ID       = '1mL9aBs-4UPpQW-iJBxBc3Wbh2Xg88svi5uUK2qeBpAI';
const SHEET_LOTES    = 'LOTES';
const SHEET_ENTREGAS = 'ENTREGAS_ALIMENTO';
const SHEET_REGISTROS= 'REGISTROS';
const SHEET_DASH     = 'DASHBOARD';
const KG_SACO        = 25;

// ── doPost ────────────────────────────────────────────────────
function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if      (d.accion === 'registro')   guardarRegistro(d);
    else if (d.accion === 'nuevo_lote') agregarLote(d);
    else if (d.accion === 'baja_lote')  darDeBajaLote(d.slug, d.lote);
    else if (d.accion === 'entrega')    guardarEntrega(d);
    else if (d.accion === 'editar_lote') editarLote(d);
    else if (d.accion === 'set_dieta')  guardarDietaProductor(d.slug, d.dieta);
    return _json({ ok: true });
  } catch(err) {
    return _json({ ok: false, error: err.message });
  }
}

// ── doGet ─────────────────────────────────────────────────────
function doGet(e) {
  const accion = e.parameter.accion || '';
  const slug   = e.parameter.slug   || '';
  if (!slug) return _json({ ok: false, error: 'Sin slug' });

  if (accion === 'lotes') {
    // Devuelve lotes + stock del PRODUCTOR (no por lote) + dieta guardada
    const lotes      = obtenerLotesActivos(slug);
    const stockProd  = obtenerStockProductor(slug);
    const dieta      = obtenerDietaProductor(slug);
    return _json({ ok: true, lotes, stockKg: stockProd, dieta });
  }
  if (accion === 'dashboard') {
    return _json({ ok: true, data: buildDashboardData() });
  }
  return _json({ ok: false, error: 'Accion no reconocida' });
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── REGISTROS DIARIOS ─────────────────────────────────────────
function guardarRegistro(d) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let h = ss.getSheetByName(SHEET_REGISTROS);
  if (!h) {
    h = ss.insertSheet(SHEET_REGISTROS);
    h.getRange(1,1,1,12).setValues([[
      'Timestamp','Fecha','Slug','Productor','Pabellón',
      'Dieta','Total kg','Aves muertas','Huevos','Aves totales','% Postura','Observaciones'
    ]]).setBackground('#0a2e1a').setFontColor('#fff').setFontWeight('bold');
    h.setFrozenRows(1);
  }
  const postura = (d.aves > 0 && d.huevos > 0)
    ? Math.round(d.huevos / d.aves * 10000) / 100 : '';

  h.appendRow([
    new Date(d.timestamp),
    new Date(d.fecha + 'T12:00:00'),
    d.slug, d.productor, d.pabellon,
    d.dieta || '',
    parseFloat(d.total_kg) || 0,
    parseInt(d.muertas) || 0,
    parseInt(d.huevos)  || 0,
    parseInt(d.aves)    || 0,
    postura,
    d.obs || ''
  ]);
  const uf = h.getLastRow();
  h.getRange(uf,1).setNumberFormat('dd/mm/yyyy HH:mm');
  h.getRange(uf,2).setNumberFormat('dd/mm/yyyy');
  if (uf % 2 === 0) h.getRange(uf,1,1,12).setBackground('#f0faf3');

  // Descontar del stock del productor
  descontarStockProductor(d.slug, parseFloat(d.total_kg)||0);
  actualizarDashboard();
}

// ── STOCK POR PRODUCTOR (no por lote) ────────────────────────
// Col 7 de LOTES = Stock kg ACUMULADO DEL PRODUCTOR
// Lo guardamos en una fila especial con lote = '__STOCK__'

function _getHojaStock(ss) {
  // Reutilizamos la hoja ENTREGAS para llevar el stock neto por productor
  let h = ss.getSheetByName('STOCK_PRODUCTORES');
  if (!h) {
    h = ss.insertSheet('STOCK_PRODUCTORES');
    h.getRange(1,1,1,4).setValues([['Slug','Productor','Stock kg','Última actualización']])
      .setBackground('#0a2e1a').setFontColor('#fff').setFontWeight('bold');
    h.setFrozenRows(1);
    h.setColumnWidth(1,130); h.setColumnWidth(2,180);
    h.setColumnWidth(3,110); h.setColumnWidth(4,150);
  }
  return h;
}

function obtenerStockProductor(slug) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const h  = _getHojaStock(ss);
  if (h.getLastRow() < 2) return 0;
  const datos = h.getRange(2,1,h.getLastRow()-1,3).getValues();
  const fila  = datos.find(r => r[0] === slug);
  return fila ? parseFloat(fila[2]) || 0 : 0;
}

function sumarStockProductor(slug, productor, kg) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const h  = _getHojaStock(ss);
  if (h.getLastRow() >= 2) {
    const datos = h.getRange(2,1,h.getLastRow()-1,3).getValues();
    const idx   = datos.findIndex(r => r[0] === slug);
    if (idx >= 0) {
      const actual = parseFloat(datos[idx][2]) || 0;
      h.getRange(idx+2, 3).setValue(actual + kg);
      h.getRange(idx+2, 4).setValue(new Date()).setNumberFormat('dd/mm/yyyy HH:mm');
      return;
    }
  }
  h.appendRow([slug, productor, kg, new Date()]);
  h.getRange(h.getLastRow(),4).setNumberFormat('dd/mm/yyyy HH:mm');
}

function descontarStockProductor(slug, kg) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const h  = _getHojaStock(ss);
  if (h.getLastRow() < 2) return;
  const datos = h.getRange(2,1,h.getLastRow()-1,3).getValues();
  const idx   = datos.findIndex(r => r[0] === slug);
  if (idx >= 0) {
    const actual = parseFloat(datos[idx][2]) || 0;
    h.getRange(idx+2, 3).setValue(Math.max(0, actual - kg));
    h.getRange(idx+2, 4).setValue(new Date()).setNumberFormat('dd/mm/yyyy HH:mm');
  }
}

// ── DIETA POR PRODUCTOR ───────────────────────────────────────
function guardarDietaProductor(slug, dieta) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const h  = _getHojaStock(ss);
  if (h.getLastRow() < 2) return;
  const datos = h.getRange(2,1,h.getLastRow()-1,5).getValues();
  const idx   = datos.findIndex(r => r[0] === slug);
  // Aseguramos que col 5 exista para dieta
  if (idx >= 0) {
    h.getRange(idx+2, 5).setValue(dieta);
  }
}

function obtenerDietaProductor(slug) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const h  = _getHojaStock(ss);
  if (h.getLastRow() < 2) return null;
  // Verificar si tiene columna 5
  const lastCol = h.getLastColumn();
  if (lastCol < 5) return null;
  const datos = h.getRange(2,1,h.getLastRow()-1,5).getValues();
  const fila  = datos.find(r => r[0] === slug);
  return fila ? (fila[4] || null) : null;
}

// ── ENTREGAS DE ALIMENTO (Andrés) ─────────────────────────────
function guardarEntrega(d) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let h = ss.getSheetByName(SHEET_ENTREGAS);
  if (!h) {
    h = ss.insertSheet(SHEET_ENTREGAS);
    h.getRange(1,1,1,10).setValues([[
      'Timestamp','Fecha','Slug','Productor',
      'Inicial(s)','Recría(s)','Pre-postura(s)',
      'Ponedora1(s)','Ponedora2(s)','Otro(s)',
      'Total sacos','Total kg','Observaciones'
    ]]);
    // Fix: 13 cols
    h.getRange(1,1,1,13).setBackground('#1a1a2e').setFontColor('#fff').setFontWeight('bold');
    h.setFrozenRows(1);
  }
  const s = d.sacos || {};
  h.appendRow([
    new Date(d.timestamp),
    new Date(d.fecha + 'T12:00:00'),
    d.slug, d.productor,
    s['Inicial']||0, s['Recría']||0, s['Pre-postura']||0,
    s['Ponedora 1']||0, s['Ponedora 2']||0, s['Otro']||0,
    d.totalSacos||0, d.totalKg||0, d.obs||''
  ]);
  const uf = h.getLastRow();
  h.getRange(uf,1).setNumberFormat('dd/mm/yyyy HH:mm');
  h.getRange(uf,2).setNumberFormat('dd/mm/yyyy');
  if (uf % 2 === 0) h.getRange(uf,1,1,13).setBackground('#f0faf3');

  // Sumar al stock del productor
  sumarStockProductor(d.slug, d.productor, parseFloat(d.totalKg)||0);
  actualizarDashboard();
}

// ── LOTES ─────────────────────────────────────────────────────
function _getHojaLotes(ss) {
  let h = ss.getSheetByName(SHEET_LOTES);
  if (!h) {
    h = ss.insertSheet(SHEET_LOTES);
    h.getRange(1,1,1,9).setValues([[
      'Slug','Productor','Lote','Estado',
      'Fecha alta','Fecha baja','Aves','Fecha Nac.','Dieta'
    ]]).setBackground('#0a2e1a').setFontColor('#fff').setFontWeight('bold');
    h.setFrozenRows(1);
    [130,160,140,80,110,110,80,110,120].forEach((w,i)=>h.setColumnWidth(i+1,w));
  }
  return h;
}

function obtenerLotesActivos(slug) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const h  = _getHojaLotes(ss);
  if (h.getLastRow() < 2) return [];
  const datos = h.getRange(2,1,h.getLastRow()-1,9).getValues();
  return datos
    .filter(r => r[0]===slug && String(r[3]).toUpperCase()==='ACTIVO')
    .map(r => ({
      nombre:   String(r[2]),
      aves:     parseInt(r[6]) || 0,
      fechaNac: r[7] ? Utilities.formatDate(new Date(r[7]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : null,
    }));
}

function agregarLote(d) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const h  = _getHojaLotes(ss);
  if (h.getLastRow() >= 2) {
    const datos = h.getRange(2,1,h.getLastRow()-1,4).getValues();
    if (datos.some(r => r[0]===d.slug && r[2]===d.lote && String(r[3]).toUpperCase()==='ACTIVO')) return;
  }
  const fn = d.fechaNac ? new Date(d.fechaNac + 'T12:00:00') : '';
  h.appendRow([d.slug, d.productor, d.lote, 'ACTIVO', new Date(), '', parseInt(d.aves)||0, fn, '']);
  const uf = h.getLastRow();
  h.getRange(uf,5).setNumberFormat('dd/mm/yyyy');
  if (fn) h.getRange(uf,8).setNumberFormat('dd/mm/yyyy');
  if (uf % 2 === 0) h.getRange(uf,1,1,9).setBackground('#f0faf3');
}

function editarLote(d) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const h  = _getHojaLotes(ss);
  if (h.getLastRow() < 2) return;
  const datos = h.getRange(2, 1, h.getLastRow()-1, 9).getValues();
  datos.forEach((r, i) => {
    if (r[0]===d.slug && r[2]===d.lote && String(r[3]).toUpperCase()==='ACTIVO') {
      const fila = i + 2;
      // Col 7 = Aves, Col 8 = Fecha Nac
      if (d.aves) h.getRange(fila, 7).setValue(parseInt(d.aves)||0);
      if (d.fechaNac) {
        h.getRange(fila, 8).setValue(new Date(d.fechaNac+'T12:00:00')).setNumberFormat('dd/mm/yyyy');
      } else {
        h.getRange(fila, 8).setValue('');
      }
    }
  });
}


function darDeBajaLote(slug, nombreLote) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const h  = _getHojaLotes(ss);
  if (h.getLastRow() < 2) return;
  const datos = h.getRange(2,1,h.getLastRow()-1,4).getValues();
  datos.forEach((r,i) => {
    if (r[0]===slug && r[2]===nombreLote && String(r[3]).toUpperCase()==='ACTIVO') {
      h.getRange(i+2,4).setValue('INACTIVO');
      h.getRange(i+2,6).setValue(new Date()).setNumberFormat('dd/mm/yyyy');
      h.getRange(i+2,1,1,9).setBackground('#fee2e2');
    }
  });
}

// ── DASHBOARD ─────────────────────────────────────────────────
function buildDashboardData() {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const hStock= _getHojaStock(ss);
  const hLotes= _getHojaLotes(ss);
  const hRegs = ss.getSheetByName(SHEET_REGISTROS);
  const result= [];

  if (hStock.getLastRow() < 2) return result;
  const stocks = hStock.getRange(2,1,hStock.getLastRow()-1,5).getValues();

  stocks.forEach(sr => {
    const slug     = sr[0];
    const productor= sr[1];
    const stockKg  = parseFloat(sr[2]) || 0;
    const dieta    = sr[4] || '—';

    // Lotes activos
    const lotesData = hLotes.getLastRow()>=2
      ? hLotes.getRange(2,1,hLotes.getLastRow()-1,7).getValues()
          .filter(r=>r[0]===slug && String(r[3]).toUpperCase()==='ACTIVO')
      : [];
    const totalAves = lotesData.reduce((s,r)=>s+(parseInt(r[6])||0),0);

    // Último registro
    let ultimaFecha = '—', diasSinReg = '—';
    if (hRegs && hRegs.getLastRow()>=2) {
      const regs = hRegs.getRange(2,1,hRegs.getLastRow()-1,12).getValues()
        .filter(r=>r[2]===slug).sort((a,b)=>b[1]-a[1]);
      if (regs.length) {
        ultimaFecha = Utilities.formatDate(new Date(regs[0][1]), Session.getScriptTimeZone(), 'dd/MM/yyyy');
        diasSinReg  = Math.floor((Date.now()-new Date(regs[0][1]))/(86400000));
      }
    }

    // Días de stock estimados
    const consumoDia = totalAves * 0.115;
    const diasStock  = consumoDia>0 ? Math.round(stockKg/consumoDia) : null;

    result.push({ slug, productor, stockKg, totalAves, diasStock, dieta, ultimaFecha, diasSinReg, lotes: lotesData.length });
  });

  return result;
}

function actualizarDashboard() {
  const ss  = SpreadsheetApp.openById(SHEET_ID);
  let hDash = ss.getSheetByName(SHEET_DASH);
  if (!hDash) hDash = ss.insertSheet(SHEET_DASH, 0);
  hDash.clearContents(); hDash.clearFormats();

  hDash.getRange('A1:J1').merge().setValue('📊  DASHBOARD — HUEVOS LA CAMPESTRE')
    .setBackground('#0a2e1a').setFontColor('#fff').setFontWeight('bold').setFontSize(14).setVerticalAlignment('middle');
  hDash.setRowHeight(1,42);
  hDash.getRange('A2').setValue('Actualizado: '+Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'dd/MM/yyyy HH:mm'))
    .setFontStyle('italic').setFontColor('#888').setFontSize(10);

  hDash.getRange('A4:J4').setValues([[
    'Productor','Lotes','Aves totales','Stock kg','Días stock',
    'Dieta actual','Última act.','Días sin reg.','Alerta stock','Alerta registro'
  ]]).setBackground('#1a5c34').setFontColor('#fff').setFontWeight('bold')
    .setWrap(true).setVerticalAlignment('middle').setHorizontalAlignment('center');
  hDash.setRowHeight(4,45);

  const data = buildDashboardData();
  data.forEach((row, i) => {
    const fila = i + 5;
    const alertaStock = row.diasStock===null?'Sin aves':row.diasStock<=5?'🔴 URGENTE':row.diasStock<=12?'🟡 ATENCIÓN':'🟢 OK';
    const alertaReg   = row.diasSinReg==='—'?'Sin registros':row.diasSinReg>=3?'🔴 Sin registrar':row.diasSinReg>=2?'🟡 Hace 2 días':'🟢 Al día';
    hDash.getRange(fila,1,1,10).setValues([[
      row.productor, row.lotes, row.totalAves,
      Math.round(row.stockKg).toLocaleString(), row.diasStock!==null?row.diasStock+'d':'—',
      row.dieta, row.ultimaFecha, row.diasSinReg==='—'?'—':row.diasSinReg+' días',
      alertaStock, alertaReg
    ]]);
    hDash.getRange(fila,1,1,10).setBackground(i%2===0?'#fff':'#f0faf3');
    const cStock = row.diasStock===null?'#f3f4f6':row.diasStock<=5?'#fee2e2':row.diasStock<=12?'#fef3c7':'#d1fae5';
    const cReg   = row.diasSinReg==='—'?'#f3f4f6':row.diasSinReg>=3?'#fee2e2':row.diasSinReg>=2?'#fef3c7':'#d1fae5';
    hDash.getRange(fila,9).setBackground(cStock);
    hDash.getRange(fila,10).setBackground(cReg);
  });

  [160,60,90,100,80,110,90,90,100,110].forEach((w,i)=>hDash.setColumnWidth(i+1,w));
  hDash.setFrozenRows(4); hDash.setFrozenColumns(1);
  SpreadsheetApp.getActiveSpreadsheet().toast('Dashboard actualizado ✅','La Campestre',4);
}

// ── MENÚ ──────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🥚 La Campestre')
    .addItem('Actualizar Dashboard', 'actualizarDashboard')
    .addItem('Ver links de productores', 'mostrarLinks')
    .addSeparator()
    .addItem('📋 Instrucciones', 'mostrarInstrucciones')
    .addToUi();
}

function mostrarLinks() {
  const BASE = 'http://avivet.cl/Campestre_alimento/';
  const slugs = {
    'Criadero Epulef':'epulef-criadero','Frank Epulef':'epulef-frank',
    'Agrícola Ñanculén':'nanculen','Avícola Emplumados':'emplumados',
    'Juan Becerra':'becerra','Cristian Vergara':'vergara',
    'Huevos Calibú':'calibu','Roberto Santelices':'santelices',
    'Juan Pablo Herrera':'herrera','Copihue Real':'copihue-real',
  };
  let msg = 'Links productores:\n\n';
  Object.entries(slugs).forEach(([n,s])=>{ msg+=`${n}:\n${BASE}?p=${s}\n\n`; });
  msg += `\nAdmin:\n${BASE}Admin.html`;
  SpreadsheetApp.getUi().alert('Links', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

function mostrarInstrucciones() {
  SpreadsheetApp.getUi().alert('Instrucciones',
    '1. Backend recibe registros de la app web\n' +
    '2. Stock se maneja por PRODUCTOR (no por lote)\n' +
    '3. Entregas de Andrés suman al stock\n' +
    '4. Registros diarios descuentan del stock\n' +
    '5. Hojas: REGISTROS, LOTES, ENTREGAS_ALIMENTO, STOCK_PRODUCTORES, DASHBOARD',
    SpreadsheetApp.getUi().ButtonSet.OK);
}
