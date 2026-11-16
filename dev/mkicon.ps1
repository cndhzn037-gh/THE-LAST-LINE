param([string]$OutDir = "deploy")

Add-Type -AssemblyName System.Drawing

$W = 512
$bmp = New-Object System.Drawing.Bitmap($W, $W, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gr = [System.Drawing.Graphics]::FromImage($bmp)
$gr.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$gr.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$gr.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

$rnd = New-Object System.Random(81855)
$PI = 3.14159265358979
$YH = 20.0
$HX = 196.0
$HY = 384.0
$HR = 58.0

function Col([int]$a, [int]$r, [int]$g2, [int]$b) { return [System.Drawing.Color]::FromArgb($a, $r, $g2, $b) }
function Min2([int]$v) { if ($v -gt 255) { return 255 } else { return $v } }

function ScaleAt([double]$y) {
  $s = 0.004880 * ($y - $YH)
  if ($s -lt 0.06) { return 0.06 }
  if ($s -gt 3.6) { return 3.6 }
  return $s
}
function ClearAt([double]$y) {
  $t = ($y - 60.0) / 430.0
  if ($t -lt 0) { return 0.0 }
  if ($t -gt 1) { return 1.0 }
  return $t
}
function Fg([int]$r, [int]$g2, [int]$b, [double]$y) {
  $t = 0.52 + 0.48 * (ClearAt $y)
  $nr = [int](16 + ($r - 16) * $t)
  $ng = [int](14 + ($g2 - 14) * $t)
  $nb = [int](30 + ($b - 30) * $t)
  return @($nr, $ng, $nb)
}

function Glow($cx, $cy, $rad, $inner, $outer) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddEllipse([float]($cx - $rad), [float]($cy - $rad), [float]($rad * 2), [float]($rad * 2))
  $br = New-Object System.Drawing.Drawing2D.PathGradientBrush($p)
  $br.CenterPoint = New-Object System.Drawing.PointF([float]$cx, [float]$cy)
  $br.CenterColor = $inner
  $br.SurroundColors = [System.Drawing.Color[]]@($outer)
  $gr.FillPath($br, $p)
  $br.Dispose(); $p.Dispose()
}

function Dot($x, $y, $r, $col) {
  if ($r -lt 0.3) { return }
  $br = New-Object System.Drawing.SolidBrush($col)
  $gr.FillEllipse($br, [float]($x - $r), [float]($y - $r), [float]($r * 2), [float]($r * 2))
  $br.Dispose()
}

function Ln($x1, $y1, $x2, $y2, $col, $w) {
  $pn = New-Object System.Drawing.Pen($col, [float]$w)
  $pn.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pn.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $gr.DrawLine($pn, [float]$x1, [float]$y1, [float]$x2, [float]$y2)
  $pn.Dispose()
}

function Ring($x, $y, $r, $w, $col) {
  $pn = New-Object System.Drawing.Pen($col, [float]$w)
  $gr.DrawEllipse($pn, [float]($x - $r), [float]($y - $r), [float]($r * 2), [float]($r * 2))
  $pn.Dispose()
}

function FlatDisc($x, $y, $r, $body, $rim, $rimW) {
  Dot $x $y ($r + $rimW + 1.5) (Col 240 6 8 16)
  Dot $x $y $r $body
  Ring $x $y $r $rimW $rim
}

function BlobPts($x, $y, $r, $n, $lo, $hi2) {
  $pts = @()
  for ($i = 0; $i -lt ($n * 2); $i++) {
    $a = 2 * $PI * $i / ($n * 2)
    if ($i % 2 -eq 0) { $k = 1.0 } else { $k = $lo + $rnd.NextDouble() * ($hi2 - $lo) }
    $pts += (New-Object System.Drawing.PointF([float]($x + [Math]::Cos($a) * $r * $k), [float]($y + [Math]::Sin($a) * $r * $k)))
  }
  return $pts
}

