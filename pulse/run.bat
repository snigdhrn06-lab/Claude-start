@echo off
REM PULSE on Windows (cmd). Usage: run.bat setup ^| all ^| data ^| train ^| test ^| app ^| screenshots
setlocal
set PY=.venv\Scripts\python.exe
if "%1"=="" goto usage
if "%1"=="setup" goto setup
if not exist %PY% (echo Run "run.bat setup" first. & exit /b 1)
if "%1"=="all" goto all
if "%1"=="data" goto data
if "%1"=="train" goto train
if "%1"=="test" goto test
if "%1"=="app" goto app
if "%1"=="screenshots" goto screenshots
goto usage

:setup
py -3.11 -m venv .venv || (echo Python 3.11 not found. Install it from python.org. & exit /b 1)
%PY% -m pip install --upgrade pip
%PY% -m pip install -r requirements.txt
%PY% -m playwright install chromium
goto end

:all
call :data || exit /b 1
call :train || exit /b 1
call :test || exit /b 1
call :screenshots
goto end

:data
%PY% scripts\fetch_data.py || exit /b 1
%PY% -m pulse.pipeline data
exit /b %errorlevel%

:train
%PY% -m pulse.pipeline train
exit /b %errorlevel%

:test
%PY% -m pytest -q
exit /b %errorlevel%

:screenshots
%PY% scripts\screenshots.py
exit /b %errorlevel%

:app
%PY% -m streamlit run app\Home.py
goto end

:usage
echo Usage: run.bat setup ^| all ^| data ^| train ^| test ^| app ^| screenshots
:end
endlocal
