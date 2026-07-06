@echo off
title Mareas - modo tunel (conexion por internet)
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
echo.
echo   ===============================================
echo    MAREAS - modo TUNEL
echo    Usa este si la Wi-Fi normal no conectaba.
echo    Funciona aunque el movil y el PC esten en
echo    redes distintas (p. ej. movil con datos).
echo.
echo    1. Abre "Expo Go" en el movil
echo    2. Espera al QR (tarda un poco mas la 1a vez)
echo    3. Escanealo
echo   ===============================================
echo.
npx expo start --tunnel
pause