function FlatBlob($x, $y, $r, $body, $rim, $rimW, $n) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddPolygon([System.Drawing.PointF[]](BlobPts $x $y $r $n 0.74 0.94))
  $br = New-Object System.Drawing.SolidBrush($body)
  $gr.FillPath($br, $p)
  $br.Dispose()
  if ($rimW -gt 0.3) {
    $pn = New-Object System.Drawing.Pen($rim, [float]$rimW)
    $pn.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $gr.DrawPath($pn, $p)
    $pn.Dispose()
  }
  $p.Dispose()
}

function StarSym($x, $y, $r, $n, $c1) {
  for ($i = 0; $i -lt $n * 2; $i++) {
    $a = $PI * 2 * $i / ($n * 2) + 0.14
    if ($i % 2 -eq 0) { $L = $r } else { $L = $r * 0.40 }
    $wid = $L * 0.17
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $pts = [System.Drawing.PointF[]]@(
      (New-Object System.Drawing.PointF([float]($x + [Math]::Cos($a + 1.5708) * $wid), [float]($y + [Math]::Sin($a + 1.5708) * $wid))),
      (New-Object System.Drawing.PointF([float]($x + [Math]::Cos($a) * $L), [float]($y + [Math]::Sin($a) * $L))),
      (New-Object System.Drawing.PointF([float]($x + [Math]::Cos($a - 1.5708) * $wid), [float]($y + [Math]::Sin($a - 1.5708) * $wid)))
    )
    $p.AddPolygon($pts)
    $br = New-Object System.Drawing.SolidBrush($c1)
    $gr.FillPath($br, $p)
    $br.Dispose(); $p.Dispose()
  }
}

# ================= BACKGROUND =================
$bgb = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.PointF(0, 0)),
  (New-Object System.Drawing.PointF(0, 512)),
  (Col 255 26 18 30),
  (Col 255 10 10 18))
$gr.FillRectangle($bgb, 0, 0, 512, 512)
$bgb.Dispose()

Glow 196 384 300 (Col 92 22 70 96) (Col 0 10 10 18)
Glow 120 200 260 (Col 80 54 18 40) (Col 0 10 10 18)
Glow 400 220 260 (Col 80 54 18 40) (Col 0 10 10 18)

# ---- perspective ground grid ----
$dl = @(1.0, 1.6, 2.2, 3.0, 4.0, 5.2, 6.8, 8.8, 11.4, 14.8, 19.2, 25.0, 32.5, 42.0)
foreach ($d in $dl) {
  $yy = $YH + 492.0 / $d
  if ($yy -gt 512) { $yy = 512 }
  $fade = 1.0 - (($yy - $YH) / 492.0)
  $al = [int](6 + 16 * $fade)
  $pn = New-Object System.Drawing.Pen((Col $al 86 76 108), [float](0.7 + 1.3 * (1.0 - $fade)))
  $gr.DrawLine($pn, 0, [float]$yy, 512, [float]$yy)
  $pn.Dispose()
}
for ($k = -11; $k -le 11; $k++) {
  $xe = 256 + $k * 78
  $pn = New-Object System.Drawing.Pen((Col 11 78 72 104), [float]1.0)
  $gr.DrawLine($pn, [float]256, [float]$YH, [float]$xe, [float]512)
  $pn.Dispose()
}

# ================= THE HORDE: fills the whole field, endless =================
$pal = @(
  @(150, 60, 226), @(150, 60, 226), @(150, 60, 226), @(150, 60, 226),
  @(216, 40, 50), @(216, 40, 50), @(216, 40, 50),
  @(112, 54, 140), @(112, 54, 140), @(112, 54, 140),
  @(184, 92, 240)
)
$horde = @()
for ($i = 0; $i -lt 380; $i++) {
  $px = -34 + $rnd.NextDouble() * 580
  $py = 56 + [Math]::Pow($rnd.NextDouble(), 0.72) * 462
  $dx = $px - $HX
  $dy = $py - $HY
  $dd = [Math]::Sqrt($dx * $dx + $dy * $dy)
  if ($dd -lt ($HR + 14)) { continue }
  $rad0 = 6.0 + $rnd.NextDouble() * 7.0
  if ($dd -lt ($HR + 78)) { $rad0 = $rad0 * 1.15 }
  $horde += , @($px, $py, $rad0, $dd)
}
# thin far-field ring: makes the horde read as endless
for ($i = 0; $i -lt 430; $i++) {
  $px = -40 + $rnd.NextDouble() * 592
  $py = 30 + [Math]::Pow($rnd.NextDouble(), 1.45) * 205
  $dx = $px - $HX
  $dy = $py - $HY
  $dd = [Math]::Sqrt($dx * $dx + $dy * $dy)
  if ($dd -lt ($HR + 30)) { continue }
  $horde += , @($px, $py, (5.0 + $rnd.NextDouble() * 5.0), $dd)
}
$horde = $horde | Sort-Object { $_[1] }

