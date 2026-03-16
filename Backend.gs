// ============================================================
// HUEVOS LA CAMPESTRE — Backend Apps Script
// Recibe registros desde la app web y los guarda en el Sheet
// ============================================================
// INSTRUCCIONES:
// 1. Abre el Google Sheet maestro
// 2. Extensiones → Apps Script → pega este código
// 3. Implementar → Nueva implementación → App web
//    - Ejecutar como: Yo (tu cuenta)
//    - Quién tiene acceso: Cualquier persona
// 4. Copia la URL y pégala en index.html donde dice SCRIPT_URL
// ============================================================

const SHEET_ID      = '1mL9aBs-4UPpQW-iJBxBc3Wbh2Xg88svi5uUK2qeBpAI';
const SHEET_LOTES    = 'LOTES';
const SHEET_ENTREGAS = 'ENTREGAS_ALIMENTO';
const SHEET_MAESTRO = 'REGISTROS';
const SHEET_DASH    = 'DASHBOARD';
const SHEET_CONFIG  = 'CONFIGURACIÓN';

// ── RECIBIR POST desde la app web ────────────────────────────
function doPost(e) {
  try {
    const datos = JSON.parse(e.postData.contents);

    if (datos.accion === 'registro') {
      guardarRegistro(datos);
    } else if (datos.accion === 'nuevo_lote') {
      agregarLote(datos.slug, datos.productor, datos.lote);
    } else if (datos.accion === 'baja_lote') {
      darDeBajaLote(datos.slug, datos.lote);
    } else if (datos.accion === 'entrega') {
      guardarEntregaAlimento(datos);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── RECIBIR GET ───────────────────────────────────────────────
function doGet(e) {
  const accion   = e.parameter.accion || 'historico';
  const slug     = e.parameter.slug || '';
  const pabellon = e.parameter.pabellon || '';

  if (!slug) {
    return _json({ ok: false, error: 'Sin slug' });
  }

  if (accion === 'lotes') {
    const lotes = obtenerLotesActivos(slug);
    return _json({ ok: true, lotes });
  }

  const datos = obtenerHistorico(slug, pabellon);
  return _json({ ok: true, datos });
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── GUARDAR REGISTRO EN SHEET ─────────────────────────────────
function guardarRegistro(datos) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let h = ss.getSheetByName(SHEET_MAESTRO);

  // Crear hoja si no existe
  if (!h) {
    h = ss.insertSheet(SHEET_MAESTRO);
    const hdrs = [
      'Timestamp', 'Fecha', 'Slug', 'Productor', 'Pabellón/Lote',
      'Alimento (kg)', 'Aves muertas', 'Huevos', 'Observaciones'
    ];
    h.getRange(1, 1, 1, hdrs.length).setValues([hdrs])
      .setBackground('#0a2e1a')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    h.setFrozenRows(1);
  }

  // Agregar fila
  const fila = [
    new Date(datos.timestamp),
    new Date(datos.fecha + 'T12:00:00'),
    datos.slug,
    datos.productor,
    datos.pabellon,
    parseFloat(datos.alimento_kg) || 0,
    parseInt(datos.aves_muertas)  || 0,
    parseInt(datos.huevos)        || 0,
    datos.observaciones || '',
  ];

  h.appendRow(fila);

  // Formato fechas
  const ultima = h.getLastRow();
  h.getRange(ultima, 1).setNumberFormat('dd/mm/yyyy HH:mm');
  h.getRange(ultima, 2).setNumberFormat('dd/mm/yyyy');

  // Colores alternos
  if (ultima % 2 === 0) h.getRange(ultima, 1, 1, 9).setBackground('#f0faf3');

  // Actualizar dashboard automáticamente
  actualizarDashboard();
}

// ── OBTENER HISTÓRICO POR SLUG ────────────────────────────────
function obtenerHistorico(slug, pabellon) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const h  = ss.getSheetByName(SHEET_MAESTRO);
  if (!h || h.getLastRow() < 2) return [];

  const datos = h.getRange(2, 1, h.getLastRow() - 1, 9).getValues();
  return datos
    .filter(r => r[2] === slug && (!pabellon || r[4] === pabellon))
    .map(r => ({
      timestamp:    r[0] ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : '',
      fecha:        r[1] ? Utilities.formatDate(r[1], Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
      pabellon:     r[4],
      alimento_kg:  r[5],
      aves_muertas: r[6],
      huevos:       r[7],
      observaciones:r[8],
    }))
    .slice(-90); // Últimos 90 registros
}

// ── GESTIÓN DE LOTES ──────────────────────────────────────────

function _getHojaLotes(ss) {
  let h = ss.getSheetByName(SHEET_LOTES);
  if (!h) {
    h = ss.insertSheet(SHEET_LOTES);
    const hdrs = ['Slug', 'Productor', 'Lote', 'Estado', 'Fecha alta', 'Fecha baja', 'Stock kg', 'Aves', 'Fecha Nac.'];
    h.getRange(1, 1, 1, hdrs.length).setValues([hdrs])
      .setBackground('#0a2e1a').setFontColor('#ffffff').setFontWeight('bold');
    h.setFrozenRows(1);
    h.setColumnWidth(1, 130);
    h.setColumnWidth(2, 160);
    h.setColumnWidth(3, 140);
    h.setColumnWidth(4, 80);
    h.setColumnWidth(5, 120);
    h.setColumnWidth(6, 120);
    h.setColumnWidth(7, 100);
    h.setColumnWidth(8, 80);
    h.setColumnWidth(9, 110);
  }
  return h;
}

function obtenerLotesActivos(slug) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const h = _getHojaLotes(ss);
  if (h.getLastRow() < 2) return [];

  const datos = h.getRange(2, 1, h.getLastRow() - 1, 8).getValues();
  return datos
    .filter(r => r[0] === slug && String(r[3]).toUpperCase() === 'ACTIVO')
    .map(r => ({
      nombre:    String(r[2]),
      aves:      parseInt(r[7]) || 0,
      fechaNac:  r[8] ? Utilities.formatDate(new Date(r[8]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : null,
      stockKg:   parseFloat(r[6]) || 0,
    }));
}

function agregarLote(slug, productor, nombreLote) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const h = _getHojaLotes(ss);

  // Verificar que no exista ya activo
  if (h.getLastRow() >= 2) {
    const datos = h.getRange(2, 1, h.getLastRow() - 1, 4).getValues();
    const existe = datos.some(r =>
      r[0] === slug && r[2] === nombreLote && String(r[3]).toUpperCase() === 'ACTIVO'
    );
    if (existe) return; // ya existe, no duplicar
  }

  const avesNum = parseInt(datos.aves) || 0;
  const fechaNacVal = datos.fechaNac ? new Date(datos.fechaNac + 'T12:00:00') : '';
  const fila = [slug, productor, nombreLote, 'ACTIVO', new Date(), '', 0, avesNum, fechaNacVal];
  h.appendRow(fila);
  h.getRange(h.getLastRow(), 5).setNumberFormat('dd/mm/yyyy');

  // Color alternado
  const n = h.getLastRow();
  if (n % 2 === 0) h.getRange(n, 1, 1, 6).setBackground('#f0faf3');
}

function darDeBajaLote(slug, nombreLote) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const h = _getHojaLotes(ss);
  if (h.getLastRow() < 2) return;

  const datos = h.getRange(2, 1, h.getLastRow() - 1, 4).getValues();
  datos.forEach((r, i) => {
    if (r[0] === slug && r[2] === nombreLote && String(r[3]).toUpperCase() === 'ACTIVO') {
      const fila = i + 2;
      h.getRange(fila, 4).setValue('INACTIVO');
      h.getRange(fila, 6).setValue(new Date()).setNumberFormat('dd/mm/yyyy');
      h.getRange(fila, 1, 1, 6).setBackground('#fee2e2'); // rojo claro = baja
    }
  });
}

// ── DASHBOARD AUTOMÁTICO ──────────────────────────────────────
function actualizarDashboard() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let hDash = ss.getSheetByName(SHEET_DASH);
  if (!hDash) hDash = ss.insertSheet(SHEET_DASH, 0);
  hDash.clearContents();
  hDash.clearFormats();

  // Encabezado
  hDash.getRange('A1:J1').merge()
    .setValue('📊  DASHBOARD — HUEVOS LA CAMPESTRE')
    .setBackground('#0a2e1a')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setFontSize(14)
    .setVerticalAlignment('middle');
  hDash.setRowHeight(1, 42);

  hDash.getRange('A2').setValue(
    'Actualizado: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')
  ).setFontStyle('italic').setFontColor('#888888').setFontSize(10);

  // Encabezados tabla
  const hdrs = [
    'Productor', 'Pabellón', 'Último\nregistro',
    'Alimento\núlt. entrega (kg)', 'Alimento\ntotal (kg)',
    'Muertas\núlt. 7 días', 'Huevos\nprom/día',
    'Días desde\núltimo reg.', 'Alertas', 'Registros\ntotales'
  ];
  const rHdr = hDash.getRange('A4:J4');
  rHdr.setValues([hdrs])
    .setBackground('#1a5c34')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setWrap(true)
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('center');
  hDash.setRowHeight(4, 48);

  // Leer todos los registros
  const hReg = ss.getSheetByName(SHEET_MAESTRO);
  if (!hReg || hReg.getLastRow() < 2) {
    hDash.getRange('A5').setValue('Sin registros aún.');
    return;
  }

  const todos = hReg.getRange(2, 1, hReg.getLastRow() - 1, 9).getValues();

  // Agrupar por productor+pabellón
  const grupos = {};
  todos.forEach(r => {
    const key = r[3] + '||' + r[4]; // productor || pabellón
    if (!grupos[key]) grupos[key] = {
      productor: r[3], pabellon: r[4], registros: []
    };
    grupos[key].registros.push(r);
  });

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  let fila = 5;
  let idx = 0;

  // Ordenar por nombre productor
  const keys = Object.keys(grupos).sort();

  keys.forEach(key => {
    const g = grupos[key];
    const regs = g.registros.sort((a, b) => a[1] - b[1]);
    const ultimo = regs[regs.length - 1];

    // Días desde último registro
    const fechaUltimo = new Date(ultimo[1]);
    fechaUltimo.setHours(0,0,0,0);
    const diasDesde = Math.floor((hoy - fechaUltimo) / 86400000);

    // Alimento total y último
    const alimentoTotal = regs.reduce((s, r) => s + (parseFloat(r[5]) || 0), 0);
    const alimentoUltimo = parseFloat(ultimo[5]) || 0;

    // Muertas últimos 7 días
    const hace7 = new Date(hoy); hace7.setDate(hace7.getDate() - 7);
    const muertas7 = regs
      .filter(r => new Date(r[1]) >= hace7)
      .reduce((s, r) => s + (parseInt(r[6]) || 0), 0);

    // Huevos promedio
    const regsConHuevos = regs.filter(r => parseInt(r[7]) > 0);
    const huevosProm = regsConHuevos.length > 0
      ? Math.round(regsConHuevos.reduce((s, r) => s + parseInt(r[7]), 0) / regsConHuevos.length)
      : 0;

    // Alerta
    let alerta = '🟢 OK';
    if (diasDesde >= 3)  alerta = '🔴 Sin registrar';
    else if (diasDesde >= 2) alerta = '🟡 Hace 2 días';

    const vals = [
      g.productor,
      g.pabellon,
      Utilities.formatDate(new Date(ultimo[1]), Session.getScriptTimeZone(), 'dd/MM/yyyy'),
      alimentoUltimo,
      Math.round(alimentoTotal),
      muertas7,
      huevosProm || '—',
      diasDesde === 0 ? 'Hoy' : diasDesde === 1 ? 'Ayer' : diasDesde + ' días',
      alerta,
      regs.length,
    ];

    hDash.getRange(fila, 1, 1, 10).setValues([vals]);
    hDash.getRange(fila, 1, 1, 10).setBackground(idx % 2 === 0 ? '#ffffff' : '#f0faf3');

    // Color celda alerta
    const colorAlerta = diasDesde >= 3 ? '#fee2e2' : diasDesde >= 2 ? '#fef3c7' : '#d1fae5';
    hDash.getRange(fila, 9).setBackground(colorAlerta);

    fila++;
    idx++;
  });

  // Anchos de columna
  [160, 120, 100, 120, 110, 100, 90, 100, 110, 90].forEach((w, i) => {
    hDash.setColumnWidth(i + 1, w);
  });
  hDash.setFrozenRows(4);
  hDash.setFrozenColumns(1);
}


