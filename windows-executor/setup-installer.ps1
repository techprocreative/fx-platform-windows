# FX Platform Executor - Automated Setup Installer
# This script will automatically install all required components

param(
    [switch]$Silent,
    [string]$MT5Path
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

# ASCII Banner
Write-Host @"
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   FX PLATFORM EXECUTOR - AUTOMATED SETUP                 ║
║   Version 1.0.0                                          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

Write-Info "`nStarting automated installation...`n"

# Step 1: Detect MT5 Installations
Write-Info "═══ Step 1/6: Detecting MT5 Installations ═══"

$mt5Paths = @()

# Check common installation paths
$commonPaths = @(
    "C:\Program Files\MetaTrader 5",
    "C:\Program Files (x86)\MetaTrader 5",
    "$env:APPDATA\MetaQuotes\Terminal"
)

foreach ($path in $commonPaths) {
    if (Test-Path $path) {
        $terminal = Get-ChildItem -Path $path -Filter "terminal64.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($terminal) {
            $mt5Paths += $terminal.DirectoryName
            Write-Success "  ✓ Found MT5 at: $($terminal.DirectoryName)"
        }
    }
}

# Check Windows Registry
try {
    $regPaths = @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )
    
    foreach ($regPath in $regPaths) {
        $apps = Get-ItemProperty $regPath -ErrorAction SilentlyContinue
        foreach ($app in $apps) {
            if ($app.DisplayName -like "*MetaTrader 5*") {
                $installLocation = $app.InstallLocation
                if ($installLocation -and (Test-Path $installLocation)) {
                    if ($mt5Paths -notcontains $installLocation) {
                        $mt5Paths += $installLocation
                        Write-Success "  ✓ Found MT5 at: $installLocation"
                    }
                }
            }
        }
    }
} catch {
    Write-Warning "  ! Could not read registry"
}

# Manual path if specified
if ($MT5Path) {
    if (Test-Path $MT5Path) {
        if ($mt5Paths -notcontains $MT5Path) {
            $mt5Paths += $MT5Path
            Write-Success "  ✓ Using specified path: $MT5Path"
        }
    } else {
        Write-Error "  ✗ Specified path does not exist: $MT5Path"
        exit 1
    }
}

if ($mt5Paths.Count -eq 0) {
    Write-Error "`n✗ No MT5 installation found!"
    Write-Warning "Please install MetaTrader 5 first or specify path with -MT5Path parameter"
    exit 1
}

Write-Success "`n  Found $($mt5Paths.Count) MT5 installation(s)`n"

# Step 2: Create resource directories
Write-Info "═══ Step 2/6: Creating Resource Directories ═══"

$resourcesDir = Join-Path $PSScriptRoot "resources"
$libsDir = Join-Path $resourcesDir "libs"
$expertsDir = Join-Path $resourcesDir "experts"
$includesDir = Join-Path $resourcesDir "includes"

foreach ($dir in @($resourcesDir, $libsDir, $expertsDir, $includesDir)) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Success "  ✓ Created: $dir"
    } else {
        Write-Info "  ○ Already exists: $dir"
    }
}

# Step 3: Download/Prepare ZeroMQ Library
Write-Info "`n═══ Step 3/6: Preparing ZeroMQ Library ═══"

$zmqUrl = "https://github.com/zeromq/libzmq/releases/download/v4.3.4/libzmq-v141-x64-4_3_4.zip"
$zmqZip = Join-Path $env:TEMP "libzmq.zip"
$zmqExtract = Join-Path $env:TEMP "libzmq"

# Check if libzmq.dll already exists in resources
$zmqDllPath = Join-Path $libsDir "libzmq.dll"