foreach ($z in $horde) {
  $px = $z[0]; $py = $z[1]; $rad0 = $z[2]; $dd = $z[3]
  $s = ScaleAt $py
  $rad = $rad0 * $s
  if ($rad -lt 0.5) { continue }
  $c = $pal[$rnd.Next([int]$pal.Count)]
  $fc = Fg $c[0] $c[1] $c[2] $py
  $rc = Fg (Min2 ($c[0] + 70)) (Min2 ($c[1] + 70)) (Min2 ($c[2] + 70)) $py
  FlatBlob $px $py $rad (Col 255 $fc[0] $fc[1] $fc[2]) (Col 255 $rc[0] $rc[1] $rc[2]) (1.2 * $s + 0.5) (4 + $rnd.Next(3))
  if ($dd -lt ($HR + 150) -and $rad -gt 6) {
    $arms = 1 + $rnd.Next(2)
    $ang = [Math]::Atan2($HY - $py, $HX - $px)
    for ($m = 0; $m -lt $arms; $m++) {
      $a = $ang + ($rnd.NextDouble() - 0.5) * 1.1
      $l = $rad * 1.25 + $rnd.NextDouble() * $rad * 0.8
      Ln ($px + [Math]::Cos($a) * $rad * 0.6) ($py + [Math]::Sin($a) * $rad * 0.6) ($px + [Math]::Cos($a) * $l) ($py + [Math]::Sin($a) * $l) (Col 250 $rc[0] $rc[1] $rc[2]) (2.0 * $s + 0.7)
    }
  }
}

# ---- vanguard: the ones already lunging at the line ----
for ($i = 0; $i -lt 16; $i++) {
  $a = $rnd.NextDouble() * 2 * $PI
  $rr = $HR + 26 + $rnd.NextDouble() * 54
  $px = $HX + [Math]::Cos($a) * $rr
  $py = $HY + [Math]::Sin($a) * $rr * 0.92
  $s = ScaleAt $py
  $rad = (10.5 + $rnd.NextDouble() * 5.0) * $s
  $pick = $rnd.Next(3)
  if ($pick -eq 0) { $cc = @(226, 44, 54) } elseif ($pick -eq 1) { $cc = @(158, 62, 234) } else { $cc = @(198, 40, 48) }
  $fc = Fg $cc[0] $cc[1] $cc[2] $py
  $rc = Fg (Min2 ($cc[0] + 78)) (Min2 ($cc[1] + 78)) (Min2 ($cc[2] + 78)) $py
  FlatBlob $px $py $rad (Col 255 $fc[0] $fc[1] $fc[2]) (Col 255 $rc[0] $rc[1] $rc[2]) (1.8 * $s + 0.7) (5 + $rnd.Next(3))
  $ang = [Math]::Atan2($HY - $py, $HX - $px)
  for ($m = 0; $m -lt 2; $m++) {
    $aa = $ang + ($rnd.NextDouble() - 0.5) * 1.0
    $l = $rad * 1.35 + $rnd.NextDouble() * $rad * 0.8
    Ln ($px + [Math]::Cos($aa) * $rad * 0.6) ($py + [Math]::Sin($aa) * $rad * 0.6) ($px + [Math]::Cos($aa) * $l) ($py + [Math]::Sin($aa) * $l) (Col 252 $rc[0] $rc[1] $rc[2]) (2.6 * $s + 0.8)
  }
}

