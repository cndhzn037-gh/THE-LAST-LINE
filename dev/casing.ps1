$ErrorActionPreference = "Stop"
$root = Get-Location
$src = (Get-ChildItem -Path $root -Filter "*.html" -File | Where-Object { $_.Name -ne "index.html" } | Sort-Object Length -Descending | Select-Object -First 1).FullName
$txt = [IO.File]::ReadAllText($src, [Text.Encoding]::UTF8)
$nl = [string][char]10

function Sub1($text, $old, $new, $tag) {
  $n = ([regex]::Matches($text, [regex]::Escape($old))).Count
  if ($n -ne 1) { Write-Output ("ABORT " + $tag + " = " + $n); exit 1 }
  return $text.Replace($old, $new)
}

$txt = Sub1 $txt 'function fireBullet(from, target, spreadDeg, dmg, widthMul, chain, sniper) {' 'function fireBullet(from, target, spreadDeg, dmg, widthMul, chain, sniper, auto) {' 'sig'

$oldShell = '  addFlash(from, ang);' + $nl + '  addShell(from, ang, dmg);'
$newLines = @(
  '  addFlash(from, ang);',
  '  /* casing: full-auto weapons eject one every other round, single shots always eject */',
  '  if (auto) {',
  '    from.shellN = (from.shellN || 0) + 1;',
  '    if (from.shellN % 2 === 0) addShell(from, ang, dmg);',
  '  } else {',
  '    from.shellN = 0;',
  '    addShell(from, ang, dmg);',
  '  }'
)
$newShell = [string]::Join($nl, $newLines)
$txt = Sub1 $txt $oldShell $newShell 'shell'

$txt = Sub1 $txt 'var piv = CFG.far.interval, pdmg = CFG.far.dmg, pwm = 1, psp = CFG.far.spreadDeg, pch = false, psn = false;' 'var piv = CFG.far.interval, pdmg = CFG.far.dmg, pwm = 1, psp = CFG.far.spreadDeg, pch = false, psn = false, pau = false;' 'pau-decl'
$txt = Sub1 $txt 'psp = CFG.mg.spreadDeg; pch = true; }' 'psp = CFG.mg.spreadDeg; pch = true; pau = true; }' 'pau-mg'
$txt = Sub1 $txt 'fireBullet(u, _aimTgt, psp, pdmg, pwm, pch, psn);' 'fireBullet(u, _aimTgt, psp, pdmg, pwm, pch, psn, pau);' 'pau-call'

$txt = Sub1 $txt 'fireBullet(u, mt, CFG.mg.spreadDeg, CFG.mg.dmg, CFG.mg.widthMul, true);' 'fireBullet(u, mt, CFG.mg.spreadDeg, CFG.mg.dmg, CFG.mg.widthMul, true, false, true);' 'ai-mg'

$txt = Sub1 $txt 'fireBullet(u, s.nearest, CFG.near.spreadDeg, CFG.near.dmg, 1);' 'fireBullet(u, s.nearest, CFG.near.spreadDeg, CFG.near.dmg, 1, false, false, true);' 'ai-near'

$txt = Sub1 $txt 'fireBullet(u, hz, hg.spread || 0, hg.dmg, hg.wmul || 1, hg.chain, hg.snipe);' 'fireBullet(u, hz, hg.spread || 0, hg.dmg, hg.wmul || 1, hg.chain, hg.snipe, hg.chain);' 'hero'

$enc = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($src, $txt, $enc)
Copy-Item $src (Join-Path $root "deploy\index.html") -Force
Write-Output ("OK html=" + (Get-Item $src).Length)
