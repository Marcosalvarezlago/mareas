@echo off
title Mareas - version web (en este ordenador)
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
echo.
echo   ===============================================
echo    MAREAS - abriendo en el navegador del PC...
echo    Se abrira solo en tu navegador. No necesitas
echo    el movil ni Expo Go para esto.
echo    (Deja esta ventana abierta mientras la uses.)
echo   ===============================================
echo.
if not exist ".\node_modules\.bin\expo.cmd" (
  echo [ERROR] Faltan las dependencias locales de Mareas.
  echo No se descargara nada sin tu autorizacion.
  pause
  exit /b 1
)
call ".\node_modules\.bin\expo.cmd" start --web
pause