# ---- corpses ringing the position (they already held once) ----
for ($i = 0; $i -lt 46; $i++) {
  $a = $rnd.NextDouble() * 2 * $PI
  $rr2 = $HR + 14 + $rnd.NextDouble() * 44
  $px = $HX + [Math]::Cos($a) * $rr2
  $py = $HY + [Math]::Sin($a) * $rr2 * 0.86
  $s = ScaleAt $py
  $rad = (4.5 + $rnd.NextDouble() * 4.0) * $s
  $fc = Fg 84 32 56 $py
  FlatBlob $px $py $rad (Col 210 $fc[0] $fc[1] $fc[2]) (Col 120 140 50 90) (0.9 * $s + 0.3) (4 + $rnd.Next(3))
}

Glow $HX ($HY + 6) 132 (Col 30 226 240 255) (Col 0 150 190 255)
Dot $HX ($HY + 8) 66 (Col 118 24 34 58)
Dot $HX ($HY + 8) 50 (Col 150 26 38 64)

# ================= LAST STAND: humans in a tight ring =================
$defs = @(
  @(0.3927, "shield",  44, 116, 232, 132, 208, 255, 14.5),
  @(1.1781, "mg",     250, 188,  34, 255, 232, 130, 13.5),
  @(1.9635, "rifle",   26, 186, 246, 132, 236, 255, 13.0),
  @(2.7489, "shield",  44, 116, 232, 132, 208, 255, 14.5),
  @(3.5343, "sniper", 198, 232, 255, 160, 226, 255, 14.0),
  @(4.3197, "shield",  44, 116, 232, 132, 208, 255, 14.5),
  @(5.1051, "mg",     250, 188,  34, 255, 232, 130, 13.5),
  @(5.8905, "rifle",   26, 186, 246, 132, 236, 255, 13.0)
)

$host_ = @()
foreach ($d in $defs) {
  $ang = $d[0] + ($rnd.NextDouble() - 0.5) * 0.26
  $rrj = $HR + ($rnd.NextDouble() - 0.5) * 13
  $ux = $HX + [Math]::Cos($ang) * $rrj
  $uy = $HY + [Math]::Sin($ang) * $rrj
  $host_ += , @($ux, $uy, [double]$d[8], $d[1], $d[2], $d[3], $d[4], $d[5], $d[6], $d[7], $ang)
}
$host_ = $host_ | Sort-Object { $_[1] }

$muzzles = @()
foreach ($u in $host_) {
  $x = $u[0]; $y = $u[1]; $r0 = $u[2]; $kind = $u[3]
  $r1 = $u[4]; $g1 = $u[5]; $b1 = $u[6]
  $rim1 = $u[7]; $rim2 = $u[8]; $rim3 = $u[9]
  $aim = $u[10]
  $s = ScaleAt $y
  $r = $r0 * $s
  $ca = [Math]::Cos($aim)
  $sa = [Math]::Sin($aim)
  $bd = Fg $r1 $g1 $b1 $y
  $rc = Fg $rim1 $rim2 $rim3 $y
  FlatDisc $x $y $r (Col 255 $bd[0] $bd[1] $bd[2]) (Col 255 $rc[0] $rc[1] $rc[2]) (1.4 * $s + 0.6)

  if ($kind -eq "shield") {
    $r1s = 23 * $s; $r2s = 15 * $s
    $ad = $aim * 57.29578
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p.AddArc([float]($x - $r1s), [float]($y - $r1s), [float]($r1s * 2), [float]($r1s * 2), (-62 + $ad), 124)
    $p.AddArc([float]($x - $r2s), [float]($y - $r2s), [float]($r2s * 2), [float]($r2s * 2), (62 + $ad), -124)
    $p.CloseFigure()
    $br = New-Object System.Drawing.SolidBrush((Col 255 132 196 255))
    $gr.FillPath($br, $p)
    $br.Dispose()
    $pn = New-Object System.Drawing.Pen((Col 255 196 236 255), [float](1.4 * $s + 0.6))
    $pn.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $gr.DrawPath($pn, $p)
    $pn.Dispose(); $p.Dispose()
    continue
  }

  if ($kind -eq "sniper") { $bl = 54 * $s } elseif ($kind -eq "mg") { $bl = 30 * $s } else { $bl = 30 * $s }
  $x1 = $x + $ca * $r * 0.3; $y1 = $y + $sa * $r * 0.3
  $x2 = $x + $ca * ($r + $bl); $y2 = $y + $sa * ($r + $bl)
  $gw = 5.2 * $s
  Ln $x1 $y1 $x2 $y2 (Col 255 8 11 16) ($gw + 1.6 * $s)
  Ln $x1 $y1 $x2 $y2 (Col 255 118 138 162) ($gw * 0.55)
  $muzzles += , @($x2, $y2, $aim, $kind, $s)
}

