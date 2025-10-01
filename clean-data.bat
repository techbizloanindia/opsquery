@echo off
echo Starting database cleanup...
echo.

echo Cleaning queries...
curl -X DELETE http://localhost:3000/api/clear-queries
echo.
echo.

echo Cleaning messages...
curl -X DELETE http://localhost:3000/api/clear-messages
echo.
echo.

echo Verifying chat archives are preserved...
curl -X GET http://localhost:3000/api/chat-archives
echo.
echo.

echo Cleanup complete!
pause
