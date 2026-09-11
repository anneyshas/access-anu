@echo off
setlocal
cd /d "%~dp0"
py -3 --version >nul 2>&1
if not errorlevel 1 (
  py -3 serve.py
  goto done
)
python --version >nul 2>&1
if not errorlevel 1 (
  python serve.py
  goto done
)
node --version >nul 2>&1
if not errorlevel 1 (
  node serve.mjs
  goto done
)
echo Python 3 or Node.js must be installed on this computer.
echo See START-HERE.txt. No npm or pip packages are needed.
:done
pause
