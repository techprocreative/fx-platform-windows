import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as path from "path";
import * as fs from "fs";
import { spawn, ChildProcess, exec } from "child_process";

const isDev = !!process.env.VITE_DEV_SERVER_URL;
let backendProcess: ChildProcess | null = null;
let backendPid: number | null = null;

// Check and create .env file on first run
function ensureConfigFile() {
  const appPath = app.getAppPath();
  const envPath = path.join(appPath, ".env");
  const envExamplePath = path.join(appPath, ".env.example");

  // If .env doesn't exist but .env.example does, copy it
  if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
    try {
      fs.copyFileSync(envExamplePath, envPath);
      console.log("✅ Created .env file from template");
      
      // Show dialog to inform user
      dialog.showMessageBox({
        type: "info",
        title: "First Time Setup",
        message: "Configuration file created!",
        detail: `Please edit the .env file in:\n${appPath}\n\nYou need to fill in:\n1. WE_V2_API_KEY\n2. WE_V2_API_SECRET\n3. WE_V2_EXECUTOR_ID\n\nSee SETUP_GUIDE.md for details.`,
        buttons: ["Open Folder", "OK"]
      }).then((result) => {
        if (result.response === 0) {
          // Open folder
          const { shell } = require("electron");
          shell.openPath(appPath);
        }
      });
    } catch (error) {
      console.error("Failed to create .env file:", error);
    }
  } else if (!fs.existsSync(envPath) && !fs.existsSync(envExamplePath)) {
    // Create minimal .env file
    const minimalEnv = `# Windows Executor V2 Configuration
# Platform URL: https://fx.nusanexus.com (HARDCODED - cannot be changed)

# REQUIRED: Fill these 3 settings:
WE_V2_API_KEY=your_api_key_here
WE_V2_API_SECRET=your_api_secret_here
WE_V2_EXECUTOR_ID=executor_001

# Optional: MT5 path (leave blank for auto-detection)
# WE_V2_MT5_PATH=

# Optional: Advanced settings (defaults are fine)
WE_V2_API_HOST=127.0.0.1
WE_V2_API_PORT=8081
WE_V2_DEBUG=true
`;
    
    try {
      fs.writeFileSync(envPath, minimalEnv, "utf8");
      console.log("✅ Created minimal .env file");
      
      dialog.showMessageBox({
        type: "warning",
        title: "Configuration Required",
        message: "Please configure Windows Executor V2",
        detail: `Configuration file created at:\n${envPath}\n\nYou MUST edit this file and fill in:\n1. WE_V2_API_KEY (from platform dashboard)\n2. WE_V2_API_SECRET (from platform dashboard)\n3. WE_V2_EXECUTOR_ID (choose any unique name)\n\nThen restart the application.`,
        buttons: ["Open Folder", "Exit"]
      }).then((result) => {
        if (result.response === 0) {
          const { shell } = require("electron");
          shell.openPath(appPath);
        }
        app.quit();
      });
    } catch (error) {
      console.error("Failed to create .env file:", error);
    }
  }
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Windows Executor V2",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Show loading message
  win.webContents.on("did-finish-load", () => {
    // Wait for backend to fully start before checking
    // Backend needs ~8 seconds for: startup + MT5 init + FastAPI ready
    setTimeout(() => {
      checkBackendAvailability(win);
    }, 10000); // 10 second delay to ensure backend is ready
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    // In production, dist folder is in app.asar/dist
    const indexPath = path.join(__dirname, "..", "dist", "index.html");
    console.log("Loading index from:", indexPath);
    await win.loadFile(indexPath);
  }
}

