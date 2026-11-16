Add-Type -AssemblyName System.Drawing
$outDir = Join-Path $env:TEMP "out2icon"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$size = 512
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$rect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(255,10,14,20)), ([System.Drawing.Color]::FromArgb(255,4,6,10)), 90.0
$g.FillRectangle($bg, $rect)
$glow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(26,90,140,220))
$g.FillEllipse($glow, 96, 96, 320, 320)
$glow2 = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(34,60,110,200))
$g.FillEllipse($glow2, 150, 150, 212, 212)
$human = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255,110,235,150))
$zomb = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255,215,70,140))
$g.FillEllipse($human, 118, 176, 56, 56)
$g.FillEllipse($human, 118, 244, 48, 48)
$g.FillEllipse($human, 132, 152, 34, 34)
$g.FillEllipse($zomb, 338, 176, 56, 56)
$g.FillEllipse($zomb, 346, 244, 48, 48)
$g.FillEllipse($zomb, 346, 152, 34, 34)
$penW = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(230,235,245,255)), 7
$g.DrawLine($penW, 256, 138, 256, 374)
$penB = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(90,120,170,255)), 3
$g.DrawEllipse($penB, 34, 34, 444, 444)
$g.Dispose()
$bmp.Save((Join-Path $outDir "icon-512.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$small = New-Object System.Drawing.Bitmap 192, 192
$g2 = [System.Drawing.Graphics]::FromImage($small)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.DrawImage($bmp, 0, 0, 192, 192)
$g2.Dispose()
$small.Save((Join-Path $outDir "icon-192.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$small.Dispose()
$bmp.Dispose()
Write-Output $outDir
