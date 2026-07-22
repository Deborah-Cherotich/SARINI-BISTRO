# Keeps the phone/remote-access tunnel (https://andra-tractable-rheba.ngrok-free.dev)
# alive continuously. Unlike just starting ngrok once, this checks every
# 15 seconds and restarts it immediately if it ever stops or crashes, so
# "ngrok not active" becomes a rare, self-healing blip instead of something
# that needs manual attention.

$ngrokPath = Join-Path $env:USERPROFILE "bin\ngrok.exe"
$logPath = Join-Path $PSScriptRoot "tunnel.log"
$errLogPath = Join-Path $PSScriptRoot "tunnel-err.log"
$domain = "https://andra-tractable-rheba.ngrok-free.dev"
$port = 4317

# Prevent two watchdogs from ever running at once (e.g. shortcut launched
# twice, or a manual run while the Startup one is already active). An
# "abandoned" mutex (owner crashed without releasing) still counts as
# acquired for us, so treat that exception as success too.
$mutex = New-Object System.Threading.Mutex($false, "SariniBistroTunnelWatchdog")
try {
    $acquired = $mutex.WaitOne(0)
} catch [System.Threading.AbandonedMutexException] {
    $acquired = $true
}
if (-not $acquired) {
    exit 0
}

while ($true) {
    $running = Get-Process -Name "ngrok" -ErrorAction SilentlyContinue
    if (-not $running) {
        Add-Content -Path $logPath -Value "$(Get-Date -Format o) watchdog: ngrok not running, starting it"
        Start-Process -FilePath $ngrokPath `
            -ArgumentList "http", $port, "--url=$domain", "--log=stdout" `
            -WindowStyle Hidden `
            -RedirectStandardOutput $logPath `
            -RedirectStandardError $errLogPath
    }
    Start-Sleep -Seconds 15
}