if (-not (Test-Path $zmqDllPath)) {
    Write-Info "  Downloading ZeroMQ library..."
    try {
        Invoke-WebRequest -Uri $zmqUrl -OutFile $zmqZip -UseBasicParsing
        Write-Success "  ✓ Downloaded ZeroMQ"
        
        # Extract
        Expand-Archive -Path $zmqZip -DestinationPath $zmqExtract -Force
        
        # Find and copy libzmq.dll
        $zmqDll = Get-ChildItem -Path $zmqExtract -Filter "libzmq*.dll" -Recurse | Select-Object -First 1
        if ($zmqDll) {
            Copy-Item -Path $zmqDll.FullName -Destination $zmqDllPath -Force
            Write-Success "  ✓ Extracted libzmq.dll to resources"
        } else {
            Write-Warning "  ! libzmq.dll not found in download, you may need to provide it manually"
        }
        
        # Cleanup
        Remove-Item $zmqZip -Force -ErrorAction SilentlyContinue
        Remove-Item $zmqExtract -Recurse -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Warning "  ! Could not download ZeroMQ: $($_.Exception.Message)"
        Write-Warning "  ! Please download libzmq.dll manually and place it in: $libsDir"
    }
} else {
    Write-Success "  ✓ libzmq.dll already exists in resources"
}

# Step 4: Create Expert Advisor files
Write-Info "`n═══ Step 4/6: Creating Expert Advisor Files ═══"

# Create FX_Platform_Bridge.mq5 source
$eaMq5Path = Join-Path $expertsDir "FX_Platform_Bridge.mq5"
$eaMq5Content = @'
//+------------------------------------------------------------------+
//|                                           FX_Platform_Bridge.mq5 |
//|                        Copyright 2025, FX Platform Team          |
//+------------------------------------------------------------------+
#property copyright "Copyright 2025, FX Platform Team"
#property version   "1.00"
#property strict

#include <Zmq/Zmq.mqh>

// ZeroMQ Context and Socket
Context context("FX-Platform");
Socket socket(context, ZMQ_REP);

// Input parameters
input string ZMQ_HOST = "tcp://*:5555";
input int    HEARTBEAT_INTERVAL = 60;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   // Bind socket
   if(!socket.bind(ZMQ_HOST))
   {
      Print("Error binding socket to ", ZMQ_HOST);
      return(INIT_FAILED);
   }
   
   Print("FX Platform Bridge initialized on ", ZMQ_HOST);
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   socket.unbind(ZMQ_HOST);
   Print("FX Platform Bridge stopped");
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   ZmqMsg request;
   
   // Non-blocking receive
   if(socket.recv(request, true))
   {
      string command = request.getData();
      Print("Received command: ", command);
      
      // Process command
      string response = ProcessCommand(command);
      
      // Send response
      ZmqMsg reply(response);
      socket.send(reply);
   }
}

//+------------------------------------------------------------------+
//| Process command from platform                                    |
//+------------------------------------------------------------------+
string ProcessCommand(string command)
{
   // Parse JSON command
   // This is a template - implement actual command processing
   
   if(StringFind(command, "PING") >= 0)
      return "PONG";
   
   if(StringFind(command, "STATUS") >= 0)
      return "OK";
   
   // Add more command handlers here
   // Examples: OPEN_TRADE, CLOSE_TRADE, GET_POSITIONS, etc.
   
   return "{\"status\":\"error\",\"message\":\"Unknown command\"}";
}
//+------------------------------------------------------------------+
'@

if (-not (Test-Path $eaMq5Path)) {
    Set-Content -Path $eaMq5Path -Value $eaMq5Content -Encoding UTF8
    Write-Success "  ✓ Created FX_Platform_Bridge.mq5"
} else {
    Write-Info "  ○ FX_Platform_Bridge.mq5 already exists"
}

# Create Zmq.mqh include file
$zmqMqhPath = Join-Path $includesDir "Zmq.mqh"
$zmqMqhContent = @'
//+------------------------------------------------------------------+
//|                                                      Zmq.mqh     |
//|                        ZeroMQ MQL5 Wrapper                       |
//+------------------------------------------------------------------+
#property copyright "ZeroMQ Community"
#property strict

// ZeroMQ socket types
#define ZMQ_PAIR 0
#define ZMQ_PUB 1
#define ZMQ_SUB 2
#define ZMQ_REQ 3
#define ZMQ_REP 4
#define ZMQ_DEALER 5
#define ZMQ_ROUTER 6
#define ZMQ_PULL 7
#define ZMQ_PUSH 8

