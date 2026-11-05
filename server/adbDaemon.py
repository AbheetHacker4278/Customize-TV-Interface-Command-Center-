#!/usr/bin/env python3
"""Persistent ADB Daemon for instantaneous Smart TV control.
Keeps an open TCP session with the TV so commands execute in milliseconds instead of seconds.
Listens on local TCP port 5055 (or specified port) for commands and outputs results.
"""
import sys
import os
import socket
import threading
import json
import time

try:
    from adb_shell.adb_device import AdbDeviceTcp
    from adb_shell.auth.sign_pythonrsa import PythonRSASigner
except ImportError:
    _dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cleanyourtv", "tools", "venv")
    _venv = os.path.join(_dir, "Scripts", "python.exe") if os.name == "nt" else os.path.join(_dir, "bin", "python")
    if os.path.isfile(_venv) and not os.environ.get("TV_DAEMON_VENV"):
        os.environ["TV_DAEMON_VENV"] = "1"
        import subprocess
        sys.exit(subprocess.call([_venv, os.path.abspath(__file__)] + sys.argv[1:]))
    sys.exit("adb_shell not found")

TV_HOST = os.environ.get("TV_HOST", "192.168.29.29")
TV_PORT = int(os.environ.get("TV_PORT", "5555"))
SERVER_PORT = int(os.environ.get("DAEMON_PORT", "5055"))

KEY_PATH = os.environ.get("ADB_KEY_PATH", os.path.join(os.path.dirname(os.path.abspath(__file__)), "adbkey", "adbkey"))
if not os.path.isfile(KEY_PATH):
    alt_key = r"C:\Users\Admin\.gemini\antigravity\scratch\cleanyourtv\tools\adbkey\adbkey"
    if os.path.isfile(alt_key):
        KEY_PATH = alt_key

def get_signer():
    with open(KEY_PATH) as f:
        priv = f.read()
    with open(KEY_PATH + ".pub") as f:
        pub = f.read()
    return PythonRSASigner(pub, priv)

device = None
device_lock = threading.Lock()
shell_lock = threading.Lock()

def get_device():
    global device
    with device_lock:
        if device is None or not device.is_connected:
            signer = get_signer()
            dev = AdbDeviceTcp(TV_HOST, TV_PORT, default_transport_timeout_s=6.0)
            dev.connect(rsa_keys=[signer], auth_timeout_s=4.0)
            device = dev
            print(f"[AdbDaemon] Connected to {TV_HOST}:{TV_PORT}", flush=True)
        return device

def handle_client(conn, addr):
    try:
        buffer = ""
        while True:
            data = conn.recv(4096)
            if not data:
                break
            buffer += data.decode("utf-8", errors="replace")
            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                line = line.strip()
                if not line:
                    continue
                
                try:
                    req = json.loads(line)
                    cmd = req.get("cmd", "")
                    req_id = req.get("id", "")
                    req_type = req.get("type", "shell")
                    local_path = req.get("local", "")
                    remote_path = req.get("remote", "")
                except Exception:
                    cmd = line
                    req_id = ""
                    req_type = "shell"

                # Execute on TV with thread-safe serialization
                res = {"id": req_id, "success": True, "output": ""}
                with shell_lock:
                    try:
                        dev = get_device()
                        if req_type == "push":
                            dev.push(local_path, remote_path)
                            res["output"] = f"Pushed {local_path} to {remote_path}"
                        else:
                            output = dev.shell(cmd)
                            res["output"] = output.strip() if output else ""
                    except Exception as e:
                        # Retry once on reconnect
                        global device
                        with device_lock:
                            device = None
                        try:
                            dev = get_device()
                            if req_type == "push":
                                dev.push(local_path, remote_path)
                                res["output"] = f"Pushed {local_path} to {remote_path}"
                            else:
                                output = dev.shell(cmd)
                                res["output"] = output.strip() if output else ""
                        except Exception as e2:
                            res["success"] = False
                            res["error"] = str(e2)

                response_line = json.dumps(res) + "\n"
                conn.sendall(response_line.encode("utf-8"))
    except Exception as err:
        pass
    finally:
        conn.close()

def main():
    print(f"[AdbDaemon] Starting persistent ADB worker for {TV_HOST}:{TV_PORT} on 127.0.0.1:{SERVER_PORT}...", flush=True)
    server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server_sock.bind(("127.0.0.1", SERVER_PORT))
    server_sock.listen(10)

    # Initial warm connect
    threading.Thread(target=get_device, daemon=True).start()

    while True:
        client_sock, client_addr = server_sock.accept()
        t = threading.Thread(target=handle_client, args=(client_sock, client_addr), daemon=True)
        t.start()

if __name__ == "__main__":
    main()
