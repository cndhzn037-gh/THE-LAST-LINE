$ErrorActionPreference = "Stop"
$root = Get-Location
$src = (Get-ChildItem -Path $root -Filter "*.html" -File | Where-Object { $_.Name -ne "index.html" } | Sort-Object Length -Descending | Select-Object -First 1).FullName
$txt = [IO.File]::ReadAllText($src, [Text.Encoding]::UTF8)

$crlf = $txt.Contains([string][char]13 + [string][char]10)
if ($crlf) { $nl = [string][char]13 + [string][char]10 } else { $nl = [string][char]10 }
Write-Output ("newline=CRLF:" + $crlf)

$bad1 = '  drawEndFx();2  drawCursor();2}'
$good1 = '  drawEndFx();' + $nl + '  drawCursor();' + $nl + '}'
$n = ([regex]::Matches($txt, [regex]::Escape($bad1))).Count
if ($n -ne 1) { Write-Output ("ABORT fix1 " + $n); exit 1 }
$txt = $txt.Replace($bad1, $good1)

$bad2 = ');1  if (ptrs[e.pointerId]) ptrs[e.pointerId] = p;'
$good2 = ');' + $nl + '  if (ptrs[e.pointerId]) ptrs[e.pointerId] = p;'
$n = ([regex]::Matches($txt, [regex]::Escape($bad2))).Count
if ($n -ne 1) { Write-Output ("ABORT fix2 " + $n); exit 1 }
$txt = $txt.Replace($bad2, $good2)

$enc = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($src, $txt, $enc)
Write-Output ("OK html=" + (Get-Item $src).Length)
