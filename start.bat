@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 블로그 서버를 시작합니다. 이 창을 닫으면 서버가 꺼집니다.
start "" cmd /c "timeout /t 2 >nul & start http://localhost:8000"
python -m http.server 8000
pause