# protected civilians packed inside the ring
$inner = @(@(0.9, 44, 206, 122, 168, 250, 194), @(3.9, 52, 210, 130, 174, 252, 198))
foreach ($im in $inner) {
  $ix = $HX + [Math]::Cos($im[0]) * 26
  $iy = $HY + [Math]::Sin($im[0]) * 24
  $ss = ScaleAt $iy
  FlatDisc $ix $iy (10.0 * $ss) (Col 255 $im[1] $im[2] $im[3]) (Col 255 $im[4] $im[5] $im[6]) (1.5 * $ss + 0.6)
}

# blood pooled on the ground inside the perimeter
for ($i = 0; $i -lt 40; $i++) {
  $a = $rnd.NextDouble() * 2 * $PI
  $rr3 = $rnd.NextDouble() * ($HR - 6)
  $px = $HX + [Math]::Cos($a) * $rr3
  $py = $HY + [Math]::Sin($a) * $rr3 * 0.92
  Dot $px $py (2.0 + $rnd.NextDouble() * 6.0) (Col (30 + $rnd.Next(40)) 120 22 34)
}

# squad leader / protected civilian in the middle
$cs = ScaleAt $HY
FlatDisc $HX ($HY + 4) (11.5 * $cs) (Col 255 128 208 255) (Col 255 214 246 255) (1.8 * $cs + 0.7)

Glow $HX $HY 150 (Col 34 214 236 255) (Col 0 160 200 255)

# ================= FIRE: tracers radiating outward =================
function Tracer($x1, $y1, $x2, $y2, $w, $r, $g2, $b) {
  $N = 8
  for ($i = 0; $i -lt $N; $i++) {
    $t0 = $i / $N; $t1 = ($i + 1) / $N
    $ax = $x1 + ($x2 - $x1) * $t0; $ay = $y1 + ($y2 - $y1) * $t0
    $bx = $x1 + ($x2 - $x1) * $t1; $by = $y1 + ($y2 - $y1) * $t1
    $k = 1.0 - $t0 * 0.62
    $a1 = [int](34 * $k); $a2 = [int](92 * $k); $a3 = [int](248 * $k)
    Ln $ax $ay $bx $by (Col $a1 $r $g2 $b) ($w * 5.0)
    Ln $ax $ay $bx $by (Col $a2 $r $g2 $b) ($w * 2.2)
    Ln $ax $ay $bx $by (Col $a3 (Min2 ($r + 60)) (Min2 ($g2 + 60)) (Min2 ($b + 60))) $w
  }
}

foreach ($m in $muzzles) {
  $mx = $m[0]; $my = $m[1]; $aim = $m[2]; $kind = $m[3]; $s = $m[4]
  $len = 70 + $rnd.NextDouble() * 86
  if ($kind -eq "sniper") { $len = 196; }
  $ex = $mx + [Math]::Cos($aim) * $len
  $ey = $my + [Math]::Sin($aim) * $len
  if ($kind -eq "sniper") { Tracer $mx $my $ex $ey 1.1 150 234 255 }
  elseif ($kind -eq "mg") { Tracer $mx $my $ex $ey 1.1 255 208 96 }
  else { Tracer $mx $my $ex $ey 0.9 255 236 168 }
}

