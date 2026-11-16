@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$src = (Get-Location).Path; $dst = Join-Path $src 'deploy'; if (-not (Test-Path $dst)) { New-Item -ItemType Directory -Path $dst | Out-Null }; $html = Get-ChildItem -Path $src -Filter '*.html' -File | Where-Object { $_.Name -ne 'index.html' } | Select-Object -First 1; if (-not $html) { Write-Host '根目录找不到主程序 html'; exit 1 }; Copy-Item $html.FullName (Join-Path $dst 'index.html') -Force; foreach ($f in @('sw.js','manifest.json','icon-192.png','icon-512.png')) { $p = Join-Path $src $f; if (Test-Path $p) { Copy-Item $p $dst -Force } }; foreach ($f in @('signal\rtc.html','signal\_worker.js')) { $p = Join-Path $src $f; if (Test-Path $p) { Copy-Item $p $dst -Force } }; Write-Host ('已同步 ' + $html.Name + ' -> deploy\index.html'); Write-Host '已同步 sw.js / manifest.json / 图标'; if (Test-Path (Join-Path $src 'signal\rtc.html')) { Write-Host '已同步 signal 目录的 rtc.html、_worker.js' }"
echo.
echo  deploy 目录已刷新（主程序 + sw.js + manifest + 图标 + 联机页），把整个 deploy 文件夹重新拖到 Cloudflare 即可。
pause
