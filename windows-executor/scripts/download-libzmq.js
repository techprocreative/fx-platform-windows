#!/usr/bin/env node

/**
 * Download ZeroMQ DLL files for Windows Executor
 * This script downloads the correct libzmq.dll versions for both x64 and x86 architectures
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { execSync } = require("child_process");

// Configuration
const CONFIG = {
  version: "4.3.5",
  outputDir: path.join(__dirname, "../resources/libs"),
  // Alternative: download pre-built DLLs from a reliable source
  files: [
    {
      name: "libzmq-x64.dll",
      // Using direct DLL download from opendll or similar service
      url: "https://github.com/zeromq/libzmq/releases/download/v4.3.5/libzmq-v142-mt-4_3_5.dll",
      fallbackUrls: [
        // Fallback ke versi sebelumnya jika perlu
        "https://github.com/zeromq/libzmq/releases/download/v4.3.4/libzmq-v142-mt-4_3_4.dll",
        "https://github.com/zeromq/libzmq/releases/download/v4.3.3/libzmq-v142-mt-4_3_3.dll",
      ],
    },
  ],
};

/**
 * Download file from URL with redirect support
 */
function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading: ${url}`);

    const protocol = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(outputPath);

    const request = protocol.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "*/*",
        },
      },
      (response) => {
        // Handle redirects
        if (
          response.statusCode === 301 ||
          response.statusCode === 302 ||
          response.statusCode === 307 ||
          response.statusCode === 308
        ) {
          file.close();
          try {
            fs.unlinkSync(outputPath);
          } catch (e) {
            // Ignore if file doesn't exist
          }
          console.log(`Following redirect to: ${response.headers.location}`);
          return downloadFile(response.headers.location, outputPath)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          file.close();
          try {
            fs.unlinkSync(outputPath);
          } catch (e) {
            // Ignore if file doesn't exist
          }
          reject(
            new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`),
          );
          return;
        }

        let downloaded = 0;
        const total = parseInt(response.headers["content-length"] || "0", 10);

        response.on("data", (chunk) => {
          downloaded += chunk.length;
          if (total > 0) {
            const percent = ((downloaded / total) * 100).toFixed(1);
            process.stdout.write(`\rProgress: ${percent}%`);
          }
        });

        response.pipe(file);

        file.on("finish", () => {
          file.close();
          if (total > 0) {
            console.log("\r" + " ".repeat(50)); // Clear progress line
          }
          resolve();
        });

        file.on("error", (err) => {
          file.close();
          try {
            fs.unlinkSync(outputPath);
          } catch (e) {
            // Ignore if file doesn't exist
          }
          reject(err);
        });
      },
    );

    request.on("error", (err) => {
      file.close();
      try {
        fs.unlinkSync(outputPath);
      } catch (e) {
        // Ignore if file doesn't exist
      }
      reject(err);
    });

    request.setTimeout(30000, () => {
      request.destroy();
      file.close();
      try {
        fs.unlinkSync(outputPath);
      } catch (e) {
        // Ignore if file doesn't exist
      }
      reject(new Error("Request timeout"));
    });
  });
}

/**
 * Download and process a single library file with fallback URLs
 */
async function processLibrary(config) {
  const outputPath = path.join(CONFIG.outputDir, config.name);

  // Try main URL first
  const urls = [config.url, ...(config.fallbackUrls || [])];

  for (let i = 0; i < urls.length; i++) {
    try {
      await downloadFile(urls[i], outputPath);

      // Verify the file exists and has reasonable size
      if (!fs.existsSync(outputPath)) {
        throw new Error(`Failed to download: ${config.name}`);
      }

      const stats = fs.statSync(outputPath);
      if (stats.size < 100000) {
        // Less than 100KB is probably wrong
        throw new Error(`File too small: ${config.name} (${stats.size} bytes)`);
      }

      console.log(
        `✓ Successfully downloaded: ${config.name} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`,
      );
      return; // Success, exit function
    } catch (error) {
      console.error(`Failed with URL ${urls[i]}: ${error.message}`);
      if (i < urls.length - 1) {
        console.log("Trying fallback URL...");
      } else {
        throw new Error(
          `All download attempts failed for ${config.name}: ${error.message}`,
        );
      }
    }
  }
}

