; FX Platform Executor NSIS Installer Script
; Enhanced Windows integration with proper registry and shortcuts

;--------------------------------
; Include Modern UI

  !include "MUI2.nsh"
  !include "WinVer.nsh"
  !include "x64.nsh"

;--------------------------------
; General

  Name "FX Platform Executor"
  OutFile "FX-Platform-Executor-Setup.exe"
  InstallDir "$PROGRAMFILES64\FX Platform Executor"
  InstallDirRegKey HKLM "Software\FX Platform Executor" "InstallPath"
  RequestExecutionLevel admin

;--------------------------------
; Variables

  Var StartMenuFolder
  Var HasMT5
  Var MT5Path

;--------------------------------
; Interface Settings

  !define MUI_ABORTWARNING
  !define MUI_ICON "resources\icons\icon.ico"
  !define MUI_UNICON "resources\icons\icon.ico"
  !define MUI_HEADERIMAGE
  !define MUI_HEADERIMAGE_BITMAP "resources\icons\icon.ico"

  ; Welcome/Finish page images
  !define MUI_WELCOMEFINISHPAGE_BITMAP "resources\icons\icon.ico"

;--------------------------------
; Pages

  !insertmacro MUI_PAGE_WELCOME
  !insertmacro MUI_PAGE_LICENSE "LICENSE.txt"
  !insertmacro MUI_PAGE_COMPONENTS
  !insertmacro MUI_PAGE_DIRECTORY
  !insertmacro MUI_PAGE_STARTMENU Application $StartMenuFolder
  !insertmacro MUI_PAGE_INSTFILES
  !insertmacro MUI_PAGE_FINISH

  !insertmacro MUI_UNPAGE_WELCOME
  !insertmacro MUI_UNPAGE_CONFIRM
  !insertmacro MUI_UNPAGE_INSTFILES
  !insertmacro MUI_UNPAGE_FINISH

;--------------------------------
; Languages

  !insertmacro MUI_LANGUAGE "English"

;--------------------------------
; Installer Sections

Section "Core Application" SecCore

  SectionIn RO ; Required section

  ; Set output path to the installation directory
  SetOutPath "$INSTDIR"

  ; Main application files
  File /r "dist\*"
  File "package.json"

  ; Resources (DLLs, Expert Advisors, etc.)
  SetOutPath "$INSTDIR\resources"
  File /r "resources\*"

  ; Store installation path
  WriteRegStr HKLM "Software\FX Platform Executor" "InstallPath" "$INSTDIR"

  ; Create uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Add to Add/Remove Programs
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\FX Platform Executor" "DisplayName" "FX Platform Executor"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\FX Platform Executor" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\FX Platform Executor" "DisplayIcon" "$INSTDIR\resources\icons\icon.ico"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\FX Platform Executor" "Publisher" "FX Platform Team"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\FX Platform Executor" "DisplayVersion" "1.0.0"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\FX Platform Executor" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\FX Platform Executor" "NoRepair" 1

SectionEnd

Section "Start Menu Shortcuts" SecShortcuts

  ; Create Start Menu shortcuts
  !insertmacro MUI_STARTMENU_WRITE_BEGIN Application
    CreateDirectory "$SMPROGRAMS\$StartMenuFolder"
    CreateShortCut "$SMPROGRAMS\$StartMenuFolder\FX Platform Executor.lnk" "$INSTDIR\FX Platform Executor.exe" "" "$INSTDIR\resources\icons\icon.ico" 0
    CreateShortCut "$SMPROGRAMS\$StartMenuFolder\Uninstall.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\Uninstall.exe" 0
  !insertmacro MUI_STARTMENU_WRITE_END

SectionEnd

Section "Desktop Shortcut" SecDesktop

  ; Create Desktop shortcut
  CreateShortCut "$DESKTOP\FX Platform Executor.lnk" "$INSTDIR\FX Platform Executor.exe" "" "$INSTDIR\resources\icons\icon.ico" 0

SectionEnd

Section "Auto-Start with Windows" SecAutoStart

  ; Add to Windows startup
  CreateShortCut "$SMSTARTUP\FX Platform Executor.lnk" "$INSTDIR\FX Platform Executor.exe" "" "$INSTDIR\resources\icons\icon.ico" 0
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "FX Platform Executor" "$INSTDIR\FX Platform Executor.exe"

SectionEnd

Section "MT5 Integration" SecMT5

  ; Detect MT5 installations
  Call DetectMT5

  ; Install ZeroMQ libraries to detected MT5 installations
  IfFileExists "$INSTDIR\resources\libs\libzmq-x64.dll" 0 +3
    CopyFiles "$INSTDIR\resources\libs\libzmq-x64.dll" "$MT5Path\MQL5\Libraries\libzmq.dll"

  IfFileExists "$INSTDIR\resources\libs\libzmq-x86.dll" 0 +3
    CopyFiles "$INSTDIR\resources\libs\libzmq-x86.dll" "$PROGRAMFILES32\MetaTrader 5\MQL5\Libraries\libzmq.dll"

  ; Install Expert Advisor
  IfFileExists "$INSTDIR\resources\experts\ZeroMQBridge.ex5" 0 +2
    CopyFiles "$INSTDIR\resources\experts\ZeroMQBridge.ex5" "$MT5Path\MQL5\Experts\ZeroMQBridge.ex5"

  IfFileExists "$INSTDIR\resources\experts\ZeroMQBridge.mq5" 0 +2
    CopyFiles "$INSTDIR\resources\experts\ZeroMQBridge.mq5" "$MT5Path\MQL5\Experts\ZeroMQBridge.mq5"

  ; Create MT5 configuration
  CreateDirectory "$MT5Path\MQL5\Files"
  FileOpen $0 "$MT5Path\MQL5\Files\ZeroMQBridge.json" w
  FileWrite $0 "{"
  FileWrite $0 '"executorId": "default-executor-id",'
  FileWrite $0 '"apiKey": "your-api-key-here",'
  FileWrite $0 '"serverAddress": "tcp://localhost:5555",'
  FileWrite $0 '"timeout": 5000,'
  FileWrite $0 '"heartbeatInterval": 30000,'
  FileWrite $0 '"defaultLots": 0.01,'
  FileWrite $0 '"magicNumber": 12345,'
  FileWrite $0 '"maxDrawdownPercent": 10.0,'
  FileWrite $0 '"maxOrdersPerSymbol": 5,'
  FileWrite $0 '"enablePositionSizing": true'
  FileWrite $0 "}"
  FileClose $0

