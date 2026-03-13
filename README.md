# Contabilidad Desktop (Chile)

Base inicial para una aplicacion de escritorio de contabilidad multiempresa,
adaptada para Chile (RUT y CLP por defecto).

## Stack
- Electron
- React
- TypeScript
- SQLite (better-sqlite3)

## Estado actual
- Modulo Empresas funcional (crear, listar, eliminar).
- Empresa activa y edicion de datos base.
- Formulario adaptado a Chile (RUT y giro).
- Moneda por defecto CLP.
- Plan de cuentas base Chile y registro de asientos.
- Registro automatico en texto libre con interpretacion contable.
- Confirmacion tributaria previa cuando falta el tipo de documento.
- Reglas tributarias para factura, factura exenta, boleta, boleta exenta, boleta de honorarios y operaciones sin documento.
- Clasificacion adicional de servicios por contexto y giro para distinguir casos afectos y exentos basados en criterios SII.

## Modulos del roadmap
- Empresa activa
- Plan de cuentas
- Asientos
- Comprobantes
- Libro diario
- Libro mayor
- Balance general
- Estado de resultados

## Ejecutar en desarrollo
1. Instalar Node.js LTS.
2. Ejecutar npm install.
3. Ejecutar npm run dev.

Si PowerShell bloquea npm o no encuentra node, usar:
$nodeDir = "C:\Users\Nacho\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.14.0-win-x64"; $env:Path = "$nodeDir;$env:Path"; npm.cmd run build; npm.cmd run dev

## Build
- Ejecutar npm run build para compilar renderer y proceso principal de Electron.
- Build validado localmente con npm.cmd run build.

## Instalador Windows
- Ejecutar npm run dist:win para generar instalador NSIS en la carpeta release.
- Ejecutar npm run pack si quieres validar primero el paquete desempaquetado.
- El instalador crea acceso directo de escritorio y menu Inicio.

## Auto-actualizaciones (sin reinstalar manualmente)
- La app puede buscar y descargar actualizaciones automaticamente al iniciar.
- Para habilitarlo en produccion, define la variable de entorno del proceso:
	- CONTABILIDAD_UPDATE_URL="https://tu-servidor-updates/windows"
- En esa URL debes publicar los artefactos de cada release de Windows:
	- Contabilidad Desktop-Setup-<version>.exe
	- latest.yml
	- Contabilidad Desktop-Setup-<version>.exe.blockmap
- Flujo recomendado:
	1. Generar build firmado (o unsigned en pruebas).
	2. Subir los archivos anteriores al servidor de updates.
	3. Al abrir la app instalada, se buscara update automaticamente.
	4. La vista Soporte mostrara estado, progreso y notas de version.

### Variante profesional con GitHub Releases
- Tambien puedes usar GitHub Releases como proveedor de updates.
- Variables necesarias en la maquina del usuario final o en el entorno de la app:
	- CONTABILIDAD_GH_OWNER="tu-usuario-o-org"
	- CONTABILIDAD_GH_REPO="tu-repo"
- Script local para publicar a GitHub Releases:
	- npm.cmd run dist:win:github
- Variables necesarias para publicar:
	- GH_TOKEN o GITHUB_TOKEN
	- CONTABILIDAD_GH_OWNER
	- CONTABILIDAD_GH_REPO
- Workflow agregado:
	- .github/workflows/release-windows.yml
- Script agregado:
	- scripts/build-github-release.cjs

Notas:
- En este repo todavia no hay remoto GitHub configurado, por lo que la publicacion real en Releases no se puede ejecutar automaticamente hasta conectar el repo.
- Una vez exista remoto GitHub, el workflow puede publicar releases en cada tag v* o por ejecucion manual.

## Firma de codigo Windows (recomendado para distribucion)
- Build sin firma (local): npm run dist:win:unsigned
- Build con firma: npm run dist:win:signed
- Antes del build firmado define estas variables en PowerShell:
	- $env:CSC_LINK="C:/certs/contabilidad-signing.pfx"
	- $env:CSC_KEY_PASSWORD="tu-clave-del-certificado"
- Luego ejecuta:
	- npm.cmd run dist:win:signed

Notas:
- El script scripts/build-signed-win.cjs valida que CSC_LINK y CSC_KEY_PASSWORD existan antes de iniciar.
- El build firmado fuerza firma obligatoria para evitar publicar artefactos sin certificado por error.
- Si no tienes certificado aun, sigue usando dist:win:unsigned para pruebas internas.

## Mantenimiento y respaldo
- La app ahora muestra un bloque de soporte con version, modo de ejecucion y almacenamiento activo.
- Desde la interfaz puedes crear un respaldo del archivo de datos actual y abrir la carpeta de datos de Electron.
- La base principal se guarda en userData como contabilidad.db; si SQLite falla, la app usa contabilidad-fallback.json.
- Antes de actualizar o instalar una nueva version, crea un respaldo desde la misma app.

## Continuidad
- El resumen de continuidad del avance esta en RESUMEN_CONTINUIDAD.md.
