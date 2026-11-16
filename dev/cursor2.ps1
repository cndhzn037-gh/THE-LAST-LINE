$ErrorActionPreference = "Stop"
$root = Get-Location
$src = (Get-ChildItem -Path $root -Filter "*.html" -File | Where-Object { $_.Name -ne "index.html" } | Sort-Object Length -Descending | Select-Object -First 1).FullName
$txt = [IO.File]::ReadAllText($src, [Text.Encoding]::UTF8)

$anchor = 'window.addEventListener("pointercancel", onUp);'
$n = ([regex]::Matches($txt, [regex]::Escape($anchor))).Count
if ($n -ne 1) { Write-Output ("ABORT " + $n); exit 1 }
$add = $anchor + [string][char]10 + '  window.addEventListener("blur", function () { UI.pointer.in = false; });'
$txt = $txt.Replace($anchor, $add)

$enc = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($src, $txt, $enc)
Copy-Item $src (Join-Path $root "deploy\index.html") -Force
Write-Output ("OK html=" + (Get-Item $src).Length + "  deploy=" + (Get-Item (Join-Path $root "deploy\index.html")).Length)
