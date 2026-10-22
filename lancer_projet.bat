@echo off
TITLE Serveur Projet mBot2
color 0A

REM Se placer dans le dossier du .bat : sinon le serveur sert le mauvais dossier.
cd /d "%~dp0"

echo ========================================================
echo   LANCEMENT DE L'EDITEUR mBot2 (Technologie Services)
echo ========================================================
echo.
echo Dossier servi : %CD%
echo.

if not exist "index.html" (
  echo ERREUR : index.html est introuvable dans ce dossier.
  pause
  exit /b 1
)

echo Le serveur web tourne dans cette fenetre.
echo ATTENTION : si vous fermez cette fenetre, le serveur s'arretera.
echo Pour envoyer un programme au robot : Chrome ou Edge (Web Serial).
echo.
python app.py

echo.
echo Le serveur s'est arrete.
pause