// ── ENTREGAS DE ALIMENTO (registro de Andrés) ────────────────
function guardarEntregaAlimento(datos) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let h = ss.getSheetByName(SHEET_ENTREGAS);
  if (!h) {
    h = ss.insertSheet(SHEET_ENTREGAS);
    const hdrs = ['Timestamp','Fecha','Slug','Productor','Lote',
                  'Inicial (sacos)','Recría (sacos)','Pre-postura (sacos)',
                  'Ponedora 1 (sacos)','Ponedora 2 (sacos)','Otro (sacos)',
                  'Total sacos','Total kg','Observaciones'];
    h.getRange(1,1,1,hdrs.length).setValues([hdrs])
      .setBackground('#1a1a2e').setFontColor('#ffffff').setFontWeight('bold');
    h.setFrozenRows(1);
  }
  const s = datos.sacos || {};
  const fila = [
    new Date(datos.timestamp),
    new Date(datos.fecha + 'T12:00:00'),
    datos.slug,
    datos.productor,
    datos.lote,
    s['Inicial']||0, s['Recría']||0, s['Pre-postura']||0,
    s['Ponedora 1']||0, s['Ponedora 2']||0, s['Otro']||0,
    datos.totalSacos||0,
    datos.totalKg||0,
    datos.obs||''
  ];
  h.appendRow(fila);
  const uf = h.getLastRow();
  h.getRange(uf,1).setNumberFormat('dd/mm/yyyy HH:mm');
  h.getRange(uf,2).setNumberFormat('dd/mm/yyyy');
  if (uf % 2 === 0) h.getRange(uf,1,1,14).setBackground('#f0faf3');

  // Actualizar stock del lote en hoja LOTES
  actualizarStockLote(datos.slug, datos.lote, datos.totalKg||0);
  actualizarDashboard();
}

