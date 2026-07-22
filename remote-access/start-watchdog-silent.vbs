' Launches watchdog.ps1 with no visible window, so it can run quietly in
' the background for as long as the PC is on, continuously keeping the
' phone/remote-access tunnel alive (auto-restarting it if it ever crashes).
Set WshShell = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File " & chr(34) & scriptDir & "\watchdog.ps1" & chr(34)
WshShell.Run command, 0, False
Set WshShell = Nothing
