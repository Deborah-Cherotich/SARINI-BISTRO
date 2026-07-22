' Launches start-tunnel.bat with no visible console window, so it can run
' quietly in the background every time this PC starts up.
Set WshShell = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.Run chr(34) & scriptDir & "\start-tunnel.bat" & chr(34), 0, False
Set WshShell = Nothing
