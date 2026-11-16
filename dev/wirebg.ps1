$ErrorActionPreference = "Stop"
$root = Get-Location
$src = (Get-ChildItem -Path $root -Filter "*.html" -File | Where-Object { $_.Name -ne "index.html" } | Sort-Object Length -Descending | Select-Object -First 1).FullName
$txt = [IO.File]::ReadAllText($src, [Text.Encoding]::UTF8)

$pat = 'background:#0a0d15 url\(data:image/jpeg;base64,[A-Za-z0-9+/=]+\) center/cover no-repeat;padding:20px\}'
$count = ([regex]::Matches($txt, $pat)).Count
if ($count -ne 1) { Write-Output ("ABORT: matches=" + $count); exit 1 }

$txt = [regex]::Replace($txt, $pat, 'background:rgba(6,8,14,.8);padding:20px}')
$enc = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($src, $txt, $enc)
Copy-Item $src (Join-Path $root "deploy\index.html") -Force
Write-Output ("OK html=" + (Get-Item $src).Length + "  deploy=" + (Get-Item (Join-Path $root "deploy\index.html")).Length)
