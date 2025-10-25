@echo off
REM =========================================================
REM Build libzmq.dll from source (zeromq-4.3.5)
REM =========================================================

echo.
echo ========================================================
echo BUILDING LIBZMQ.DLL FROM SOURCE
echo ========================================================
echo.

REM Check if Visual Studio is installed
where cmake >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: CMake not found!
    echo.
    echo Please install one of:
    echo   1. Visual Studio 2019/2022 with C++ tools
    echo   2. Visual Studio Build Tools
    echo   3. CMake standalone
    echo.
    echo Download from:
    echo   https://visualstudio.microsoft.com/downloads/
    echo.
    pause
    exit /b 1
)

echo [1/5] CMake found
echo.

REM Navigate to source directory
cd /d "%~dp0zeromq-4.3.5"
if not exist "CMakeLists.txt" (
    echo ERROR: Source code not found!
    echo Make sure zeromq-4.3.5 folder exists in project root
    pause
    exit /b 1
)

echo [2/5] Source code found
echo.

REM Create build directory
if not exist "build" mkdir build
cd build

echo [3/5] Configuring with CMake...
echo.

REM Configure with CMake
cmake .. -G "Visual Studio 16 2019" -A x64 ^
    -DCMAKE_BUILD_TYPE=Release ^
    -DBUILD_SHARED=ON ^
    -DBUILD_STATIC=OFF ^
    -DWITH_LIBSODIUM=OFF ^
    -DZMQ_BUILD_TESTS=OFF ^
    -DENABLE_DRAFTS=OFF

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: CMake configuration failed!
    echo.
    echo Try using Visual Studio Generator:
    echo   cmake .. -G "Visual Studio 17 2022" -A x64 (for VS 2022)
    echo.
    pause
    exit /b 1
)

echo.
echo [4/5] Building (this may take 5-10 minutes)...
echo.

REM Build
cmake --build . --config Release

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Build failed!
    pause
    exit /b 1
)

echo.
echo [5/5] Copying DLL to project...
echo.

REM Find and copy the DLL
if exist "bin\Release\libzmq-v142-mt-4_3_5.dll" (
    copy "bin\Release\libzmq-v142-mt-4_3_5.dll" "..\..\resources\libs\libzmq-x64.dll"
    echo SUCCESS: DLL copied!
) else if exist "bin\Release\libzmq.dll" (
    copy "bin\Release\libzmq.dll" "..\..\resources\libs\libzmq-x64.dll"
    echo SUCCESS: DLL copied!
) else (
    echo ERROR: Could not find built DLL in bin\Release\
    echo Please check build output above
    pause
    exit /b 1
)

echo.
echo ========================================================
echo BUILD COMPLETED!
echo ========================================================
echo.
echo DLL location: resources\libs\libzmq-x64.dll
echo.
echo Next steps:
echo   1. cd ..\..\
echo   2. npm run verify:dll
echo   3. Should see: VERIFICATION PASSED
echo.
pause
