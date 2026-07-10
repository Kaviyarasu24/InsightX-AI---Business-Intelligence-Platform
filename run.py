import subprocess
import sys
import time
import os

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    frontend_dir = os.path.join(root_dir, "frontend")

    print("=" * 60)
    print("Starting InsightX AI Platform Development Servers...")
    print("=" * 60)

    # Launch FastAPI backend
    print("\n[Backend] Launching FastAPI on http://127.0.0.1:8000...")
    backend_cmd = [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"]
    backend_proc = subprocess.Popen(
        backend_cmd,
        cwd=backend_dir,
        stdout=sys.stdout,
        stderr=sys.stderr
    )

    # Launch React frontend (shell=True is required for npm on Windows)
    print("[Frontend] Launching Vite on http://localhost:5173...")
    frontend_cmd = "npm run dev"
    frontend_proc = subprocess.Popen(
        frontend_cmd,
        cwd=frontend_dir,
        shell=True,
        stdout=sys.stdout,
        stderr=sys.stderr
    )

    print("\nServers are running. Press Ctrl+C to stop both servers.")
    print("=" * 60 + "\n")

    try:
        while True:
            # Check if either process died
            backend_rc = backend_proc.poll()
            frontend_rc = frontend_proc.poll()

            if backend_rc is not None:
                print(f"\n[Backend] Process exited unexpectedly with code {backend_rc}")
                break
            if frontend_rc is not None:
                print(f"\n[Frontend] Process exited unexpectedly with code {frontend_rc}")
                break

            time.sleep(1)

    except KeyboardInterrupt:
        print("\n" + "=" * 60)
        print("Shutting down InsightX AI dev servers...")
        print("=" * 60)
    finally:
        # Graceful cleanup
        try:
            print("[Backend] Stopping FastAPI...")
            backend_proc.terminate()
            backend_proc.wait(timeout=3)
        except Exception:
            pass

        try:
            print("[Frontend] Stopping Vite...")
            if os.name == 'nt':
                # taskkill ensures all child processes of the npm cmd shell are terminated
                subprocess.run(
                    f"taskkill /F /T /PID {frontend_proc.pid}", 
                    shell=True, 
                    stdout=subprocess.DEVNULL, 
                    stderr=subprocess.DEVNULL
                )
            else:
                frontend_proc.terminate()
                frontend_proc.wait(timeout=3)
        except Exception:
            pass

        print("\nBoth servers stopped successfully.")

if __name__ == "__main__":
    main()
