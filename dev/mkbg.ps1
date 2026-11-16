param([string]$Src = "deploy\icon-512.png", [string]$Out = "deploy\panel-bg.jpg", [double]$K = 0.18, [int]$Size = 1024, [int]$Q = 88)

Add-Type -AssemblyName System.Drawing

$img = [System.Drawing.Image]::FromFile((Resolve-Path $Src))
$big = New-Object System.Drawing.Bitmap([System.Drawing.Image]$img, [int]$Size, [int]$Size)
$img.Dispose()

$bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$r = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
$g.DrawImage([System.Drawing.Image]$big, $r)
$g.Dispose()
$big.Dispose()

# bake the "very faint over dark UI" look into opaque pixels
$br = 8.0; $bgc = 10.0; $bb = 17.0
$data = $bmp.LockBits($r, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$bytes = New-Object byte[] ($data.Stride * $Size)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
for ($i = 0; $i -lt $bytes.Length; $i += 4) {
  $bytes[$i]     = [byte]([int]($br + ($bytes[$i] - $br) * $K))
  $bytes[$i + 1] = [byte]([int]($bgc + ($bytes[$i + 1] - $bgc) * $K))
  $bytes[$i + 2] = [byte]([int]($bb + ($bytes[$i + 2] - $bb) * $K))
  $bytes[$i + 3] = 255
}
[System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $data.Scan0, $bytes.Length)
$bmp.UnlockBits($data)

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$Q)
$outPath = Join-Path (Get-Location) $Out
$bmp.Save($outPath, $codec, $ep)
$bmp.Dispose()

$len = (Get-Item $Out).Length
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($outPath))
[IO.File]::WriteAllText((Join-Path (Get-Location) "deploy\panel-bg.b64"), $b64)
Write-Output ("jpg=" + $len + "  b64=" + $b64.Length)
