const APP = {
  name: 'Nativa',
  version: '1.2.0',
  lowStockDefault: 10,
  sheets: {
    CONFIG: ['Clave','Valor'],
    PRODUCTOS: ['ID','Nombre','PrecioCompra','PrecioVenta','Estado','FechaCreacion','FechaActualizacion'],
    HISTORIAL_PRECIOS: ['ID','ProductoID','FechaCambio','PrecioCompra','PrecioVenta'],
    CLIENTES: ['ID','Nombre','Telefono','Direccion','Estado','UltimaCompra','DiasRecordatorio','Observaciones','FechaCreacion'],
    BODEGAS: ['ID','Nombre','Direccion','Estado','FechaCreacion','FechaActualizacion'],
    PEDIDOS: ['ID','Fecha','ClienteID','ClienteNombre','ProductoID','ProductoNombre','Cantidad','PrecioVenta','PrecioCompraRef','BodegaID','BodegaNombre','Estado','Observaciones'],
    VENTAS: ['ID','FechaVenta','ClienteID','ClienteNombre','ProductoID','ProductoNombre','Cantidad','PrecioCompra','PrecioVenta','GananciaUnit','GananciaTotal','BodegaID','BodegaNombre'],
    MOVIMIENTOS: ['ID','Fecha','Tipo','ProductoID','ProductoNombre','Cantidad','BodegaOrigenID','BodegaOrigenNombre','BodegaDestinoID','BodegaDestinoNombre','ReferenciaID','Observaciones'],
    RECORDATORIOS: ['ID','ClienteID','ClienteNombre','Dias','ProximaFecha','UltimoContacto','Estado','Observaciones']
  }
};

/**
 * URL de la aplicación web.
 * IMPORTANTE: el proyecto debe contener un archivo HTML llamado "index".
 */
function doGet() {
  try {
    return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('Nativa · Distribuidora de Huevos')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
      'body{font-family:Arial,sans-serif;background:#f5f8fc;padding:30px;color:#10233e}' +
      '.box{max-width:720px;margin:auto;background:#fff;border-radius:18px;padding:24px;box-shadow:0 10px 35px rgba(0,0,0,.08)}' +
      'code{background:#eef4fb;padding:3px 6px;border-radius:6px}' +
      'h1{color:#0b2d5c}' +
      '</style></head><body><div class="box"><h1>NATIVA</h1>' +
      '<p>La aplicación web todavía no encuentra el archivo <code>index.html</code>.</p>' +
      '<p>En Apps Script crea un archivo <b>HTML</b> llamado exactamente <b>index</b> y pega allí el código de la interfaz de Nativa.</p>' +
      '<p>Detalle técnico: ' + escapeHtml_(err.message || String(err)) + '</p>' +
      '</div></body></html>'
    ).setTitle('Nativa · Configuración');
  }
}

/**
 * Se ejecuta una vez para preparar todas las hojas.
 *
 * Caso A: Apps Script creado desde Google Sheets:
 *   setupNativa();
 *
 * Caso B: proyecto independiente:
 *   setupNativa('ID_DE_TU_GOOGLE_SHEET');
 */
