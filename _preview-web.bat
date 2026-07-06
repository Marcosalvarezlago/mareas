@echo off
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
npx expo start --web --port 8082
