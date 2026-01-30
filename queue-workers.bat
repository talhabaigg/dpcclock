@echo off
echo Starting 3 parallel queue workers...

start "Queue Worker 1" cmd /k php artisan queue:work redis --queue=high,default,low --sleep=3 --tries=3
start "Queue Worker 2" cmd /k php artisan queue:work redis --queue=high,default,low --sleep=3 --tries=3
start "Queue Worker 3" cmd /k php artisan queue:work redis --queue=high,default,low --sleep=3 --tries=3

echo Queue workers started in separate windows.