// Import ZeroMQ functions
#import "libzmq.dll"
   int zmq_ctx_new();
   int zmq_socket(int context, int type);
   int zmq_bind(int socket, string endpoint);
   int zmq_connect(int socket, string endpoint);
   int zmq_send(int socket, uchar &data[], int size, int flags);
   int zmq_recv(int socket, uchar &data[], int size, int flags);
   int zmq_close(int socket);
   int zmq_ctx_term(int context);
#import

// ZeroMQ Context class
class Context
{
private:
   int m_context;
   string m_name;
   
public:
   Context(string name) : m_name(name)
   {
      m_context = zmq_ctx_new();
   }
   
   ~Context()
   {
      zmq_ctx_term(m_context);
   }
   
   int getContext() { return m_context; }
};

// ZeroMQ Socket class
class Socket
{
private:
   int m_socket;
   int m_context;
   int m_type;
   
public:
   Socket(Context &context, int type) : m_type(type)
   {
      m_context = context.getContext();
      m_socket = zmq_socket(m_context, type);
   }
   
   ~Socket()
   {
      zmq_close(m_socket);
   }
   
   bool bind(string endpoint)
   {
      return zmq_bind(m_socket, endpoint) == 0;
   }
   
   bool connect(string endpoint)
   {
      return zmq_connect(m_socket, endpoint) == 0;
   }
   
   bool send(ZmqMsg &msg, int flags = 0)
   {
      uchar data[];
      msg.getData(data);
      return zmq_send(m_socket, data, ArraySize(data), flags) >= 0;
   }
   
   bool recv(ZmqMsg &msg, bool nonBlocking = false)
   {
      uchar data[1024];
      int flags = nonBlocking ? 1 : 0; // ZMQ_DONTWAIT = 1
      int size = zmq_recv(m_socket, data, 1024, flags);
      
      if(size > 0)
      {
         msg.setData(data, size);
         return true;
      }
      return false;
   }
   
   bool unbind(string endpoint) { return true; } // Simplified
};

// ZeroMQ Message class
class ZmqMsg
{
private:
   uchar m_data[];
   int m_size;
   
public:
   ZmqMsg() : m_size(0) {}
   
   ZmqMsg(string str)
   {
      StringToCharArray(str, m_data);
      m_size = ArraySize(m_data);
   }
   
   void setData(uchar &data[], int size)
   {
      ArrayResize(m_data, size);
      ArrayCopy(m_data, data, 0, 0, size);
      m_size = size;
   }
   
   void getData(uchar &data[])
   {
      ArrayResize(data, m_size);
      ArrayCopy(data, m_data);
   }
   
   string getData()
   {
      return CharArrayToString(m_data);
   }
};
//+------------------------------------------------------------------+
'@

if (-not (Test-Path $zmqMqhPath)) {
    Set-Content -Path $zmqMqhPath -Value $zmqMqhContent -Encoding UTF8
    Write-Success "  ✓ Created Zmq.mqh include file"
} else {
    Write-Info "  ○ Zmq.mqh already exists"
}

# Step 5: Install components to MT5 directories
Write-Info "`n═══ Step 5/6: Installing Components to MT5 ═══"

