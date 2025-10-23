@echo off
echo Downloading ZeroMQ libraries for Windows...
echo.

REM Create temp directory
mkdir temp_libzmq 2>nul
cd temp_libzmq

REM Download 64-bit version
echo Downloading 64-bit libzmq...
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/zeromq/libzmq/releases/download/v4.3.4/libzmq-v142-x64-4_3_4.zip' -OutFile 'libzmq-x64.zip'"

REM Extract 64-bit
echo Extracting 64-bit libzmq...
powershell -Command "Expand-Archive -Path 'libzmq-x64.zip' -DestinationPath 'x64' -Force"

REM Download 32-bit version
echo Downloading 32-bit libzmq...
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/zeromq/libzmq/releases/download/v4.3.4/libzmq-v142-Win32-4_3_4.zip' -OutFile 'libzmq-x86.zip'"

REM Extract 32-bit
echo Extracting 32-bit libzmq...
powershell -Command "Expand-Archive -Path 'libzmq-x86.zip' -DestinationPath 'x86' -Force"

REM Find and copy DLLs
echo Copying DLL files...
for /r x64 %%i in (*.dll) do copy "%%i" "..\libzmq-x64.dll" /Y
for /r x86 %%i in (*.dll) do copy "%%i" "..\libzmq-x86.dll" /Y

REM Cleanup
cd ..
rmdir /s /q temp_libzmq

echo.
echo Done! Check if libzmq-x64.dll and libzmq-x86.dll are in the current directory.
pause