/**
 * Create a placeholder DLL if download fails
 */
function createPlaceholderDLL(name) {
  const outputPath = path.join(CONFIG.outputDir, name);
  const content = `
ATTENTION: ZeroMQ DLL Download Failed
======================================

The automatic download of ${name} has failed.

To manually install libzmq.dll:

1. Download libzmq from: https://github.com/zeromq/libzmq/releases
2. Extract the DLL files
3. Place them in: ${CONFIG.outputDir}
4. Rename to: ${name}

Required files:
- libzmq-x64.dll (for 64-bit Windows)

Alternative: Install via vcpkg
  vcpkg install zeromq:x64-windows

For more information, visit:
https://zeromq.org/download/
`;

  fs.writeFileSync(outputPath + ".txt", content);
  console.log(`Created instructions at: ${outputPath}.txt`);
}

/**
 * Create DLL manifest file
 */
function createManifest() {
  const files = CONFIG.files
    .map((f) => {
      const filePath = path.join(CONFIG.outputDir, f.name);
      if (fs.existsSync(filePath)) {
        return {
          name: f.name,
          size: fs.statSync(filePath).size,
          downloadedAt: new Date().toISOString(),
        };
      }
      return null;
    })
    .filter((f) => f !== null);

  if (files.length === 0) {
    console.warn("No DLL files were successfully downloaded");
    return;
  }

  const manifest = {
    version: CONFIG.version,
    files: files,
    createdAt: new Date().toISOString(),
    description: "ZeroMQ libraries for FX Platform Windows Executor",
  };

  const manifestPath = path.join(CONFIG.outputDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`✓ Created manifest: ${manifestPath}`);
}

/**
 * Check if we can build libzmq from source using node-gyp
 */
function checkNodeGypAvailable() {
  try {
    execSync("node-gyp --version", { stdio: "pipe" });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log("🚀 ZeroMQ Library Setup for FX Platform Windows Executor");
  console.log(`Version: ${CONFIG.version}`);
  console.log(`Output Directory: ${CONFIG.outputDir}`);
  console.log("");

  try {
    // Create output directory
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
      console.log(`✓ Created directory: ${CONFIG.outputDir}`);
    }

    console.log(
      "⚠️  Note: Pre-built libzmq DLLs may not be available on GitHub releases.",
    );
    console.log(
      "   The zeromq npm package will build the native module automatically.",
    );
    console.log("");

    // Try to download pre-built DLLs
    let downloadSuccess = false;
    for (const config of CONFIG.files) {
      try {
        await processLibrary(config);
        downloadSuccess = true;
      } catch (error) {
        console.error(`❌ Failed to download ${config.name}: ${error.message}`);
        console.log("");
        console.log(
          "This is normal - libzmq will be built by the zeromq npm package.",
        );
        console.log("Creating instructions for manual installation...");
        createPlaceholderDLL(config.name);
      }
    }

    if (downloadSuccess) {
      // Create manifest only if we successfully downloaded something
      createManifest();
      console.log("");
      console.log("🎉 ZeroMQ libraries setup completed!");
      console.log("");
      console.log("Files created:");
      CONFIG.files.forEach((f) => {
        const filePath = path.join(CONFIG.outputDir, f.name);
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          console.log(
            `  ✓ ${f.name} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`,
          );
        }
      });
    } else {
      console.log("");
      console.log("ℹ️  No pre-built DLLs were downloaded.");
      console.log(
        "   This is OK - the zeromq npm package includes libzmq and will build it.",
      );
      console.log("");
      console.log("Next steps:");
      console.log("  1. Run 'npm install' to install zeromq package");
      console.log(
        "  2. Run 'npm run rebuild' to build native modules for Electron",
      );
      console.log("");
      console.log(
        "The zeromq package includes libzmq source code and will compile it automatically.",
      );
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.log("");
    console.log("Manual installation instructions:");
    console.log("  1. The zeromq npm package will handle libzmq compilation");
    console.log("  2. Make sure you have Visual Studio Build Tools installed");
    console.log("  3. Run: npm install");
    console.log("  4. Run: npm run rebuild");
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
  console.log("\n👋 Setup cancelled by user");
  process.exit(0);
});

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

module.exports = { main, CONFIG };
