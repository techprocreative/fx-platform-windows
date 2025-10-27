"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var electron_1 = require("electron");
var path = require("path");
var fs = require("fs");
var child_process_1 = require("child_process");
var isDev = !!process.env.VITE_DEV_SERVER_URL;
var backendProcess = null;
var backendPid = null;
// Check and create .env file on first run
function ensureConfigFile() {
    var appPath = electron_1.app.getAppPath();
    var envPath = path.join(appPath, ".env");
    var envExamplePath = path.join(appPath, ".env.example");
    // If .env doesn't exist but .env.example does, copy it
    if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
        try {
            fs.copyFileSync(envExamplePath, envPath);
            console.log("✅ Created .env file from template");
            // Show dialog to inform user
            electron_1.dialog.showMessageBox({
                type: "info",
                title: "First Time Setup",
                message: "Configuration file created!",
                detail: "Please edit the .env file in:\n".concat(appPath, "\n\nYou need to fill in:\n1. WE_V2_API_KEY\n2. WE_V2_API_SECRET\n3. WE_V2_EXECUTOR_ID\n\nSee SETUP_GUIDE.md for details."),
                buttons: ["Open Folder", "OK"]
            }).then(function (result) {
                if (result.response === 0) {
                    // Open folder
                    var shell = require("electron").shell;
                    shell.openPath(appPath);
                }
            });
        }
        catch (error) {
            console.error("Failed to create .env file:", error);
        }
    }
    else if (!fs.existsSync(envPath) && !fs.existsSync(envExamplePath)) {
        // Create minimal .env file
        var minimalEnv = "# Windows Executor V2 Configuration\n# Platform URL: https://fx.nusanexus.com (HARDCODED - cannot be changed)\n\n# REQUIRED: Fill these 3 settings:\nWE_V2_API_KEY=your_api_key_here\nWE_V2_API_SECRET=your_api_secret_here\nWE_V2_EXECUTOR_ID=executor_001\n\n# Optional: MT5 path (leave blank for auto-detection)\n# WE_V2_MT5_PATH=\n\n# Optional: Advanced settings (defaults are fine)\nWE_V2_API_HOST=127.0.0.1\nWE_V2_API_PORT=8081\nWE_V2_DEBUG=true\n";
        try {
            fs.writeFileSync(envPath, minimalEnv, "utf8");
            console.log("✅ Created minimal .env file");
            electron_1.dialog.showMessageBox({
                type: "warning",
                title: "Configuration Required",
                message: "Please configure Windows Executor V2",
                detail: "Configuration file created at:\n".concat(envPath, "\n\nYou MUST edit this file and fill in:\n1. WE_V2_API_KEY (from platform dashboard)\n2. WE_V2_API_SECRET (from platform dashboard)\n3. WE_V2_EXECUTOR_ID (choose any unique name)\n\nThen restart the application."),
                buttons: ["Open Folder", "Exit"]
            }).then(function (result) {
                if (result.response === 0) {
                    var shell = require("electron").shell;
                    shell.openPath(appPath);
                }
                electron_1.app.quit();
            });
        }
        catch (error) {
            console.error("Failed to create .env file:", error);
        }
    }
}
function createWindow() {
    return __awaiter(this, void 0, void 0, function () {
        var win, indexPath;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    win = new electron_1.BrowserWindow({
                        width: 1280,
                        height: 800,
                        title: "Windows Executor V2",
                        webPreferences: {
                            preload: path.join(__dirname, "preload.js"),
                        },
                    });
                    // Show loading message
                    win.webContents.on("did-finish-load", function () {
                        // Wait for backend to fully start before checking
                        // Backend needs ~8 seconds for: startup + MT5 init + FastAPI ready
                        setTimeout(function () {
                            checkBackendAvailability(win);
                        }, 10000); // 10 second delay to ensure backend is ready
                    });
                    if (!(isDev && process.env.VITE_DEV_SERVER_URL)) return [3 /*break*/, 2];
                    return [4 /*yield*/, win.loadURL(process.env.VITE_DEV_SERVER_URL)];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 2:
                    indexPath = path.join(__dirname, "..", "dist", "index.html");
                    console.log("Loading index from:", indexPath);
                    return [4 /*yield*/, win.loadFile(indexPath)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Check if backend is available
function checkBackendAvailability(win) {
    var _this = this;
    var maxAttempts = 20; // 20 seconds (after 10s initial delay = 30s total)
    var attempts = 0;
    var lastPort = "8081";
    console.log("Starting backend health check (with 10s initial delay)...");
    console.log("Max attempts allowed: ".concat(maxAttempts, " seconds (total timeout: 30s)"));
    var checkStopped = false;
    var check = setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
        var localAppData, logPath, port_1, localAppData, portFilePath;
        return __generator(this, function (_a) {
            if (checkStopped) {
                console.log("[Health Check] Already stopped, skipping check");
                return [2 /*return*/];
            }
            attempts++;
            console.log("[Health Check] Attempt ".concat(attempts, "/").concat(maxAttempts, " (checkStopped: ").concat(checkStopped, ")"));
            // Check if we exceeded max attempts BEFORE making request
            if (attempts > maxAttempts) {
                clearInterval(check);
                checkStopped = true;
                console.error("[Health Check] \u274C FAILED after ".concat(attempts, " attempts"));
                console.error("[Health Check] Showing error dialog to user");
                localAppData = process.env.LOCALAPPDATA || process.env.APPDATA || "";
                logPath = path.join(localAppData, "WindowsExecutorV2", "logs");
                electron_1.dialog.showErrorBox("Backend Not Responding", "Backend did not start after ".concat(maxAttempts, " seconds.\n\n") +
                    "Troubleshooting:\n" +
                    "1. Check logs in: ".concat(logPath, "\n") +
                    "2. Port might be blocked by firewall\n" +
                    "3. Check .env file configuration\n" +
                    "4. Try restarting the application\n\n" +
                    "If problem persists, send log file to support.");
                return [2 /*return*/];
            }
            try {
                port_1 = "8081";
                try {
                    localAppData = process.env.LOCALAPPDATA || process.env.APPDATA || "";
                    if (localAppData) {
                        portFilePath = path.join(localAppData, "WindowsExecutorV2", "backend_port.txt");
                        if (fs.existsSync(portFilePath)) {
                            port_1 = fs.readFileSync(portFilePath, "utf8").trim();
                            if (port_1 !== lastPort) {
                                console.log("Backend port found: ".concat(port_1));
                                lastPort = port_1;
                            }
                        }
                        else {
                            if (attempts % 5 === 0) {
                                console.log("Waiting for port file... (".concat(portFilePath, ")"));
                            }
                        }
                    }
                }
                catch (e) {
                    console.error("Error reading port file:", e);
                }
                // Try to connect using fetch (more reliable in Electron)
                fetch("http://127.0.0.1:".concat(port_1, "/api/health"), {
                    method: "GET",
                    signal: AbortSignal.timeout(2000)
                })
                    .then(function (response) {
                    console.log("[Health Check] Response received: status=".concat(response.status, ", checkStopped=").concat(checkStopped));
                    if (response.status === 200 && !checkStopped) {
                        clearInterval(check);
                        checkStopped = true;
                        console.log("[Health Check] \u2705 SUCCESS! Backend is ready on port ".concat(port_1, " after ").concat(attempts, " attempts"));
                        console.log("[Health Check] Notifying renderer process");
                        // Notify renderer if needed
                        win.webContents.send("backend-ready", { port: port_1 });
                    }
                    else if (response.status !== 200) {
                        console.warn("[Health Check] \u26A0\uFE0F Non-200 status: ".concat(response.status));
                    }
                    else if (checkStopped) {
                        console.warn("[Health Check] \u26A0\uFE0F Response came but already stopped");
                    }
                })
                    .catch(function (err) {
                    // Backend not ready yet - just log
                    console.log("[Health Check] Connection failed (attempt ".concat(attempts, "/").concat(maxAttempts, "): ").concat(err.message));
                });
            }
            catch (error) {
                console.error("Health check error:", error);
            }
            return [2 /*return*/];
        });
    }); }, 1000);
}
// Start Python backend
function startBackend() {
    var _a, _b;
    if (isDev) {
        console.log("Development mode - backend should be started manually");
        return;
    }
    var resourcesPath = process.resourcesPath;
    var backendPath = path.join(resourcesPath, "backend", "WindowsExecutorV2Backend.exe");
    console.log("Starting backend from:", backendPath);
    if (!fs.existsSync(backendPath)) {
        console.error("Backend executable not found:", backendPath);
        electron_1.dialog.showErrorBox("Backend Not Found", "Cannot find backend executable at:\n".concat(backendPath, "\n\nPlease reinstall the application."));
        return;
    }
    try {
        // Start backend process
        backendProcess = (0, child_process_1.spawn)(backendPath, [], {
            cwd: path.dirname(backendPath),
            detached: false,
            windowsHide: false, // Show console window for debugging
        });
        // Store PID for cleanup
        if (backendProcess.pid) {
            backendPid = backendProcess.pid;
            console.log("Backend process started with PID: ".concat(backendPid));
        }
        (_a = backendProcess.stdout) === null || _a === void 0 ? void 0 : _a.on("data", function (data) {
            console.log("Backend: ".concat(data));
        });
        (_b = backendProcess.stderr) === null || _b === void 0 ? void 0 : _b.on("data", function (data) {
            console.error("Backend Error: ".concat(data));
        });
        backendProcess.on("error", function (error) {
            console.error("Failed to start backend:", error);
            backendPid = null;
            electron_1.dialog.showErrorBox("Backend Start Failed", "Failed to start backend:\n".concat(error.message, "\n\nPlease check the logs and try again."));
        });
        backendProcess.on("exit", function (code) {
            console.log("Backend process exited with code ".concat(code));
            backendPid = null;
            if (code !== 0 && code !== null) {
                electron_1.dialog.showErrorBox("Backend Crashed", "Backend process exited unexpectedly with code ".concat(code, ".\n\nPlease check configuration and restart."));
            }
        });
        console.log("✅ Backend started successfully");
    }
    catch (error) {
        console.error("Error starting backend:", error);
        electron_1.dialog.showErrorBox("Backend Error", "Failed to start backend:\n".concat(error, "\n\nPlease reinstall the application."));
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
                setTimeout(function () {
                    if (backendPid && backendProcess && !backendProcess.killed) {
                        console.log("Graceful kill failed, forcing kill...");
                        backendProcess.kill('SIGKILL');
                    }
                }, 1000);
            }
            catch (error) {
                console.error("Error during graceful kill:", error);
            }
        }
        // Method 2: Force kill using Windows taskkill command (more reliable)
        if (backendPid) {
            try {
                console.log("Force killing backend PID ".concat(backendPid, " with taskkill..."));
                // /F = force, /T = kill process tree (including children)
                (0, child_process_1.exec)("taskkill /F /T /PID ".concat(backendPid), function (error, stdout, stderr) {
                    if (error) {
                        console.error("Taskkill error:", error);
                    }
                    else {
                        console.log("Taskkill output:", stdout);
                    }
                });
            }
            catch (error) {
                console.error("Error executing taskkill:", error);
            }
        }
        backendProcess = null;
        backendPid = null;
        console.log("Backend cleanup complete");
    }
}
electron_1.app.whenReady().then(function () {
    // Ensure config file exists
    ensureConfigFile();
    // Start backend
    startBackend();
    // Wait a bit for backend to start, then create window
    setTimeout(function () {
        createWindow();
    }, 3000); // Wait 3 seconds for backend to initialize
    electron_1.app.on("activate", function () {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on("window-all-closed", function () {
    console.log("All windows closed, stopping backend...");
    stopBackend();
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
electron_1.app.on("before-quit", function (event) {
    console.log("App quitting, ensuring backend is stopped...");
    // Stop backend synchronously before quit
    if (backendProcess || backendPid) {
        event.preventDefault(); // Prevent quit until backend is killed
        stopBackend();
        // Give it a moment then force quit
        setTimeout(function () {
            console.log("Force quitting app after backend cleanup");
            electron_1.app.exit(0);
        }, 2000); // 2 seconds should be enough
    }
});
electron_1.app.on("will-quit", function () {
    console.log("App will quit, final backend cleanup...");
    stopBackend();
});
electron_1.ipcMain.handle("get-backend-url", function () {
    var _a;
    // Try to read actual port from backend_port.txt
    try {
        var portFilePath = path.join(process.resourcesPath, "backend_port.txt");
        if (fs.existsSync(portFilePath)) {
            var port = fs.readFileSync(portFilePath, "utf8").trim();
            console.log("Found backend port: ".concat(port));
            return "http://localhost:".concat(port);
        }
    }
    catch (error) {
        console.log("Could not read backend port file, using default");
    }
    // Fallback to default
    return (_a = process.env.WE_V2_BACKEND_URL) !== null && _a !== void 0 ? _a : "http://localhost:8081";
});
