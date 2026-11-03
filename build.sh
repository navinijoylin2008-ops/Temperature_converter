#!/usr/bin/env bash
# ============================================================================
# BUILD SCRIPT (Linux / macOS / MSYS2) - Smart Temperature Analyzer & Converter
# Compiles /c/temperature.c to WebAssembly (if Emscripten emcc is installed)
# and compiles the Native C HTTP + JSON Backend Server.
# ============================================================================

set -e

echo "============================================================================"
echo "  SMART TEMPERATURE ANALYZER & CONVERTER - BUILD SYSTEM"
echo "============================================================================"

mkdir -p wasm

# 1. Check for Emscripten (emcc)
if command -v emcc >/dev/null 2>&1; then
    echo "[1/2] Emscripten found! Compiling c/temperature.c to WebAssembly..."
    emcc c/temperature.c \
        -O2 \
        -s WASM=1 \
        -s "EXPORTED_FUNCTIONS=['_temp_unit_from_char','_temp_unit_symbol','_temp_get_abs_zero','_temp_validate','_temp_convert_pair','_temp_convert_all','_temp_get_formula','_temp_classify_celsius','_temp_analyze_array','_malloc','_free']" \
        -s "EXPORTED_RUNTIME_METHODS=['ccall','cwrap','UTF8ToString','getValue','setValue','HEAPF64','HEAP32']" \
        -o wasm/temperature.js
    echo "[SUCCESS] WebAssembly module generated at wasm/temperature.js & wasm/temperature.wasm"
else
    echo "[INFO] Emscripten (emcc) not found in PATH. Using Native C HTTP Backend approach."
fi

# 2. Compile Native C HTTP Backend Server with GCC / Clang
if command -v gcc >/dev/null 2>&1; then
    echo "[2/2] Compiling c/server.c + c/temperature.c with GCC..."
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
        gcc -Wall -Wextra -O2 c/server.c c/temperature.c -o server.exe -lws2_32 -lm
        echo "[SUCCESS] Built server.exe! Run ./server.exe and open http://localhost:8080"
    else
        gcc -Wall -Wextra -O2 c/server.c c/temperature.c -o server -lm
        echo "[SUCCESS] Built ./server! Run ./server and open http://localhost:8080"
    fi
fi

echo "============================================================================"

