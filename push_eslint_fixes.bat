@echo off
cd /d "C:\Users\USER\Documents\wekacargo 2.0"
echo Adding files...
git add frontend/src/pages/*.tsx
echo.
echo Committing changes...
git commit -m "Fix ESLint warnings: remove unused imports and fix React Hook dependencies"
echo.
echo Pushing to remote...
git push origin main
echo.
echo Done!
pause

