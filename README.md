# Nativa · Distribuidora de Huevos

Sistema administrativo mobile-first para Nativa, construido con Google Apps Script + Google Sheets.

## Qué incluye

- Dashboard operativo con KPIs de ventas, ganancia, pedidos e inventario.
- Gráfica diaria de ingresos y costos de los últimos 30 días.
- Mix dinámico de productos más vendidos.
- Actividad y productos recientes.
- Alertas de stock bajo, pedidos pendientes y clientes por contactar.
- Gestión de ventas con precios históricos protegidos.
- Pedidos con flujo **Pendiente → Entregado → Venta**.
- Inventario por bodega con entradas y transferencias.
- Clientes con historial y recordatorios de recompra.
- Productos y precios con historial de cambios.
- Reportes filtrables por fecha, cliente, producto y bodega.
- Interfaz responsive para escritorio, tablet y celular.

## Estructura

- `index.html`: frontend completo de la aplicación.
- `Code.gs`: backend, reglas de negocio, integración con Google Sheets y API para el dashboard.
- `appsscript.json`: configuración de la aplicación web.

## Hojas utilizadas

`CONFIG`, `PRODUCTOS`, `HISTORIAL_PRECIOS`, `CLIENTES`, `BODEGAS`, `PEDIDOS`, `VENTAS`, `MOVIMIENTOS`, `RECORDATORIOS`.

La estructura conserva el histórico de precios: una venta guarda el precio de compra, precio de venta y ganancia utilizados en el momento de registrarla.

## Dashboard

La versión actual usa datos reales del backend para construir:

- Ventas del mes.
- Ganancia del mes.
- Pedidos pendientes.
- Inventario disponible.
- Evolución diaria de ventas y costos.
- Productos más vendidos.
- Productos recientemente creados.
- Alertas operativas.

El frontend no depende de datos ficticios para estos bloques.

## Instalación

1. Crea un proyecto de Apps Script desde Google Sheets con **Extensiones → Apps Script**, o utiliza un proyecto independiente.
2. Añade `Code.gs`, `index.html` y `appsscript.json`.
3. Si el proyecto es independiente, ejecuta `setupNativa("ID_DEL_SHEET")`. Si está vinculado a la hoja, ejecuta `setupNativa()`.
4. Autoriza los permisos solicitados.
5. Publica el proyecto como **Aplicación web**.
6. Después de cada cambio de código, crea una nueva versión de la implementación web para que la interfaz publicada tome los cambios.

## Backend

Versión actual: **1.4.0**.

Funciones destacadas:

- `getInitialData()`
- `getDashboardSeries({days})`
- `getDashboardInsights({days})`
- `getReports(filters)`
- `registerSale(data)`
- `createOrder(data)`
- `updateOrderStatus(data)`
- `registerEntry(data)`
- `registerTransfer(data)`

Las operaciones de inventario y ventas utilizan `LockService` para reducir conflictos cuando hay acciones concurrentes.

## Diseño

La interfaz toma como referencia paneles administrativos de inventario, ventas y cotización: navegación lateral, KPIs destacados, tablas operativas, estados por color, acciones rápidas y diseño responsive. La identidad visual de Nativa se centra en una paleta azul con fondos claros y contrastes de azul oscuro.

## Licencia

Proyecto de trabajo de Nativa / SM Estudios.