function setupNativa(spreadsheetId) {
  if (spreadsheetId !== undefined && spreadsheetId !== null && String(spreadsheetId).trim() !== '') {
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', String(spreadsheetId).trim());
  }

  const ss = getSpreadsheet_();
  Object.keys(APP.sheets).forEach(name => ensureSheet_(ss, name, APP.sheets[name]));
  formatSheets_(ss);

  // CONFIG
  const config = ss.getSheetByName('CONFIG');
  const existingConfig = readSheet_(config);
  const keys = existingConfig.map(r => String(r.Clave || ''));
  const defaults = [
    ['NOMBRE_NEGOCIO', APP.name],
    ['UMBRAL_STOCK_BAJO', APP.lowStockDefault]
  ];
  const missing = defaults.filter(r => !keys.includes(r[0]));
  if (missing.length) {
    config.getRange(config.getLastRow() + 1, 1, missing.length, 2).setValues(missing);
  }

  // BODEGA PRINCIPAL
  const warehouses = ss.getSheetByName('BODEGAS');
  if (warehouses.getLastRow() <= 1) {
    const now = now_();
    warehouses.appendRow([uid_('BOD'), 'Bodega Principal', '', 'Activo', now, now]);
  }

  // PRODUCTOS INICIALES
  const products = ss.getSheetByName('PRODUCTOS');
  if (products.getLastRow() <= 1) {
    const now = now_();
    const defaultsProducts = [
      [uid_('PRO'), 'Huevo Doble A (AA)', 0, 0, 'Activo', now, now],
      [uid_('PRO'), 'Huevo Triple A (AAA)', 0, 0, 'Activo', now, now]
    ];
    products.getRange(2, 1, defaultsProducts.length, defaultsProducts[0].length).setValues(defaultsProducts);

    const hist = ss.getSheetByName('HISTORIAL_PRECIOS');
    defaultsProducts.forEach(p => hist.appendRow([uid_('HPR'), p[0], now, p[2], p[3]]));
  }

  SpreadsheetApp.flush();
  return {
    ok: true,
    message: 'Nativa quedó configurada correctamente.',
    spreadsheetId: ss.getId(),
    spreadsheetUrl: ss.getUrl(),
    sheets: Object.keys(APP.sheets)
  };
}

