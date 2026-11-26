@echo off
setlocal EnableExtensions DisableDelayedExpansion
for %%I in ("%~dp0..") do set "sourceDir=%%~fI"
set "appDir=%LOCALAPPDATA%\ZhihuReadingAssistant"
set "menuDir=%APPDATA%\Microsoft\Windows\Start Menu\Programs"
set "shortcut=%menuDir%\Reading Assistant.url"
if not exist "%sourceDir%\index.html" goto :incomplete
if not exist "%sourceDir%\assets\kanshan\official-frames.js" goto :incomplete
if exist "%appDir%\" if not exist "%appDir%\.kanshan-install" goto :occupied
if not exist "%appDir%\" mkdir "%appDir%" || goto :failed
type nul > "%appDir%\.kanshan-install" || goto :failed

rem Robocopy exit codes 0 through 7 are successful. Keep extra user files.
robocopy "%sourceDir%\assets" "%appDir%\assets" /E /XJ /IS /IT /R:1 /W:1 /NJH /NJS /NFL /NDL /NP
if errorlevel 8 goto :failed
robocopy "%sourceDir%" "%appDir%" *.js *.css index.html /IS /IT /R:1 /W:1 /NJH /NJS /NFL /NDL /NP
if errorlevel 8 goto :failed
if not exist "%menuDir%\" mkdir "%menuDir%" || goto :failed
rem Encode spaces, Chinese characters, and URI-reserved characters in the file URL.
powershell.exe -NoLogo -NoProfile -Command "$ErrorActionPreference='Stop'; $url=([uri]::new((Join-Path $env:appDir 'index.html'))).AbsoluteUri; $entry='URL='+$url; if ([IO.File]::Exists($env:shortcut)) { if ([IO.File]::ReadAllLines($env:shortcut) -cnotcontains $entry) { throw 'Reading Assistant.url already belongs to a different application.' } } else { [IO.File]::WriteAllLines($env:shortcut,@('[InternetShortcut]',$entry),[Text.Encoding]::ASCII) }"
if errorlevel 1 goto :failed
echo Installed. Find Reading Assistant in the Start menu.
if /I not "%~1"=="--no-open" start "" "%shortcut%"
exit /b 0

:incomplete
echo Extract the entire ZIP before running this installer.
goto :failed
:occupied
echo Destination already exists and is not a Reading Assistant installation.
:failed
echo Installation did not finish.
if /I not "%~1"=="--no-open" pause
exit /b 1
