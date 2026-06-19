@echo off
REM Launcher da app Relationship: arranca o ajudante local e abre o browser.
start "Relationship Helper" powershell -ExecutionPolicy Bypass -WindowStyle Minimized -File "%~dp0RelationshipHelper.ps1"