function actualizarStockLote(slug, lote, kgNuevos) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const h = _getHojaLotes(ss);
  if (h.getLastRow() < 2) return;
  const datos = h.getRange(2,1,h.getLastRow()-1,7).getValues();
  datos.forEach((r,i) => {
    if (r[0]===slug && r[2]===lote && String(r[3]).toUpperCase()==='ACTIVO') {
      const stockActual = parseFloat(h.getRange(i+2,7).getValue())||0;
      h.getRange(i+2,7).setValue(stockActual + kgNuevos);
    }
  });
}

// ── MENÚ MANUAL ──────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🥚 La Campestre')
    .addItem('Actualizar Dashboard', 'actualizarDashboard')
    .addItem('Ver links de productores', 'mostrarLinks')
    .addSeparator()
    .addItem('📋 Instrucciones', 'mostrarInstrucciones')
    .addToUi();
}

// ── MOSTRAR LINKS POR PRODUCTOR ───────────────────────────────
function mostrarLinks() {
  // Reemplaza BASE_URL con tu URL de GitHub Pages
  const BASE_URL = 'https://alazoe.github.io/Camprestre_alimento/';

  const slugs = {
    'Criadero Epulef':   'epulef-criadero',
    'Frank Epulef':      'epulef-frank',
    'Agrícola Ñanculén': 'nanculen',
    'Avícola Emplumados':'emplumados',
    'Juan Becerra':      'becerra',
    'Cristian Vergara':  'vergara',
    'Huevos Calibú':     'calibu',
    'Roberto Santelices':'santelices',
    'Juan Pablo Herrera':'herrera',
    'Copihue Real':      'copihue-real',
  };

  let msg = 'Links para cada productor:\n\n';
  Object.entries(slugs).forEach(([nombre, slug]) => {
    msg += `${nombre}:\n${BASE_URL}?p=${slug}\n\n`;
  });

  SpreadsheetApp.getUi().alert('Links de acceso', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

// ── INSTRUCCIONES ─────────────────────────────────────────────
function mostrarInstrucciones() {
  SpreadsheetApp.getUi().alert(
    '📋 Instrucciones del backend',
    `1. Este script recibe los registros de la app web
2. Los guarda en la hoja "REGISTROS"
3. Actualiza el DASHBOARD automáticamente

PARA PUBLICAR COMO APP WEB:
• Implementar → Nueva implementación
• Tipo: App web
• Ejecutar como: Yo
• Acceso: Cualquier persona
• Copia la URL y pégala en index.html

PARA AGREGAR PABELLONES A UN PRODUCTOR:
• Edita el objeto PRODUCTORES en index.html
• Agrega los nombres en el array "pabellones"

DASHBOARD:
• Se actualiza cada vez que llega un registro
• También puedes actualizarlo manualmente
• Alertas: 🔴 sin registrar ≥3 días, 🟡 ≥2 días, 🟢 OK`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
