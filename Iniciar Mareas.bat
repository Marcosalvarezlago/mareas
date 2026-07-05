@echo off
title Mareas - servidor de desarrollo
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
echo.
echo   ===============================================
echo    MAREAS - arrancando servidor de desarrollo...
echo    1. Instala "Expo Go" en el movil (Play Store / App Store)
echo    2. Conecta el movil a la MISMA Wi-Fi que este PC
echo    3. Escanea el QR que aparecera abajo
echo   ===============================================
echo.
npx expo start
pause