// Check if backend is available
function checkBackendAvailability(win: BrowserWindow) {
  const maxAttempts = 20; // 20 seconds (after 10s initial delay = 30s total)
  let attempts = 0;
  let lastPort = "8081";

  console.log("Starting backend health check (with 10s initial delay)...");
  console.log(`Max attempts allowed: ${maxAttempts} seconds (total timeout: 30s)`);
  
  let checkStopped = false;

  const check = setInterval(async () => {
    if (checkStopped) {
      console.log(`[Health Check] Already stopped, skipping check`);
      return;
    }
    
    attempts++;
    console.log(`[Health Check] Attempt ${attempts}/${maxAttempts} (checkStopped: ${checkStopped})`);
    
    // Check if we exceeded max attempts BEFORE making request
    if (attempts > maxAttempts) {
      clearInterval(check);
      checkStopped = true;
      console.error(`[Health Check] ❌ FAILED after ${attempts} attempts`);
      console.error(`[Health Check] Showing error dialog to user`);
      
      const localAppData = process.env.LOCALAPPDATA || process.env.APPDATA || "";
      const logPath = path.join(localAppData, "WindowsExecutorV2", "logs");
      
      dialog.showErrorBox(
        "Backend Not Responding",
        `Backend did not start after ${maxAttempts} seconds.\n\n` +
        `Troubleshooting:\n` +
        `1. Check logs in: ${logPath}\n` +
        `2. Port might be blocked by firewall\n` +
        `3. Check .env file configuration\n` +
        `4. Try restarting the application\n\n` +
        `If problem persists, send log file to support.`
      );
      return;
    }
    
    try {
      // Try to read backend port from LOCALAPPDATA
      let port = "8081";
      try {
        const localAppData = process.env.LOCALAPPDATA || process.env.APPDATA || "";
        if (localAppData) {
          const portFilePath = path.join(localAppData, "WindowsExecutorV2", "backend_port.txt");
          if (fs.existsSync(portFilePath)) {
            port = fs.readFileSync(portFilePath, "utf8").trim();
            if (port !== lastPort) {
              console.log(`Backend port found: ${port}`);
              lastPort = port;
            }
          } else {
            if (attempts % 5 === 0) {
              console.log(`Waiting for port file... (${portFilePath})`);
            }
          }
        }
      } catch (e) {
        console.error("Error reading port file:", e);
      }

      // Try to connect using fetch (more reliable in Electron)
      fetch(`http://127.0.0.1:${port}/api/health`, {
        method: "GET",
        signal: AbortSignal.timeout(2000)
      })
        .then((response) => {
          console.log(`[Health Check] Response received: status=${response.status}, checkStopped=${checkStopped}`);
          
          if (response.status === 200 && !checkStopped) {
            clearInterval(check);
            checkStopped = true;
            console.log(`[Health Check] ✅ SUCCESS! Backend is ready on port ${port} after ${attempts} attempts`);
            console.log(`[Health Check] Notifying renderer process`);
            
            // Notify renderer if needed
            win.webContents.send("backend-ready", { port });
          } else if (response.status !== 200) {
            console.warn(`[Health Check] ⚠️ Non-200 status: ${response.status}`);
          } else if (checkStopped) {
            console.warn(`[Health Check] ⚠️ Response came but already stopped`);
          }
        })
        .catch((err: any) => {
          // Backend not ready yet - just log
          console.log(`[Health Check] Connection failed (attempt ${attempts}/${maxAttempts}): ${err.message}`);
        });
    } catch (error) {
      console.error("Health check error:", error);
    }
  }, 1000);
}

