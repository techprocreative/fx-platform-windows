"""
Startup script for backend that handles .env location
"""
import os
import sys
import traceback
import socket
from pathlib import Path

# Set UTF-8 encoding for Windows console
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except:
        # If reconfigure fails, we'll just avoid emojis
        pass

def find_available_port(start_port: int = 8081, max_attempts: int = 20) -> int:
    """Find an available port starting from start_port"""
    for port in range(start_port, start_port + max_attempts):
        try:
            # Try to bind to the port
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', port))
                # If successful, port is available
                print(f"[OK] Found available port: {port}")
                return port
        except OSError:
            # Port is in use, try next one
            print(f"[INFO] Port {port} is in use, trying next...")
            continue
    
    # If no port found after max_attempts
    raise RuntimeError(f"Could not find available port in range {start_port}-{start_port + max_attempts}")

def save_port_info(port: int, app_path: Path):
    """Save the actual port being used so Electron can find it"""
    try:
        port_file = app_path / 'backend_port.txt'
        port_file.write_text(str(port))
        print(f"[OK] Port info saved to: {port_file}")
    except Exception as e:
        print(f"[WARNING] Could not save port info: {e}")

def main():
    try:
        print("=" * 60)
        print("Windows Executor V2 Backend - Starting...")
        print("=" * 60)
        
        # Determine if running from PyInstaller bundle
        if getattr(sys, 'frozen', False):
            # Running in PyInstaller bundle
            application_path = Path(sys.executable).parent
            print(f"[INFO] Running from bundle: {application_path}")
            
            # Add bundle path to sys.path for imports
            if str(application_path) not in sys.path:
                sys.path.insert(0, str(application_path))
            
            # Also add the _internal directory if it exists (PyInstaller unpacks here)
            internal_path = application_path / '_internal'
            if internal_path.exists() and str(internal_path) not in sys.path:
                sys.path.insert(0, str(internal_path))
                print(f"[INFO] Added _internal to path: {internal_path}")
            
            # In production, .env is in the parent resources directory
            env_file = application_path.parent / '.env'
        else:
            # Running in development
            application_path = Path(__file__).parent
            print(f"[INFO] Running in development: {application_path}")
            
            # Add current directory to sys.path
            if str(application_path) not in sys.path:
                sys.path.insert(0, str(application_path))
            
            env_file = application_path.parent / '.env'

        # Set environment variable for .env location
        if env_file.exists():
            os.environ['WE_V2_ENV_FILE'] = str(env_file)
            print(f"[OK] Found .env at: {env_file}")
        else:
            print(f"[WARNING] .env not found at: {env_file}")
            print("   Backend will use default settings")
            print(f"   Expected location: {env_file}")
            print("")
            print("   To configure:")
            print("   1. Create .env file in the installation folder")
            print("   2. Add these 3 lines:")
            print("      WE_V2_API_KEY=your_api_key")
            print("      WE_V2_API_SECRET=your_api_secret")
            print("      WE_V2_EXECUTOR_ID=your_executor_id")

        print("")
        print("Loading modules...")
        
        # Import with error handling
        try:
            from config import get_settings
            settings = get_settings()
            print("[OK] Configuration loaded")
        except Exception as e:
            print(f"[ERROR] Failed to load configuration: {e}")
            traceback.print_exc()
            return 1

        try:
            from main import app
            print("[OK] FastAPI app loaded")
        except Exception as e:
            print(f"[ERROR] Failed to load FastAPI app: {e}")
            traceback.print_exc()
            return 1

        try:
            import uvicorn
            print("[OK] Uvicorn loaded")
        except Exception as e:
            print(f"[ERROR] Failed to load Uvicorn: {e}")
            traceback.print_exc()
            return 1

        print("")
        print("=" * 60)
        print(">>> Starting Backend Server <<<")
        print("=" * 60)
        
        # Find available port
        requested_port = settings.api_port
        try:
            available_port = find_available_port(requested_port)
            
            if available_port != requested_port:
                print(f"[WARNING] Requested port {requested_port} is in use")
                print(f"[OK] Using alternative port: {available_port}")
            
            # Save port info for Electron to find
            if getattr(sys, 'frozen', False):
                app_folder = Path(sys.executable).parent.parent
            else:
                app_folder = Path(__file__).parent.parent
            
            save_port_info(available_port, app_folder)
            
        except RuntimeError as e:
            print(f"[ERROR] {e}")
            print("Please close other applications using ports 8081-8100")
            return 1
        
        print(f"   Host: {settings.api_host}")
        print(f"   Port: {available_port}")
        print(f"   Debug: {settings.debug}")
        print(f"   Platform: {settings.platform_api_url}")
        print("=" * 60)
        print("")
        print(f"Backend is ready on http://{settings.api_host}:{available_port}")
        print("Press Ctrl+C to stop.")
        print("")
        
        # Run uvicorn with the available port
        uvicorn.run(
            app,
            host=settings.api_host,
            port=available_port,
            log_level="debug" if settings.debug else "info"
        )
        
        return 0
        
    except KeyboardInterrupt:
        print("\n\n[INFO] Backend stopped by user")
        return 0
    except Exception as e:
        print(f"\n\n[FATAL ERROR] {e}")
        print("\nFull error details:")
        traceback.print_exc()
        print("\n" + "=" * 60)
        print("Please check:")
        print("1. .env file exists and is configured")
        print("2. Port 8081 is not in use")
        print("3. All required dependencies are installed")
        print("=" * 60)
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