/**
 * Menú opcional en Google Sheets.
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('Nativa')
      .addItem('Configurar sistema', 'setupNativa')
      .addItem('Probar conexión', 'testNativa')
      .addToUi();
  } catch (e) {
    // Si el proyecto no está vinculado a una hoja, simplemente no crea menú.
  }
}

function testNativa() {
  const ss = getSpreadsheet_();
  Object.keys(APP.sheets).forEach(name => ensureSheet_(ss, name, APP.sheets[name]));
  const state = buildState_();
  return {
    ok: true,
    negocio: APP.name,
    spreadsheetId: ss.getId(),
    spreadsheetUrl: ss.getUrl(),
    productos: state.productos.length,
    clientes: state.clientes.length,
    bodegas: state.bodegas.length
  };
}

function getInitialData() {
  const ss = getSpreadsheet_();
  Object.keys(APP.sheets).forEach(name => ensureSheet_(ss, name, APP.sheets[name]));
  return buildState_();
}

// ==============================
// PRODUCTOS Y PRECIOS
// ==============================
function createProduct(data) {
  requireFields_(data, ['nombre','precioCompra','precioVenta']);
  const ss = getSpreadsheet_();
  const now = now_();
  const id = uid_('PRO');
  const row = [
    id,
    clean_(data.nombre),
    num_(data.precioCompra),
    num_(data.precioVenta),
    data.estado === 'Inactivo' ? 'Inactivo' : 'Activo',
    now,
    now
  ];

  withLock_(() => {
    ss.getSheetByName('PRODUCTOS').appendRow(row);
    ss.getSheetByName('HISTORIAL_PRECIOS').appendRow([uid_('HPR'), id, now, row[2], row[3]]);
  });

  return buildState_();
}

function updateProduct(data) {
  requireFields_(data, ['id','nombre','precioCompra','precioVenta']);
  const ss = getSpreadsheet_();

  return withLock_(() => {
    const sh = ss.getSheetByName('PRODUCTOS');
    const values = sh.getDataRange().getValues();

    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(data.id)) {
        const oldBuy = num_(values[i][2]);
        const oldSell = num_(values[i][3]);
        const newBuy = num_(data.precioCompra);
        const newSell = num_(data.precioVenta);
        const now = now_();

        values[i][1] = clean_(data.nombre);
        values[i][2] = newBuy;
        values[i][3] = newSell;
        values[i][4] = data.estado === 'Inactivo' ? 'Inactivo' : 'Activo';
        values[i][6] = now;

        sh.getRange(i + 1, 1, 1, values[i].length).setValues([values[i]]);

        // Solo se crea un registro si realmente cambió alguno de los precios.
        if (oldBuy !== newBuy || oldSell !== newSell) {
          ss.getSheetByName('HISTORIAL_PRECIOS')
            .appendRow([uid_('HPR'), data.id, now, newBuy, newSell]);
        }

        return buildState_();
      }
    }

    throw new Error('Producto no encontrado.');
  });
}

// ==============================
// CLIENTES
// ==============================
function createClient(data) {
  requireFields_(data, ['nombre']);
  const ss = getSpreadsheet_();
  const now = now_();
  const days = num_(data.diasRecordatorio || 0);
  const id = uid_('CLI');

  const row = [
    id,
    clean_(data.nombre),
    clean_(data.telefono),
    clean_(data.direccion),
    data.estado === 'Inactivo' ? 'Inactivo' : 'Activo',
    '',
    days,
    clean_(data.observaciones),
    now
  ];

  withLock_(() => {
    ss.getSheetByName('CLIENTES').appendRow(row);
    if (days > 0) upsertReminder_(id, days, 'Pendiente', data.observaciones);
  });

  return buildState_();
}

function updateClient(data) {
  requireFields_(data, ['id','nombre']);
  const ss = getSpreadsheet_();

  return withLock_(() => {
    const sh = ss.getSheetByName('CLIENTES');
    const vals = sh.getDataRange().getValues();
    let found = false;

    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][0]) === String(data.id)) {
        vals[i][1] = clean_(data.nombre);
        vals[i][2] = clean_(data.telefono);
        vals[i][3] = clean_(data.direccion);
        vals[i][4] = data.estado === 'Inactivo' ? 'Inactivo' : 'Activo';
        vals[i][6] = num_(data.diasRecordatorio || 0);
        vals[i][7] = clean_(data.observaciones);
        sh.getRange(i + 1, 1, 1, vals[i].length).setValues([vals[i]]);
        found = true;
        break;
      }
    }

    if (!found) throw new Error('Cliente no encontrado.');

    const days = num_(data.diasRecordatorio || 0);
    if (days > 0) {
      upsertReminder_(data.id, days, 'Pendiente', data.observaciones);
    } else {
      deleteReminder_(data.id);
    }

    return buildState_();
  });
}

// ==============================
// BODEGAS
// ==============================
function createWarehouse(data) {
  requireFields_(data, ['nombre']);
  const ss = getSpreadsheet_();
  const now = now_();

  withLock_(() => {
    ss.getSheetByName('BODEGAS').appendRow([
      uid_('BOD'),
      clean_(data.nombre),
      clean_(data.direccion),
      data.estado === 'Inactivo' ? 'Inactivo' : 'Activo',
      now,
      now
    ]);
  });

  return buildState_();
}

function updateWarehouse(data) {
  requireFields_(data, ['id','nombre']);
  const ss = getSpreadsheet_();

  return withLock_(() => {
    const sh = ss.getSheetByName('BODEGAS');
    const vals = sh.getDataRange().getValues();

    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][0]) === String(data.id)) {
        vals[i][1] = clean_(data.nombre);
        vals[i][2] = clean_(data.direccion);
        vals[i][3] = data.estado === 'Inactivo' ? 'Inactivo' : 'Activo';
        vals[i][5] = now_();
        sh.getRange(i + 1, 1, 1, vals[i].length).setValues([vals[i]]);
        return buildState_();
      }
    }

    throw new Error('Bodega no encontrada.');
  });
}

// ==============================
// INVENTARIO / MOVIMIENTOS
// ==============================
function registerEntry(data) {
  requireFields_(data, ['productoId','bodegaId','cantidad']);
  const qty = num_(data.cantidad);
  if (qty <= 0) throw new Error('La cantidad debe ser mayor que cero.');

  const product = findById_('PRODUCTOS', data.productoId);
  const wh = findById_('BODEGAS', data.bodegaId);

  withLock_(() => {
    appendMovement_('ENTRADA', product, qty, null, wh, data.observaciones, data.referenciaId || '');
  });

  return buildState_();
}

function registerTransfer(data) {
  requireFields_(data, ['productoId','origenId','destinoId','cantidad']);
  if (String(data.origenId) === String(data.destinoId)) {
    throw new Error('La bodega de origen y destino deben ser diferentes.');
  }

  const qty = num_(data.cantidad);
  if (qty <= 0) throw new Error('La cantidad debe ser mayor que cero.');

  const product = findById_('PRODUCTOS', data.productoId);
  const origin = findById_('BODEGAS', data.origenId);
  const dest = findById_('BODEGAS', data.destinoId);

  withLock_(() => {
    const stock = getStockValue_(data.productoId, data.origenId);
    if (stock < qty) {
      throw new Error('Inventario insuficiente en la bodega de origen. Disponible: ' + stock);
    }

    const ref = uid_('TRF');
    appendMovement_('TRANSFERENCIA_SALIDA', product, qty, origin, null, data.observaciones, ref);
    appendMovement_('TRANSFERENCIA_ENTRADA', product, qty, null, dest, data.observaciones, ref);
  });

  return buildState_();
}

// ==============================
// VENTAS
// ==============================
function registerSale(data) {
  return withLock_(() => {
    registerSaleLocked_(data);
    return buildState_();
  });
}

function registerSaleLocked_(data) {
  requireFields_(data, ['clienteId','productoId','bodegaId','cantidad']);

  const qty = num_(data.cantidad);
  if (qty <= 0) throw new Error('La cantidad debe ser mayor que cero.');

  const ss = getSpreadsheet_();
  const product = findById_('PRODUCTOS', data.productoId);
  const client = findById_('CLIENTES', data.clienteId);
  const wh = findById_('BODEGAS', data.bodegaId);

  // Los precios se copian a la venta.
  // Así, cambiar PRODUCTOS después NO altera el histórico.
  const currentBuy = num_(product.PrecioCompra);
  const currentSell = num_(product.PrecioVenta);
  const buy = data.precioCompra === '' || data.precioCompra == null ? currentBuy : num_(data.precioCompra);
  const sell = data.precioVenta === '' || data.precioVenta == null ? currentSell : num_(data.precioVenta);

  const gainUnit = sell - buy;
  const gainTotal = gainUnit * qty;
  const dateValue = parseDateInput_(data.fechaVenta) || new Date();

  const stock = getStockValue_(data.productoId, data.bodegaId);
  if (stock < qty) {
    throw new Error('Inventario insuficiente en la bodega seleccionada. Disponible: ' + stock);
  }

  const saleId = uid_('VEN');

  ss.getSheetByName('VENTAS').appendRow([
    saleId,
    dateValue,
    client.ID,
    client.Nombre,
    product.ID,
    product.Nombre,
    qty,
    buy,
    sell,
    gainUnit,
    gainTotal,
    wh.ID,
    wh.Nombre
  ]);

  appendMovement_('SALIDA_VENTA', product, qty, wh, null, 'Venta ' + saleId, saleId);
  touchClientAfterSale_(client.ID, dateValue);

  return saleId;
}

// ==============================
// PEDIDOS
// ==============================
function createOrder(data) {
  requireFields_(data, ['clienteId','productoId','bodegaId','cantidad']);

  const qty = num_(data.cantidad);
  if (qty <= 0) throw new Error('La cantidad debe ser mayor que cero.');

  const ss = getSpreadsheet_();
  const product = findById_('PRODUCTOS', data.productoId);
  const client = findById_('CLIENTES', data.clienteId);
  const wh = findById_('BODEGAS', data.bodegaId);
  const sell = data.precioVenta === '' || data.precioVenta == null
    ? num_(product.PrecioVenta)
    : num_(data.precioVenta);
  const buy = num_(product.PrecioCompra);
  const dateValue = parseDateInput_(data.fecha) || new Date();
  const status = ['Pendiente','Entregado','Cancelado'].includes(String(data.estado))
    ? String(data.estado)
    : 'Pendiente';

  return withLock_(() => {
    ss.getSheetByName('PEDIDOS').appendRow([
      uid_('PED'),
      dateValue,
      client.ID,
      client.Nombre,
      product.ID,
      product.Nombre,
      qty,
      sell,
      buy,
      wh.ID,
      wh.Nombre,
      status,
      clean_(data.observaciones)
    ]);

    return buildState_();
  });
}

function updateOrderStatus(data) {
  requireFields_(data, ['id','estado']);

  return withLock_(() => {
    const ss = getSpreadsheet_();
    const sh = ss.getSheetByName('PEDIDOS');
    const vals = sh.getDataRange().getValues();

    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][0]) === String(data.id)) {
        const oldStatus = String(vals[i][11]);
        const newStatus = String(data.estado);

        if (!['Pendiente','Entregado','Cancelado'].includes(newStatus)) {
          throw new Error('Estado de pedido no válido.');
        }

        if (oldStatus === 'Entregado' && newStatus !== 'Entregado') {
          throw new Error('Un pedido entregado no puede volver automáticamente a otro estado.');
        }

        // Entregar = crear la venta + descontar inventario + cambiar estado.
        // Todo se ejecuta bajo el mismo LockService.
        if (newStatus === 'Entregado' && oldStatus !== 'Entregado') {
          registerSaleLocked_({
            clienteId: vals[i][2],
            productoId: vals[i][4],
            bodegaId: vals[i][9],
            cantidad: vals[i][6],
            precioVenta: vals[i][7],
            precioCompra: vals[i][8],
            fechaVenta: formatDateForInput_(vals[i][1])
          });
        }

        vals[i][11] = newStatus;
        sh.getRange(i + 1, 1, 1, vals[i].length).setValues([vals[i]]);
        return buildState_();
      }
    }

    throw new Error('Pedido no encontrado.');
  });
}

// ==============================
// RECORDATORIOS
// ==============================
function saveReminder(data) {
  requireFields_(data, ['clienteId','dias']);
  const days = num_(data.dias);
  if (days <= 0) throw new Error('Los días del recordatorio deben ser mayores que cero.');

  const client = findById_('CLIENTES', data.clienteId);
  return withLock_(() => {
    upsertReminder_(client.ID, days, data.estado || 'Pendiente', data.observaciones);
    return buildState_();
  });
}

function markReminderDone(data) {
  requireFields_(data, ['id']);
  const ss = getSpreadsheet_();

  return withLock_(() => {
    const sh = ss.getSheetByName('RECORDATORIOS');
    const vals = sh.getDataRange().getValues();

    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][0]) === String(data.id)) {
        const days = num_(vals[i][3]);
        if (days <= 0) throw new Error('El recordatorio no tiene una periodicidad válida.');

        const contactDate = new Date();
        const next = new Date(contactDate);
        next.setDate(next.getDate() + days);

        vals[i][5] = contactDate;
        vals[i][4] = next;
        vals[i][6] = 'Pendiente';
        sh.getRange(i + 1, 1, 1, vals[i].length).setValues([vals[i]]);

        return buildState_();
      }
    }

    throw new Error('Recordatorio no encontrado.');
  });
}

// ==============================
// REPORTES
// ==============================
function getReports(filters) {
  const state = buildState_();
  let sales = state.ventas.slice();
  const f = filters || {};

  const start = parseDateInput_(f.start, false);
  const end = parseDateInput_(f.end, true);

  if (start) sales = sales.filter(v => new Date(v.FechaVenta) >= start);
  if (end) sales = sales.filter(v => new Date(v.FechaVenta) <= end);
  if (f.clienteId) sales = sales.filter(v => String(v.ClienteID) === String(f.clienteId));
  if (f.productoId) sales = sales.filter(v => String(v.ProductoID) === String(f.productoId));
  if (f.bodegaId) sales = sales.filter(v => String(v.BodegaID) === String(f.bodegaId));

  const totals = sales.reduce((a, v) => {
    const qty = num_(v.Cantidad);
    const sell = num_(v.PrecioVenta);
    const buy = num_(v.PrecioCompra);
    const gain = num_(v.GananciaTotal);

    a.unidades += qty;
    a.ingresos += sell * qty;
    a.costos += buy * qty;
    a.ganancia += gain;
    return a;
  }, {unidades:0, ingresos:0, costos:0, ganancia:0});

  return {
    sales: sales,
    totals: totals,
    byClient: groupSales_(sales, 'ClienteID', 'ClienteNombre'),
    byProduct: groupSales_(sales, 'ProductoID', 'ProductoNombre'),
    byWarehouse: groupSales_(sales, 'BodegaID', 'BodegaNombre')
  };
}

// ==============================
// ESTADO PRINCIPAL
// ==============================
function buildState_() {
  const ss = getSpreadsheet_();
  Object.keys(APP.sheets).forEach(name => ensureSheet_(ss, name, APP.sheets[name]));

  const state = {
    productos: readSheet_(ss.getSheetByName('PRODUCTOS')),
    clientes: readSheet_(ss.getSheetByName('CLIENTES')),
    bodegas: readSheet_(ss.getSheetByName('BODEGAS')),
    pedidos: readSheet_(ss.getSheetByName('PEDIDOS')),
    ventas: readSheet_(ss.getSheetByName('VENTAS')),
    movimientos: readSheet_(ss.getSheetByName('MOVIMIENTOS')),
    recordatorios: readSheet_(ss.getSheetByName('RECORDATORIOS')),
    historialPrecios: readSheet_(ss.getSheetByName('HISTORIAL_PRECIOS'))
  };

  const inventory = computeInventory_(state.productos, state.bodegas, state.movimientos);
  state.inventario = inventory.rows;
  state.dashboard = buildDashboard_(state, inventory);
  state.meta = {
    name: APP.name,
    version: APP.version,
    spreadsheetId: ss.getId(),
    spreadsheetUrl: ss.getUrl()
  };

  return state;
}

function computeInventory_(products, warehouses, movements) {
  const map = {};

  products.forEach(p => {
    warehouses.forEach(w => {
      map[p.ID + '|' + w.ID] = 0;
    });
  });

  movements.forEach(m => {
    const qty = num_(m.Cantidad);
    const keyDest = String(m.ProductoID) + '|' + String(m.BodegaDestinoID || '');
    const keyOrig = String(m.ProductoID) + '|' + String(m.BodegaOrigenID || '');

    if (m.Tipo === 'ENTRADA' || m.Tipo === 'TRANSFERENCIA_ENTRADA' || m.Tipo === 'AJUSTE_POSITIVO') {
      map[keyDest] = (map[keyDest] || 0) + qty;
    }

    if (m.Tipo === 'SALIDA_VENTA' || m.Tipo === 'TRANSFERENCIA_SALIDA' || m.Tipo === 'AJUSTE_NEGATIVO') {
      map[keyOrig] = (map[keyOrig] || 0) - qty;
    }
  });

  const rows = [];
  products.forEach(p => {
    warehouses.forEach(w => {
      rows.push({
        productoId: p.ID,
        productoNombre: p.Nombre,
        bodegaId: w.ID,
        bodegaNombre: w.Nombre,
        cantidad: num_(map[p.ID + '|' + w.ID] || 0)
      });
    });
  });

  return {rows: rows, map: map};
}

function buildDashboard_(state, inventory) {
  const now = new Date();
  const todayKey = formatDateOnly_(now);
  const monthKey = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM');

  const today = state.ventas.filter(v => formatDateOnly_(v.FechaVenta) === todayKey);
  const month = state.ventas.filter(v => formatDateOnly_(v.FechaVenta).slice(0, 7) === monthKey);

  const totalStock = inventory.rows.reduce((s, r) => s + Math.max(0, num_(r.cantidad)), 0);
  const threshold = num_(getConfig_('UMBRAL_STOCK_BAJO') || APP.lowStockDefault);

  const stockByProduct = {};
  inventory.rows.forEach(r => {
    stockByProduct[r.productoId] = (stockByProduct[r.productoId] || 0) + num_(r.cantidad);
  });

  const lowStock = state.productos
    .filter(p => p.Estado === 'Activo' && num_(stockByProduct[p.ID]) <= threshold)
    .map(p => ({
      productoId: p.ID,
      productoNombre: p.Nombre,
      cantidad: num_(stockByProduct[p.ID]),
      threshold: threshold
    }));

  const dueReminders = state.recordatorios.filter(r => {
    if (r.Estado === 'Hecho' || !r.ProximaFecha) return false;
    const d = new Date(r.ProximaFecha);
    return !isNaN(d.getTime()) && d <= now;
  });

  return {
    todaySales: sumRevenue_(today),
    monthSales: sumRevenue_(month),
    todayProfit: sumProfit_(today),
    monthProfit: sumProfit_(month),
    todayUnits: sumUnits_(today),
    monthUnits: sumUnits_(month),
    totalStock: totalStock,
    pendingOrders: state.pedidos.filter(p => p.Estado === 'Pendiente').length,
    dueReminders: dueReminders.length,
    lowStock: lowStock
  };
}

function groupSales_(sales, idField, nameField) {
  const m = {};

  sales.forEach(v => {
    const id = v[idField] || 'SIN_ID';
    if (!m[id]) {
      m[id] = {
        id: id,
        nombre: v[nameField] || 'Sin nombre',
        unidades: 0,
        ingresos: 0,
        costos: 0,
        ganancia: 0
      };
    }

    const qty = num_(v.Cantidad);
    m[id].unidades += qty;
    m[id].ingresos += num_(v.PrecioVenta) * qty;
    m[id].costos += num_(v.PrecioCompra) * qty;
    m[id].ganancia += num_(v.GananciaTotal);
  });

  return Object.values(m).sort((a, b) => b.ganancia - a.ganancia);
}

function sumRevenue_(rows) {
  return rows.reduce((s, v) => s + num_(v.PrecioVenta) * num_(v.Cantidad), 0);
}

function sumProfit_(rows) {
  return rows.reduce((s, v) => s + num_(v.GananciaTotal), 0);
}

function sumUnits_(rows) {
  return rows.reduce((s, v) => s + num_(v.Cantidad), 0);
}

// ==============================
// MOVIMIENTOS
// ==============================
function appendMovement_(type, product, qty, origin, dest, observations, ref) {
  const sh = getSpreadsheet_().getSheetByName('MOVIMIENTOS');

  sh.appendRow([
    uid_('MOV'),
    now_(),
    type,
    product.ID,
    product.Nombre,
    qty,
    origin ? origin.ID : '',
    origin ? origin.Nombre : '',
    dest ? dest.ID : '',
    dest ? dest.Nombre : '',
    ref || '',
    clean_(observations)
  ]);
}

function getStockValue_(productId, warehouseId) {
  const sh = getSpreadsheet_().getSheetByName('MOVIMIENTOS');
  const vals = sh.getDataRange().getValues();
  let total = 0;

  for (let i = 1; i < vals.length; i++) {
    const row = vals[i];
    const type = String(row[2]);
    const p = String(row[3]);
    const qty = num_(row[5]);

    if (p !== String(productId)) continue;

    if (
      (type === 'ENTRADA' || type === 'TRANSFERENCIA_ENTRADA' || type === 'AJUSTE_POSITIVO') &&
      String(row[8]) === String(warehouseId)
    ) {
      total += qty;
    }

    if (
      (type === 'SALIDA_VENTA' || type === 'TRANSFERENCIA_SALIDA' || type === 'AJUSTE_NEGATIVO') &&
      String(row[6]) === String(warehouseId)
    ) {
      total -= qty;
    }
  }

  return total;
}

// ==============================
// CLIENTE DESPUÉS DE UNA VENTA
// ==============================
function touchClientAfterSale_(clientId, dateValue) {
  const ss = getSpreadsheet_();
  const sh = ss.getSheetByName('CLIENTES');
  const vals = sh.getDataRange().getValues();

  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === String(clientId)) {
      vals[i][5] = dateValue;
      sh.getRange(i + 1, 1, 1, vals[i].length).setValues([vals[i]]);

      const days = num_(vals[i][6]);
      if (days > 0) {
        upsertReminder_(clientId, days, 'Pendiente');
      }
      break;
    }
  }
}

// ==============================
// RECORDATORIOS INTERNOS
// ==============================
function upsertReminder_(clientId, days, status, observations) {
  const client = findById_('CLIENTES', clientId);
  const sh = getSpreadsheet_().getSheetByName('RECORDATORIOS');
  const vals = sh.getDataRange().getValues();

  const base = client.UltimaCompra ? new Date(client.UltimaCompra) : new Date();
  const next = new Date(base);
  next.setDate(next.getDate() + days);

  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][1]) === String(clientId)) {
      vals[i][2] = client.Nombre;
      vals[i][3] = days;
      vals[i][4] = next;
      vals[i][6] = status || 'Pendiente';
      if (observations !== undefined && observations !== null) {
        vals[i][7] = clean_(observations);
      }
      sh.getRange(i + 1, 1, 1, vals[i].length).setValues([vals[i]]);
      return;
    }
  }

  sh.appendRow([
    uid_('REC'),
    client.ID,
    client.Nombre,
    days,
    next,
    '',
    status || 'Pendiente',
    clean_(observations)
  ]);
}

function deleteReminder_(clientId) {
  const sh = getSpreadsheet_().getSheetByName('RECORDATORIOS');
  const vals = sh.getDataRange().getValues();

  for (let i = vals.length - 1; i >= 1; i--) {
    if (String(vals[i][1]) === String(clientId)) {
      sh.deleteRow(i + 1);
    }
  }
}

// ==============================
// UTILIDADES GOOGLE SHEETS
// ==============================
function getSpreadsheet_() {
  const storedId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');

  if (storedId) {
    try {
      return SpreadsheetApp.openById(storedId);
    } catch (err) {
      throw new Error('No se pudo abrir el Google Sheet guardado. Revisa SPREADSHEET_ID. Detalle: ' + err.message);
    }
  }

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;

  throw new Error(
    'No hay un Google Sheet conectado. Ejecuta setupNativa("ID_DE_TU_GOOGLE_SHEET") una vez, ' +
    'o crea este proyecto de Apps Script desde Google Sheets: Extensiones → Apps Script.'
  );
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const current = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    if (current.join('|') !== headers.join('|')) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }

  sh.setFrozenRows(1);
  return sh;
}

function formatSheets_(ss) {
  Object.keys(APP.sheets).forEach(name => {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, APP.sheets[name].length).setFontWeight('bold');
    sh.autoResizeColumns(1, APP.sheets[name].length);
  });
}

function readSheet_(sh) {
  if (!sh) return [];
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];

  const heads = values[0];
  return values
    .slice(1)
    .filter(r => r.some(v => v !== ''))
    .map(r => {
      const o = {};
      heads.forEach((h, i) => o[h] = serialize_(r[i]));
      return o;
    });
}

function findById_(sheetName, id) {
  const rows = readSheet_(getSpreadsheet_().getSheetByName(sheetName));
  const row = rows.find(r => String(r.ID) === String(id));
  if (!row) throw new Error('Registro no encontrado: ' + sheetName + ' / ' + id);
  return row;
}

function getConfig_(key) {
  const sh = getSpreadsheet_().getSheetByName('CONFIG');
  if (!sh) return '';
  const rows = readSheet_(sh);
  const item = rows.find(r => String(r.Clave) === String(key));
  return item ? item.Valor : '';
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function requireFields_(obj, fields) {
  fields.forEach(f => {
    if (obj == null || obj[f] == null || String(obj[f]).trim() === '') {
      throw new Error('Falta el campo: ' + f);
    }
  });
}

function clean_(v) {
  return v == null ? '' : String(v).trim();
}

function num_(v) {
  if (typeof v === 'string') {
    const normalized = v.replace(/\./g, '').replace(',', '.');
    const n = Number(normalized);
    return isFinite(n) ? n : 0;
  }
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

function uid_(prefix) {
  return prefix + '-' +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss') + '-' +
    Math.random().toString(36).slice(2, 7).toUpperCase();
}

function now_() {
  return new Date();
}

function serialize_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(
      v,
      Session.getScriptTimeZone(),