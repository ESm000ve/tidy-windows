@echo off
setlocal
rem Launch the latest local build of Tidy without installing it or needing npm.
rem Build it first with:  npm.cmd run build:win:unpacked   (or npm.cmd run build:win)
rem Falls back to the installed copy when there is no local build.
set "APP=%~dp0release\win-unpacked\Tidy.exe"
if not exist "%APP%" set "APP=%LOCALAPPDATA%\Programs\Tidy\Tidy.exe"
if not exist "%APP%" (
  echo A built Tidy.exe could not be found.
  echo Build it first:  npm.cmd run build:win:unpacked
  pause
  exit /b 1
)
rem Optional: load GEMINI_API_KEY from .env for the AI features.
if exist "%~dp0.env" (
  for /f "usebackq tokens=1,* delims==" %%A in ("%~dp0.env") do (
    if /i "%%A"=="GEMINI_API_KEY" set "GEMINI_API_KEY=%%B"
  )
)
start "" "%APP%"
endlocal
