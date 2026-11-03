@echo off
REM ============================================================================
REM BUILD SCRIPT (Windows) - Smart Temperature Analyzer & Converter
REM Compiles /c/temperature.c to WebAssembly (if Emscripten emcc is installed)
REM and compiles the Native C HTTP + JSON Backend Server (server.exe via GCC).
REM ============================================================================

echo ============================================================================
echo   SMART TEMPERATURE ANALYZER ^& CONVERTER - BUILD SYSTEM
echo ============================================================================

if not exist "wasm" mkdir wasm

REM 1. Check for Emscripten (emcc) to build WebAssembly module
where emcc >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [1/2] Emscripten found! Compiling /c/temperature.c to WebAssembly...
    call emcc c/temperature.c ^
        -O2 ^
        -s WASM=1 ^
        -s "EXPORTED_FUNCTIONS=['_temp_unit_from_char','_temp_unit_symbol','_temp_get_abs_zero','_temp_validate','_temp_convert_pair','_temp_convert_all','_temp_get_formula','_temp_classify_celsius','_temp_analyze_array','_malloc','_free']" ^
        -s "EXPORTED_RUNTIME_METHODS=['ccall','cwrap','UTF8ToString','getValue','setValue','HEAPF64','HEAP32']" ^
        -o wasm/temperature.js
    if %ERRORLEVEL% EQU 0 (
        echo [SUCCESS] WebAssembly module generated at wasm/temperature.js ^& wasm/temperature.wasm
    ) else (
        echo [WARNING] Emscripten build failed. Falling back to C HTTP Server.
    )
) else (
    echo [INFO] Emscripten (emcc) not found in PATH. Using Native C HTTP Backend approach.
)

REM 2. Compile Native C HTTP Backend Server with GCC
where gcc >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [2/2] Compiling /c/server.c + /c/temperature.c with GCC...
    gcc -Wall -Wextra -O2 c/server.c c/temperature.c -o server.exe -lws2_32 -lm
    if %ERRORLEVEL% EQU 0 (
        echo [SUCCESS] Compiled server.exe successfully!
        echo.
        echo To start the application, run:
        echo     server.exe
        echo Then open http://localhost:8080 in your browser.
    ) else (
        echo [ERROR] GCC compilation failed.
        exit /b 1
    )
) else (
    echo [WARNING] GCC not found in PATH.
)

echo ============================================================================

