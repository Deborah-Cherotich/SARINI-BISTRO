' Launches watchdog.ps1 with no visible console window, so it can run
' quietly in the background every time this PC starts up.
Set WshShell = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & scriptDir & "\watchdog.ps1""", 0, False
Set WshShell = Nothing