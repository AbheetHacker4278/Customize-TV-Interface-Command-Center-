# Startup script for Smart TV Web Control Center
$ErrorActionPreference = 'Stop'
$repo = $PSScriptRoot

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Starting Smart TV Control Center Local Server..." -ForegroundColor Cyan
Write-Host "Local URL:   http://localhost:5050" -ForegroundColor Green
Write-Host "Network URL: http://192.168.29.159:5050" -ForegroundColor Green
Write-Host "Target TV:   192.168.29.29 (Sony BRAVIA 4K)" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

Set-Location (Join-Path $repo 'server')
node server.js
