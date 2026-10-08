@echo off
rem VisualStruct launcher: starts the stable v0.3.3 runtime installed in the user profile.
rem Claude starts the same script with node directly (see manifest.json); this file is for manual checks.
set "VS_LAUNCH=%USERPROFILE%\.local\visualstruct\v0.3.3\desktop-launch.mjs"
if not exist "%VS_LAUNCH%" (
  echo VisualStruct runtime not found: %VS_LAUNCH% 1>&2
  exit /b 1
)
node "%VS_LAUNCH%" %*