SectionEnd

Section "Windows Firewall Rules" SecFirewall

  ; Add firewall rules for the application
  ExecWait 'netsh advfirewall firewall delete rule name="FX Platform Executor"'
  ExecWait 'netsh advfirewall firewall add rule name="FX Platform Executor" dir=in action=allow program="$INSTDIR\FX Platform Executor.exe" enable=yes'
  ExecWait 'netsh advfirewall firewall add rule name="FX Platform Executor" dir=out action=allow program="$INSTDIR\FX Platform Executor.exe" enable=yes'

SectionEnd

;--------------------------------
; Descriptions

  LangString DESC_SecCore ${LANG_ENGLISH} "Core application files and required libraries."
  LangString DESC_SecShortcuts ${LANG_ENGLISH} "Create Start Menu shortcuts for easy access."
  LangString DESC_SecDesktop ${LANG_ENGLISH} "Create Desktop shortcut for quick launch."
  LangString DESC_SecAutoStart ${LANG_ENGLISH} "Start FX Platform Executor automatically when Windows starts."
  LangString DESC_SecMT5 ${LANG_ENGLISH} "Install ZeroMQ libraries and Expert Advisor to MetaTrader 5."
  LangString DESC_SecFirewall ${LANG_ENGLISH} "Configure Windows Firewall to allow FX Platform Executor."

  !insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
    !insertmacro MUI_DESCRIPTION_TEXT ${SecCore} $(DESC_SecCore)
    !insertmacro MUI_DESCRIPTION_TEXT ${SecShortcuts} $(DESC_SecShortcuts)
    !insertmacro MUI_DESCRIPTION_TEXT ${SecDesktop} $(DESC_SecDesktop)
    !insertmacro MUI_DESCRIPTION_TEXT ${SecAutoStart} $(DESC_SecAutoStart)
    !insertmacro MUI_DESCRIPTION_TEXT ${SecMT5} $(DESC_SecMT5)
    !insertmacro MUI_DESCRIPTION_TEXT ${SecFirewall} $(DESC_SecFirewall)
  !insertmacro MUI_FUNCTION_DESCRIPTION_END

;--------------------------------
; Functions

Function DetectMT5
  ; Try to detect MT5 in common locations
  StrCpy $HasMT5 "0"

  ; Check Program Files
  IfFileExists "$PROGRAMFILES64\MetaTrader 5\terminal64.exe" 0 +3
    StrCpy $MT5Path "$PROGRAMFILES64\MetaTrader 5"
    StrCpy $HasMT5 "1"
    Goto Done

  IfFileExists "$PROGRAMFILES32\MetaTrader 5\terminal.exe" 0 +3
    StrCpy $MT5Path "$PROGRAMFILES32\MetaTrader 5"
    StrCpy $HasMT5 "1"
    Goto Done

  ; Check AppData (portable installations)
  IfFileExists "$APPDATA\MetaQuotes\Terminal\*.*" 0 +3
    StrCpy $MT5Path "$APPDATA\MetaQuotes\Terminal"
    StrCpy $HasMT5 "1"
    Goto Done

  ; Check registry for custom installations
  ReadRegStr $0 HKLM "SOFTWARE\MetaQuotes\Terminal\5" "Path"
  StrCmp $0 "" Done +2
  StrCpy $MT5Path "$0"
  StrCpy $HasMT5 "1"

Done:
FunctionEnd

;--------------------------------
; Uninstaller Section

Section "Uninstall"

  ; Remove files and folders
  RMDir /r "$INSTDIR"

  ; Remove Start Menu shortcuts
  !insertmacro MUI_STARTMENU_GETFOLDER Application $StartMenuFolder
  Delete "$SMPROGRAMS\$StartMenuFolder\Uninstall.lnk"
  Delete "$SMPROGRAMS\$StartMenuFolder\FX Platform Executor.lnk"
  RMDir "$SMPROGRAMS\$StartMenuFolder"

  ; Remove Desktop shortcut
  Delete "$DESKTOP\FX Platform Executor.lnk"

  ; Remove Auto-start
  Delete "$SMSTARTUP\FX Platform Executor.lnk"
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "FX Platform Executor"

  ; Remove firewall rules
  ExecWait 'netsh advfirewall firewall delete rule name="FX Platform Executor"'

  ; Remove registry keys
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\FX Platform Executor"
  DeleteRegKey HKLM "Software\FX Platform Executor"

SectionEnd

;--------------------------------
; Post-installation Actions

Function .onInstSuccess
  ; Ask if user wants to launch the application
  MessageBox MB_YESNO|MB_ICONINFORMATION "Installation completed successfully!$\n$\nWould you like to launch FX Platform Executor now?" IDNO NoLaunch
    Exec '"$INSTDIR\FX Platform Executor.exe"'
  NoLaunch:
FunctionEnd
