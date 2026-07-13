@echo off
setlocal
cd /d "%~dp0"
title Mareas - Acceso seguro a Supabase

echo.
echo ============================================================
echo   MAREAS - ACTIVAR SINCRONIZACION PRIVADA
echo ============================================================
echo.
echo Se abrira el acceso oficial de Supabase en tu navegador.
echo No pegues claves ni contrasenas en ningun chat.
echo.

call npx supabase login
if errorlevel 1 (
  echo.
  echo No se completo el acceso. Puedes cerrar esta ventana y probar de nuevo.
  pause
  exit /b 1
)

echo.
echo Acceso completado. Vuelve a Codex y escribe: listo
echo.
pause
