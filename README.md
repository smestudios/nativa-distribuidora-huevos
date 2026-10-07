# Nativa · Distribuidora de Huevos

Aplicación administrativa mobile-first para gestionar productos, precios, clientes, pedidos, ventas, inventario, bodegas, reportes y recordatorios de recompra.

## Estructura

- `index.html`: interfaz web de Nativa.
- `Code.gs`: backend para Google Apps Script + Google Sheets.
- `appsscript.json`: configuración recomendada del proyecto Apps Script.

## Google Sheets

El backend crea y utiliza estas hojas:

`CONFIG`, `PRODUCTOS`, `HISTORIAL_PRECIOS`, `CLIENTES`, `BODEGAS`, `PEDIDOS`, `VENTAS`, `MOVIMIENTOS`, `RECORDATORIOS`.

Cada venta guarda el precio de compra, precio de venta y ganancia utilizados en ese momento, por lo que modificar los precios actuales no altera el historial.

## Instalación en Apps Script

1. Crea un proyecto desde Google Sheets con **Extensiones → Apps Script**, o utiliza un proyecto independiente.
2. Añade `Code.gs` e `index.html`.
3. Si el proyecto es independiente, ejecuta `setupNativa("ID_DEL_SHEET")`. Si está vinculado a la hoja, ejecuta `setupNativa()`.
4. Autoriza los permisos solicitados.
5. Publica como **Aplicación web**.

## Interfaz

La interfaz está diseñada para uso desde celular y escritorio, con navegación por módulos, dashboard, formularios, inventario por bodega y reportes.

## Licencia

Proyecto privado de trabajo de Nativa / SM Estudios.
