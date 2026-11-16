$ErrorActionPreference = "Stop"
$root = Get-Location
$src = (Get-ChildItem -Path $root -Filter "*.html" -File | Where-Object { $_.Name -ne "index.html" } | Sort-Object Length -Descending | Select-Object -First 1).FullName
$txt = [IO.File]::ReadAllText($src, [Text.Encoding]::UTF8)
function Sub1($text, $old, $new, $tag) {
  $n = ([regex]::Matches($text, [regex]::Escape($old))).Count
  if ($n -ne 1) { Write-Output ("ABORT " + $tag + " = " + $n); exit 1 }
  return $text.Replace($old, $new)
}

# pistol (shield's sidearm): explicitly single-shot
$txt = Sub1 $txt 'fireBullet(u, s.nearest, CFG.pistol.spreadDeg, CFG.pistol.dmg, 1);' 'fireBullet(u, s.nearest, CFG.pistol.spreadDeg, CFG.pistol.dmg, 1, false, false, false);' 'pistol'

# rifleman long-range single shot: explicit
$txt = Sub1 $txt 'fireBullet(u, s.nearest, 0, CFG.far.dmg, 1);' 'fireBullet(u, s.nearest, 0, CFG.far.dmg, 1, false, false, false);' 'far'

# sniper: explicit
$txt = Sub1 $txt 'fireBullet(u, s.nearest, 0, CFG.sniper.dmg, CFG.sniper.widthMul, false, true);' 'fireBullet(u, s.nearest, 0, CFG.sniper.dmg, CFG.sniper.widthMul, false, true, false);' 'sniper'

$enc = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($src, $txt, $enc)
Copy-Item $src (Join-Path $root "deploy\index.html") -Force
Write-Output ("OK html=" + (Get-Item $src).Length)
