@echo off
setlocal
cd /d "%~dp0"
title Mareas - Acceso seguro a Supabase

echo.
echo ============================================================
echo   MAREAS - ACTIVAR SINCRONIZACION PRIVADA
echo ============================================================
echo.
echo Usaremos el metodo oficial con un token personal y entrada segura.
echo.
echo 1. En la pagina que se abrira, inicia sesion en Supabase.
echo 2. Pulsa "Generate new token" y llamalo: Mareas Codex.
echo 3. Copia el token y vuelve a esta ventana.
echo 4. Espera al mensaje "PEGA AQUI EL NUEVO TOKEN".
echo 5. Pegalo con Ctrl+V y pulsa Intro.
echo.
echo IMPORTANTE: al pegarlo no se vera ningun caracter. Es normal.
echo No compartas el token en ningun chat ni lo guardes en el proyecto.
echo.
start "" "https://supabase.com/dashboard/account/tokens"

call powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\supabase-login.ps1"
if errorlevel 1 (
  echo.
  echo No se completo el acceso. Puedes cerrar esta ventana y probar de nuevo.
  pause
  exit /b 1
)

echo.
echo Acceso completado y verificado. Vuelve a Codex y escribe: listo
echo.
pause