// Start Python backend
function startBackend() {
  if (isDev) {
    console.log("Development mode - backend should be started manually");
    return;
  }

  const resourcesPath = process.resourcesPath;
  const backendPath = path.join(resourcesPath, "backend", "WindowsExecutorV2Backend.exe");
  
  console.log("Starting backend from:", backendPath);
  
  if (!fs.existsSync(backendPath)) {
    console.error("Backend executable not found:", backendPath);
    dialog.showErrorBox(
      "Backend Not Found",
      `Cannot find backend executable at:\n${backendPath}\n\nPlease reinstall the application.`
    );
    return;
  }

  try {
    // Start backend process
    backendProcess = spawn(backendPath, [], {
      cwd: path.dirname(backendPath),
      detached: false,
      windowsHide: false, // Show console window for debugging
    });

    // Store PID for cleanup
    if (backendProcess.pid) {
      backendPid = backendProcess.pid;
      console.log(`Backend process started with PID: ${backendPid}`);
    }

    backendProcess.stdout?.on("data", (data) => {
      console.log(`Backend: ${data}`);
    });

    backendProcess.stderr?.on("data", (data) => {
      console.error(`Backend Error: ${data}`);
    });

    backendProcess.on("error", (error) => {
      console.error("Failed to start backend:", error);
      backendPid = null;
      dialog.showErrorBox(
        "Backend Start Failed",
        `Failed to start backend:\n${error.message}\n\nPlease check the logs and try again.`
      );
    });

    backendProcess.on("exit", (code) => {
      console.log(`Backend process exited with code ${code}`);
      backendPid = null;
      if (code !== 0 && code !== null) {
        dialog.showErrorBox(
          "Backend Crashed",
          `Backend process exited unexpectedly with code ${code}.\n\nPlease check configuration and restart.`
        );
      }
    });

    console.log("✅ Backend started successfully");
  } catch (error) {
    console.error("Error starting backend:", error);
    dialog.showErrorBox(
      "Backend Error",
      `Failed to start backend:\n${error}\n\nPlease reinstall the application.`
    );
  }
}

// Stop backend on app quit
function stopBackend() {
  if (backendProcess || backendPid) {
    console.log("Stopping backend...");
    
    // Method 1: Try graceful kill first
    if (backendProcess) {
      try {
        console.log("Attempting graceful kill...");
        backendProcess.kill('SIGTERM');
        
        // Wait a bit for graceful shutdown
        setTimeout(() => {
          if (backendPid && backendProcess && !backendProcess.killed) {
            console.log("Graceful kill failed, forcing kill...");
            backendProcess.kill('SIGKILL');
          }
        }, 1000);
      } catch (error) {
        console.error("Error during graceful kill:", error);
      }
    }
    
    // Method 2: Force kill using Windows taskkill command (more reliable)
    if (backendPid) {
      try {
        console.log(`Force killing backend PID ${backendPid} with taskkill...`);
        // /F = force, /T = kill process tree (including children)
        exec(`taskkill /F /T /PID ${backendPid}`, (error, stdout, stderr) => {
          if (error) {
            console.error("Taskkill error:", error);
          } else {
            console.log("Taskkill output:", stdout);
          }
        });
      } catch (error) {
        console.error("Error executing taskkill:", error);
      }
    }
    
    backendProcess = null;
    backendPid = null;
    console.log("Backend cleanup complete");
  }
}

app.whenReady().then(() => {
  // Ensure config file exists
  ensureConfigFile();
  
  // Start backend
  startBackend();
  
  // Wait a bit for backend to start, then create window
  setTimeout(() => {
    createWindow();
  }, 3000); // Wait 3 seconds for backend to initialize

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  console.log("All windows closed, stopping backend...");
  stopBackend();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", (event) => {
  console.log("App quitting, ensuring backend is stopped...");
  
  // Stop backend synchronously before quit
  if (backendProcess || backendPid) {
    event.preventDefault(); // Prevent quit until backend is killed
    
    stopBackend();
    
    // Give it a moment then force quit
    setTimeout(() => {
      console.log("Force quitting app after backend cleanup");
      app.exit(0);
    }, 2000); // 2 seconds should be enough
  }
});

app.on("will-quit", () => {
  console.log("App will quit, final backend cleanup...");
  stopBackend();
});

ipcMain.handle("get-backend-url", () => {
  // Try to read actual port from backend_port.txt
  try {
    const portFilePath = path.join(process.resourcesPath, "backend_port.txt");
    if (fs.existsSync(portFilePath)) {
      const port = fs.readFileSync(portFilePath, "utf8").trim();
      console.log(`Found backend port: ${port}`);
      return `http://localhost:${port}`;
    }
  } catch (error) {
    console.log("Could not read backend port file, using default");
  }
  
  // Fallback to default
  return process.env.WE_V2_BACKEND_URL ?? "http://localhost:8081";
});
