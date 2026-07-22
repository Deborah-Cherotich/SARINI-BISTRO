@echo off
REM Keeps the phone/remote-access link (https://andra-tractable-rheba.ngrok-free.dev)
REM pointed at the Sarini Bistro POS app running on this PC. Only actually
REM reachable while the "Sarini Bistro POS" desktop app is also open, since
REM that's what serves everything on port 4317 — this just tunnels to it.
"%USERPROFILE%\bin\ngrok.exe" http 4317 --url=https://andra-tractable-rheba.ngrok-free.dev --log=stdout --log-format=logfmt >> "%~dp0tunnel.log" 2>&1
