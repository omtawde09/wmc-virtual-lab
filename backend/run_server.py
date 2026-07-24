"""
Frozen-exe entrypoint for the WMC Virtual Lab backend.
=====================================================
Run directly (python run_server.py) or as the packaged WMC-Lab-Backend.exe.

Deliberately runs uvicorn with reload=False and by passing the imported `app`
object (not the "main:app" import string): the reloader spawns child processes
that do not work inside a PyInstaller one-file build, and the import-string form
re-imports the module which also breaks when frozen.
"""

import sys
import socket


def _pause(msg: str = "Press Enter to exit...") -> None:
    """
    Waits for the user before the console window closes.

    Guarded because stdin is not always available: if the exe is launched
    without a console (or its output is piped/redirected), a bare input() raises
    EOFError and turns a friendly message into a crash traceback.
    """
    try:
        input(msg)
    except (EOFError, KeyboardInterrupt, OSError):
        pass


def _port_is_free(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex((host, port)) != 0


def main() -> None:
    host = "127.0.0.1"
    port = 8000

    print("=" * 60)
    print("  Wireless & Mobile Communication - Virtual Lab")
    print("  Local backend server")
    print("=" * 60)

    if not _port_is_free(host, port):
        print(f"\n[!] Port {port} is already in use.")
        print("    The backend may already be running in another window.")
        print("    Close it first, then run this again.\n")
        _pause()
        sys.exit(1)

    # Import the app only after the port check, so a duplicate launch exits fast.
    import uvicorn
    from main import app

    print(f"\n  Server:   http://{host}:{port}")
    print(f"  API docs: http://{host}:{port}/docs")
    print("\n  Keep this window OPEN while using the web app.")
    print("  Close this window to stop the backend.\n")
    print("  Reminders:")
    print("   - Practicals 6 & 7 need Bluetooth turned ON in Windows Settings.")
    print("   - Practicals 4, 8 & 9 need an active Wi-Fi connection.")
    print("-" * 60 + "\n")

    try:
        uvicorn.run(app, host=host, port=port, log_level="info", reload=False)
    except KeyboardInterrupt:
        pass
    except Exception as exc:  # surface the error instead of the window vanishing
        print(f"\n[!] Server stopped with an error: {exc}\n")
        _pause()
        sys.exit(1)


if __name__ == "__main__":
    main()