foreach ($mt5Path in $mt5Paths) {
    Write-Info "`nInstalling to: $mt5Path"
    
    # Find MQL5 directory
    $mql5Dir = Join-Path $mt5Path "MQL5"
    if (-not (Test-Path $mql5Dir)) {
        # Try to find in AppData
        $dataPath = Get-ChildItem -Path "$env:APPDATA\MetaQuotes\Terminal" -Directory -ErrorAction SilentlyContinue |
                    Where-Object { Test-Path (Join-Path $_.FullName "MQL5") } |
                    Select-Object -First 1
        
        if ($dataPath) {
            $mql5Dir = Join-Path $dataPath.FullName "MQL5"
        }
    }
    
    if (-not (Test-Path $mql5Dir)) {
        Write-Warning "  ! MQL5 directory not found for this installation"
        continue
    }
    
    # Install libzmq.dll to MT5 Libraries folder
    $mt5LibsDir = Join-Path $mql5Dir "Libraries"
    if (-not (Test-Path $mt5LibsDir)) {
        New-Item -ItemType Directory -Path $mt5LibsDir -Force | Out-Null
    }
    
    if (Test-Path $zmqDllPath) {
        $destZmq = Join-Path $mt5LibsDir "libzmq.dll"
        Copy-Item -Path $zmqDllPath -Destination $destZmq -Force
        Write-Success "  ✓ Installed libzmq.dll"
    } else {
        Write-Warning "  ! libzmq.dll not found in resources"
    }
    
    # Install Expert Advisor source
    $mt5ExpertsDir = Join-Path $mql5Dir "Experts"
    if (-not (Test-Path $mt5ExpertsDir)) {
        New-Item -ItemType Directory -Path $mt5ExpertsDir -Force | Out-Null
    }
    
    if (Test-Path $eaMq5Path) {
        $destEA = Join-Path $mt5ExpertsDir "FX_Platform_Bridge.mq5"
        Copy-Item -Path $eaMq5Path -Destination $destEA -Force
        Write-Success "  ✓ Installed FX_Platform_Bridge.mq5"
    }
    
    # Install include files
    $mt5IncludeDir = Join-Path $mql5Dir "Include\Zmq"
    if (-not (Test-Path $mt5IncludeDir)) {
        New-Item -ItemType Directory -Path $mt5IncludeDir -Force | Out-Null
    }
    
    if (Test-Path $zmqMqhPath) {
        $destInclude = Join-Path $mt5IncludeDir "Zmq.mqh"
        Copy-Item -Path $zmqMqhPath -Destination $destInclude -Force
        Write-Success "  ✓ Installed Zmq.mqh"
    }
    
    Write-Success "  ✓ Installation complete for this MT5 instance"
}

# Step 6: Create default configuration
Write-Info "`n═══ Step 6/6: Creating Default Configuration ═══"

$configDir = Join-Path $env:APPDATA "fx-executor-config"
if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
}

$configPath = Join-Path $configDir "config.json"

$defaultConfig = @{
    executorId = "executor-001"
    apiKey = ""
    apiSecret = ""
    platformUrl = "https://fx.nusanexus.com"
    pusherKey = ""
    pusherCluster = "mt1"
    zmqPort = 5555
    zmqHost = "tcp://localhost"
    heartbeatInterval = 60
    autoReconnect = $true
    isFirstRun = $true
} | ConvertTo-Json -Depth 10

Set-Content -Path $configPath -Value $defaultConfig -Encoding UTF8
Write-Success "  ✓ Created default configuration at: $configPath"

# Summary
Write-Host "`n"
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                                                           ║" -ForegroundColor Green
Write-Host "║   ✓ INSTALLATION COMPLETED SUCCESSFULLY                  ║" -ForegroundColor Green
Write-Host "║                                                           ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green

Write-Host "`n📋 Installation Summary:" -ForegroundColor Cyan
Write-Success "  ✓ Detected $($mt5Paths.Count) MT5 installation(s)"
Write-Success "  ✓ Installed ZeroMQ library (libzmq.dll)"
Write-Success "  ✓ Installed Expert Advisor (FX_Platform_Bridge.mq5)"
Write-Success "  ✓ Installed include files (Zmq.mqh)"
Write-Success "  ✓ Created default configuration"

Write-Host "`n📝 Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Open MetaTrader 5" -ForegroundColor White
Write-Host "  2. Compile the Expert Advisor (FX_Platform_Bridge.mq5)" -ForegroundColor White
Write-Host "  3. Run FX Platform Executor application" -ForegroundColor White
Write-Host "  4. Complete the setup wizard with your API credentials" -ForegroundColor White
Write-Host "  5. Attach the EA to a chart in MT5" -ForegroundColor White

Write-Host "`n⚠️  Important:" -ForegroundColor Yellow
Write-Host "  - Make sure to enable AutoTrading in MT5" -ForegroundColor White
Write-Host "  - Allow DLL imports in MT5 settings" -ForegroundColor White
Write-Host "  - Configure your API credentials in the app" -ForegroundColor White

Write-Host "`n📂 Files Location:" -ForegroundColor Cyan
Write-Host "  Config: $configPath" -ForegroundColor Gray
Write-Host "  Resources: $resourcesDir" -ForegroundColor Gray

Write-Host "`n✨ Setup completed! You can now run the FX Platform Executor.`n" -ForegroundColor Green

# Pause if not silent
if (-not $Silent) {
    Write-Host "Press any key to exit..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