# ================= MUZZLE FLASH =================
function Flash($x, $y, $len, $spikes) {
  Glow $x $y ($len * 1.2) (Col 92 255 228 158) (Col 0 255 176 54)
  for ($i = 0; $i -lt $spikes; $i++) {
    $a = $PI * 2 * $i / $spikes + $rnd.NextDouble() * 0.4
    $L = $len * (0.42 + $rnd.NextDouble() * 0.54)
    $wid = $L * 0.27
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $pts2 = [System.Drawing.PointF[]]@(
      (New-Object System.Drawing.PointF([float]($x + [Math]::Cos($a + 1.5708) * $wid), [float]($y + [Math]::Sin($a + 1.5708) * $wid))),
      (New-Object System.Drawing.PointF([float]($x + [Math]::Cos($a) * $L), [float]($y + [Math]::Sin($a) * $L))),
      (New-Object System.Drawing.PointF([float]($x + [Math]::Cos($a - 1.5708) * $wid), [float]($y + [Math]::Sin($a - 1.5708) * $wid)))
    )
    $p.AddPolygon($pts2)
    $br = New-Object System.Drawing.SolidBrush((Col 180 255 232 172))
    $gr.FillPath($br, $p)
    $br.Dispose(); $p.Dispose()
  }
  Dot $x $y ($len * 0.30) (Col 255 255 254 244)
}

foreach ($m in $muzzles) {
  Flash $m[0] $m[1] (13 + $rnd.NextDouble() * 8) (6 + $rnd.Next(3))
}

# ================= BLOOD SPRAY AROUND THE POSITION =================
for ($i = 0; $i -lt 150; $i++) {
  $a = $rnd.NextDouble() * 2 * $PI
  $rr2 = $HR + 20 + $rnd.NextDouble() * 130
  $px = $HX + [Math]::Cos($a) * $rr2
  $py = $HY + [Math]::Sin($a) * $rr2 * 0.82
  if ($py -lt 40 -or $py -gt 512) { continue }
  Dot $px $py (0.8 + $rnd.NextDouble() * 3.0) (Col (34 + $rnd.Next(66)) 176 28 40)
}
for ($i = 0; $i -lt 40; $i++) {
  $a = $rnd.NextDouble() * 2 * $PI
  $rr2 = $HR + 10 + $rnd.NextDouble() * 90
  $px = $HX + [Math]::Cos($a) * $rr2
  $py = $HY + [Math]::Sin($a) * $rr2 * 0.82
  $ln = 2.5 + $rnd.NextDouble() * 8.0
  $aa = ($rnd.NextDouble() - 0.5) * 2.8
  Ln $px $py ($px + [Math]::Cos($aa) * $ln) ($py + [Math]::Sin($aa) * $ln) (Col (130 + $rnd.Next(115)) 255 210 136) (1.0 + $rnd.NextDouble())
}

# ================= VIGNETTE (heavy: the walls are closing in) =================
$vg = New-Object System.Drawing.Drawing2D.GraphicsPath
$vg.AddEllipse([float]-120, [float]-120, [float]752, [float]752)
$vbr = New-Object System.Drawing.Drawing2D.PathGradientBrush($vg)
$vbr.CenterPoint = New-Object System.Drawing.PointF([float]252, [float]330)
$vbr.CenterColor = (Col 0 0 0 0)
$vbr.SurroundColors = [System.Drawing.Color[]]@((Col 74 0 0 0))
$gr.FillPath($vbr, $vg)
$vbr.Dispose(); $vg.Dispose()

# ================= EXPORT =================
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }
$big = Join-Path $OutDir "icon-512.png"
$bmp.Save($big, [System.Drawing.Imaging.ImageFormat]::Png)

$small = New-Object System.Drawing.Bitmap(192, 192, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$sg = [System.Drawing.Graphics]::FromImage($small)
$sg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$sg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$sg.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$sg.DrawImage($bmp, (New-Object System.Drawing.Rectangle(0, 0, 192, 192)), (New-Object System.Drawing.Rectangle(0, 0, 512, 512)), [System.Drawing.GraphicsUnit]::Pixel)
$sg.Dispose()
$sm = Join-Path $OutDir "icon-192.png"
$small.Save($sm, [System.Drawing.Imaging.ImageFormat]::Png)
$small.Dispose()

$gr.Dispose(); $bmp.Dispose()
Write-Output ("OK " + (Get-Item $big).Length + " / " + (Get-Item $sm).Length)