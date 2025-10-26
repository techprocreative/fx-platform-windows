/**
 * File utilities for MT5 Auto-Installer
 * Handles file operations, backups, hashing, and permission checks
 */
import * as fs from "fs-extra";
import * as path from "path";
import * as crypto from "crypto";
import { promisify } from "util";
import { exec } from "child_process";
import * as os from "os";
import { Architecture, } from "../types/mt5.types";
const execAsync = promisify(exec);
export class FileUtils {
    /**
     * Copy file with backup support
     */
    static async copyWithBackup(sourcePath, destinationPath, createBackup = true) {
        const result = {
            success: false,
            sourcePath,
            destinationPath,
        };
        try {
            // Check if source exists
            if (!(await fs.pathExists(sourcePath))) {
                throw new Error(`Source file does not exist: ${sourcePath}`);
            }
            // Create destination directory if it doesn't exist
            await fs.ensureDir(path.dirname(destinationPath));
            // Create backup if destination exists and backup is requested
            if (createBackup && (await fs.pathExists(destinationPath))) {
                const backupPath = await this.createBackup(destinationPath);
                result.backupPath = backupPath;
            }
            // Copy the file
            await fs.copy(sourcePath, destinationPath);
            // Verify the copy
            if (await fs.pathExists(destinationPath)) {
                result.success = true;
            }
            else {
                throw new Error("File copy verification failed");
            }
        }
        catch (error) {
            result.error = error.message;
        }
        return result;
    }
    /**
     * Simple file copy operation (returns boolean for backward compatibility)
     */
    static async copy(sourcePath, destinationPath) {
        try {
            await fs.ensureDir(path.dirname(destinationPath));
            await fs.copy(sourcePath, destinationPath);
            return true;
        }
        catch (error) {
            console.error(`Failed to copy ${sourcePath} to ${destinationPath}:`, error);
            return false;
        }
    }
    /**
     * Create backup of a file with timestamp
     */
    static async createBackup(filePath) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupPath = `${filePath}.backup.${timestamp}`;
        await fs.copy(filePath, backupPath);
        return backupPath;
    }
    /**
     * Calculate file hash using specified algorithm
     */
    static async calculateFileHash(filePath, algorithm = "sha256") {
        try {
            const fileBuffer = await fs.readFile(filePath);
            const hashSum = crypto.createHash(algorithm);
            hashSum.update(fileBuffer);
            const hash = hashSum.digest("hex");
            const stats = await fs.stat(filePath);
            return {
                path: filePath,
                hash,
                algorithm,
                size: stats.size,
                lastModified: stats.mtime,
            };
        }
        catch (error) {
            throw new Error(`Failed to calculate hash for ${filePath}: ${error.message}`);
        }
    }
    /**
     * Compare two files by hash
     */
    static async compareFiles(file1Path, file2Path) {
        try {
            const hash1 = await this.calculateFileHash(file1Path);
            const hash2 = await this.calculateFileHash(file2Path);
            return hash1.hash === hash2.hash;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Check if file is up to date by comparing hashes
     */
    static async isFileUpToDate(sourcePath, destinationPath) {
        try {
            if (!(await fs.pathExists(destinationPath))) {
                return false;
            }
            return await this.compareFiles(sourcePath, destinationPath);
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Check if we have write permissions to a directory
     */
    static async checkWritePermissions(directoryPath) {
        try {
            const testFile = path.join(directoryPath, ".write-test");
            await fs.writeFile(testFile, "test");
            await fs.remove(testFile);
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Check if we have read permissions to a file
     */
    static async checkReadPermissions(filePath) {
        try {
            await fs.access(filePath, fs.constants.R_OK);
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Get file version from Windows executable
     */
    static async getFileVersion(filePath) {
        try {
            if (process.platform !== "win32") {
                return "Unknown";
            }
            // Use PowerShell to get file version (using single quotes to avoid path issues)
            const command = `(Get-ItemProperty '${filePath}').VersionInfo.FileVersion`;
            const { stdout: versionOutput } = await execAsync(`powershell -Command "${command}"`, {
                timeout: 5000,
            });
            const version = versionOutput.trim();
            return version || "Unknown";
        }
        catch (error) {
            // Fallback to WMIC
            try {
                const wmicPath = filePath.replace(/\\/g, '\\\\');
                const { stdout } = await execAsync(`wmic datafile where name="${wmicPath}" get Version /value`, { timeout: 5000 });
                const match = stdout.match(/Version=(.+)/);
                return match ? match[1].trim() : "Unknown";
            }
            catch {
                return "Unknown";
            }
        }
    }
    /**
     * Get product version from Windows executable
     */
    static async getProductVersion(filePath) {
        try {
            if (process.platform !== "win32") {
                return "Unknown";
            }
            // Use PowerShell to get product version (using single quotes to avoid path issues)
            const command = `(Get-ItemProperty '${filePath}').VersionInfo.ProductVersion`;
            const { stdout } = await execAsync(`powershell -Command "${command}"`, {
                timeout: 5000,
            });
            const version = stdout.trim();
            return version || "Unknown";
        }
        catch (error) {
            return "Unknown";
        }
    }
    /**
     * Get architecture of executable (32-bit or 64-bit)
     */
    static async getExecutableArchitecture(filePath) {
        try {
            if (process.platform !== "win32") {
                return Architecture.X64;
            }
            // Use PowerShell to check if file is 64-bit
            const command = `(Get-Item "${filePath}").Length -gt 0; (Get-Command "$env:windir\\SysWOW64\\cmd.exe" 2>$null) -ne $null`;
            await execAsync(`powershell -Command "${command}"`, {
                timeout: 5000,
            });
            // This is a simplified check - in production, you'd want to use proper PE header parsing
            return filePath.includes("64") || filePath.includes("x64")
                ? Architecture.X64
                : Architecture.X86;
        }
        catch (error) {
            return Architecture.X64; // Default to 64-bit
        }
    }
    /**
     * Check if a process is running by name
     */
    static async isProcessRunning(processName) {
        try {
            if (process.platform === "win32") {
                const { stdout } = await execAsync(`tasklist /FI "IMAGENAME eq ${processName}" /FO CSV /NH`, {
                    timeout: 3000,
                });
                return stdout.includes(processName);
            }
            else {
                const { stdout } = await execAsync(`pgrep -f "${processName}"`, {
                    timeout: 3000,
                });
                return stdout.trim().length > 0;
            }
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Get all running processes matching a pattern
     */
    static async getRunningProcesses(processPattern) {
        try {
            if (process.platform === "win32") {
                const { stdout } = await execAsync(`wmic process where "name like '%${processPattern}%'" get ProcessId,Name,ExecutablePath /format:csv`, {
                    timeout: 5000,
                });
                const lines = stdout.trim().split("\n").slice(1); // Skip header
                return lines
                    .filter((line) => line.trim())
                    .map((line) => {
                    const parts = line.split(",");
                    return {
                        pid: parseInt(parts[1]) || 0,
                        name: parts[2] || "",
                        path: parts[3] || "",
                    };
                })
                    .filter((proc) => proc.pid > 0);
            }
            else {
                const { stdout } = await execAsync(`ps aux | grep "${processPattern}"`, {
                    timeout: 5000,
                });
                const lines = stdout.trim().split("\n");
                return lines
                    .filter((line) => line.trim() && !line.includes("grep"))
                    .map((line) => {
                    const parts = line.trim().split(/\s+/);
                    return {
                        pid: parseInt(parts[1]) || 0,
                        name: parts[10] || "",
                        path: parts[10] || "",
                    };
                })
                    .filter((proc) => proc.pid > 0);
            }
        }
        catch (error) {
            return [];
        }
    }
    /**
     * Create directory with recursive creation
     */
    static async ensureDirectory(directoryPath) {
        try {
            await fs.ensureDir(directoryPath);
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Check if path exists and is accessible
     */
    static async pathExists(filePath) {
        try {
            return await fs.pathExists(filePath);
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Get file or directory stats
     */
    static async getPathStats(filePath) {
        try {
            return await fs.stat(filePath);
        }
        catch (error) {
            return null;
        }
    }
    /**
     * List files in directory with filtering
     */
    static async listFiles(directoryPath, pattern) {
        try {
            const files = await fs.readdir(directoryPath);
            if (pattern) {
                return files.filter((file) => pattern.test(file));
            }
            return files;
        }
        catch (error) {
            return [];
        }
    }
    /**
     * Read file content as string (auto-detects UTF-16 encoding)
     */
    static async readFile(filePath) {
        try {
            // Read as buffer first to detect encoding
            const buffer = await fs.readFile(filePath);
            // Check for UTF-16 BOM (FF FE for UTF-16LE, FE FF for UTF-16BE)
            if (buffer.length >= 2) {
                if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
                    // UTF-16LE
                    return buffer.toString('utf16le');
                }
                else if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
                    // UTF-16BE  
                    return buffer.toString('utf16le').split('').reverse().join('');
                }
            }
            // Default to UTF-8
            return buffer.toString('utf8');
        }
        catch (error) {
            throw new Error(`Failed to read file ${filePath}: ${error.message}`);
        }
    }
    /**
     * Write file content
     */
    static async writeFile(filePath, content) {
        try {
            await fs.ensureDir(path.dirname(filePath));
            await fs.writeFile(filePath, content, "utf-8");
            return true;
        }
        catch (error) {
            throw new Error(`Failed to write file ${filePath}: ${error.message}`);
        }
    }
    /**
     * Read JSON file
     */
    static async readJsonFile(filePath) {
        try {
            return await fs.readJson(filePath);
        }
        catch (error) {
            throw new Error(`Failed to read JSON file ${filePath}: ${error.message}`);
        }
    }
    /**
     * Write JSON file
     */
    static async writeJsonFile(filePath, data) {
        try {
            await fs.ensureDir(path.dirname(filePath));
            await fs.writeJson(filePath, data, { spaces: 2 });
            return true;
        }
        catch (error) {
            throw new Error(`Failed to write JSON file ${filePath}: ${error.message}`);
        }
    }
    /**
     * Remove file or directory
     */
    static async remove(filePath) {
        try {
            await fs.remove(filePath);
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Move file from source to destination
     */
    static async move(sourcePath, destinationPath) {
        try {
            await fs.ensureDir(path.dirname(destinationPath));
            await fs.move(sourcePath, destinationPath);
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Get temporary directory path
     */
    static getTempDirectory() {
        return os.tmpdir();
    }
    /**
     * Create temporary file with content
     */
    static async createTempFile(prefix, content, extension = ".tmp") {
        const tempDir = this.getTempDirectory();
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2);
        const fileName = `${prefix}-${timestamp}-${random}${extension}`;
        const filePath = path.join(tempDir, fileName);
        await fs.writeFile(filePath, content);
        return filePath;
    }
    /**
     * Check if application is running with administrator privileges
     */
    static async isRunningAsAdministrator() {
        if (process.platform !== "win32") {
            return !!(process.getuid && process.getuid() === 0);
        }
        try {
            const { stdout } = await execAsync("net session", { timeout: 3000 });
            return stdout.includes("The command completed successfully");
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Error context helper
     */
    static createErrorContext(operation, filePath) {
        return {
            operation,
            path: filePath,
            timestamp: new Date(),
            stack: new Error().stack,
            systemInfo: {
                os: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
            },
        };
    }
    /**
     * Format file size for display
     */
    static formatFileSize(bytes) {
        const units = ["B", "KB", "MB", "GB"];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }
    /**
     * Validate file path for security
     */
    static isValidPath(filePath) {
        try {
            // Resolve the path to check for directory traversal
            const resolved = path.resolve(filePath);
            return !resolved.includes("..") && !resolved.includes("~");
        }
        catch (error) {
            return false;
        }
    }
}
