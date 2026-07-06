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
npx expo start --web
pause
