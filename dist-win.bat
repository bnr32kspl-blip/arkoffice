@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem Build Windows NSIS installer (ArkOffice Setup *.exe)
rem ASCII-only: UTF-8 Japanese breaks cmd.exe parsing on many Windows setups.

cd /d "%~dp0"
set "ROOT=%CD%"
set "LLM_DIR=%ROOT%\apps\shell\vendor\llm"
set "SIDECAR_CRATE=%ROOT%\apps\sheets\native\xlsx-engine"
set "SIDECAR_STAGE=%SIDECAR_CRATE%\target\x86_64-pc-windows-gnu\release\xlsx-sidecar.exe"
set "RELEASE_DIR=%ROOT%\apps\shell\release"

echo === ArkOffice Windows installer build ===
echo Root: %ROOT%
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: node not found. Install Node.js 20+ and add it to PATH.
  exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm not found.
  exit /b 1
)
where cargo >nul 2>&1
if errorlevel 1 (
  echo ERROR: cargo not found. Install the Rust toolchain.
  exit /b 1
)

echo [1/4] Checking vendor\llm ...
if not exist "%LLM_DIR%\llama-server-cuda.exe" (
  echo ERROR: missing %LLM_DIR%\llama-server-cuda.exe
  exit /b 1
)
if not exist "%LLM_DIR%\llama-server-vulkan.exe" (
  echo ERROR: missing %LLM_DIR%\llama-server-vulkan.exe
  exit /b 1
)
if not exist "%LLM_DIR%\llama-server-cpu.exe" (
  echo ERROR: missing %LLM_DIR%\llama-server-cpu.exe
  exit /b 1
)

set "HAS_CUDART="
for %%F in ("%LLM_DIR%\cudart64_*.dll") do set "HAS_CUDART=1"
if not defined HAS_CUDART (
  echo WARNING: cudart64_*.dll not found. CUDA inference may fail at runtime.
  echo          Unpack cudart-llama-bin-win-cuda-12.x into vendor\llm.
  echo.
) else (
  echo OK: CUDA / Vulkan / CPU exes and cudart detected
)

echo.
echo [2/4] Building xlsx-sidecar ...
pushd "%SIDECAR_CRATE%"
cargo build --release
if errorlevel 1 (
  popd
  echo ERROR: cargo build --release failed.
  exit /b 1
)

set "SIDECAR_SRC="
if exist "target\release\xlsx-sidecar.exe" set "SIDECAR_SRC=target\release\xlsx-sidecar.exe"
if not defined SIDECAR_SRC if defined CARGO_TARGET_DIR if exist "%CARGO_TARGET_DIR%\release\xlsx-sidecar.exe" set "SIDECAR_SRC=%CARGO_TARGET_DIR%\release\xlsx-sidecar.exe"
if not defined SIDECAR_SRC (
  for /f "delims=" %%P in ('dir /s /b xlsx-sidecar.exe 2^>nul') do (
    if not defined SIDECAR_SRC set "SIDECAR_SRC=%%P"
  )
)
if not defined SIDECAR_SRC (
  popd
  echo ERROR: xlsx-sidecar.exe output not found.
  exit /b 1
)

if not exist "target\x86_64-pc-windows-gnu\release" mkdir "target\x86_64-pc-windows-gnu\release"
copy /Y "!SIDECAR_SRC!" "target\x86_64-pc-windows-gnu\release\xlsx-sidecar.exe" >nul
if errorlevel 1 (
  popd
  echo ERROR: failed to stage xlsx-sidecar.exe
  exit /b 1
)
if not exist "%SIDECAR_STAGE%" (
  popd
  echo ERROR: sidecar missing at expected path:
  echo   %SIDECAR_STAGE%
  exit /b 1
)
popd
echo OK: %SIDECAR_STAGE%

echo.
echo [3/4] npm run dist:win (this takes a while) ...
call npm run dist:win
if errorlevel 1 (
  echo ERROR: npm run dist:win failed.
  exit /b 1
)

echo.
echo [4/4] Artifacts
if exist "%RELEASE_DIR%\ArkOffice Setup*.exe" (
  for %%F in ("%RELEASE_DIR%\ArkOffice Setup*.exe") do (
    echo   %%~fF
    echo   size: %%~zF bytes
  )
) else (
  echo WARNING: Setup exe not found. Check %RELEASE_DIR%
)

echo.
echo Done.
exit /b 0
