; Current-user Windows lifecycle cleanup. Explorer menu integration is retired.
!macro TidyRemoveLegacyExplorerMenu
  DeleteRegKey HKCU "Software\Classes\Directory\shell\Tidy"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\Tidy"
  DeleteRegKey HKCU "Software\Classes\Drive\shell\Tidy"
!macroend

!macro customInstall
  !insertmacro TidyRemoveLegacyExplorerMenu
!macroend

!macro customUnInstall
  ${ifNot} ${isUpdated}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "com.ericauzenne.tidy"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "com.ericauzenne.tidy"
  ${endif}
  !insertmacro TidyRemoveLegacyExplorerMenu
!macroend
