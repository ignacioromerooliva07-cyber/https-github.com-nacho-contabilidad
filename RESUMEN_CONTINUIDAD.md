# Resumen de continuidad - Contabilidad Desktop

Fecha: 12-03-2026
Proyecto: App de escritorio contable para PYMEs (Chile)
Stack: Electron + React + TypeScript + SQLite (better-sqlite3)

## Estado actual
- Proyecto base creado y compilando sin errores de TypeScript.
- Modulo Empresas funcional: crear, listar y eliminar.
- Interfaz adaptada a Chile: RUT y moneda CLP por defecto.
- Se agrego compatibilidad temporal rut/cuit para evitar fallos entre versiones mezcladas.
- Se agregaron mensajes de error mas claros en frontend.

## Archivos principales del avance
- electron/main.ts: ventana, ciclo de app, handlers IPC de empresa.
- electron/preload.ts: API segura expuesta al frontend.
- electron/db.ts: inicializacion DB, tablas, operaciones de empresa.
- src/App.tsx: pantalla de Empresas (formulario + listado + eliminar).
- src/vite-env.d.ts: tipos globales de API y Empresa.
- src/styles.css: estilos de la UI actual.

## Problemas que ya resolvimos
- Errores masivos de modulos/types por dependencias no instaladas.
- Falta de package.json en un punto del proceso.
- Bloqueos de npm en PowerShell por PATH/politica de scripts.
- Fallo de creacion de empresa por desalineacion de campos rut/cuit.

## Comando recomendado para arrancar
- En PowerShell, si npm/node no responde por PATH, usar:
$nodeDir = "C:\Users\Nacho\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.14.0-win-x64"; $env:Path = "$nodeDir;$env:Path"; npm.cmd run build; npm.cmd run dev

## Proximo paso sugerido (prioridad)
1) Empresa activa (seleccionar la empresa de trabajo).
2) Plan de cuentas base chileno.
3) Asientos contables (debe/haber con validacion).
4) Libro diario y mayor.

## Nota de continuidad para nuevo chat
Si se abre un chat nuevo, pegar este resumen y pedir:
"Continuar desde Empresa activa y Plan de Cuentas base chileno, manteniendo lo ya implementado."
