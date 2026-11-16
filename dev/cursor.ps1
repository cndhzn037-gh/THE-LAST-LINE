$ErrorActionPreference = "Stop"
$root = Get-Location
$src = (Get-ChildItem -Path $root -Filter "*.html" -File | Where-Object { $_.Name -ne "index.html" } | Sort-Object Length -Descending | Select-Object -First 1).FullName
$txt = [IO.File]::ReadAllText($src, [Text.Encoding]::UTF8)

# 1) hide the system cursor over the canvas only
$oldCss = '#cv{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}'
$newCss = '#cv{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:none}'
$n = ([regex]::Matches($txt, [regex]::Escape($oldCss))).Count
if ($n -ne 1) { Write-Output ("ABORT css " + $n); exit 1 }
$txt = $txt.Replace($oldCss, $newCss)

# 2) record whether the pointer is a mouse or a finger
$patMove = '  UI\.pointer\.x = p\.x; UI\.pointer\.y = p\.y; UI\.pointer\.in = true;(\r?\n)  if \(ptrs\[e\.pointerId\]\) ptrs\[e\.pointerId\] = p;'
$repMove = '  UI.pointer.x = p.x; UI.pointer.y = p.y; UI.pointer.in = true; UI.pointer.mouse = (e.pointerType !== "touch");1  if (ptrs[e.pointerId]) ptrs[e.pointerId] = p;'
$n = ([regex]::Matches($txt, $patMove)).Count
if ($n -ne 1) { Write-Output ("ABORT move " + $n); exit 1 }
$txt = [regex]::Replace($txt, $patMove, $repMove)

# 3) call the cursor draw at the very end of render()
$patEnd = '(  drawEndFx\(\);)(\r?\n)\}'
$repEnd = '  drawEndFx();2  drawCursor();2}'
$n = ([regex]::Matches($txt, $patEnd)).Count
if ($n -ne 1) { Write-Output ("ABORT endfx " + $n); exit 1 }
$txt = [regex]::Replace($txt, $patEnd, $repEnd)

# 4) the cursor drawer itself
$cursorFn = @'
/* pointer: the system cursor is hidden, so we paint a small white dot instead */
function drawCursor() {
  if (!UI.pointer.in || !UI.pointer.mouse) return;
  if (overlayEl && overlayEl.className === "show") return;
  if (typeof document.elementFromPoint !== "function") return;
  var cr = CANVAS.getBoundingClientRect ? CANVAS.getBoundingClientRect() : { left: 0, top: 0 };
  var hit = document.elementFromPoint(cr.left + UI.pointer.x, cr.top + UI.pointer.y);
  if (hit !== CANVAS) return;
  var x = UI.pointer.x, y = UI.pointer.y;
  CTX.setTransform(DPR, 0, 0, DPR, 0, 0);
  CTX.globalAlpha = 1;
  var gl = CTX.createRadialGradient(x, y, 0, x, y, 10);
  gl.addColorStop(0, "rgba(255,255,255,0.28)");
  gl.addColorStop(0.55, "rgba(200,225,255,0.09)");
  gl.addColorStop(1, "rgba(200,225,255,0)");
  CTX.fillStyle = gl;
  CTX.beginPath(); CTX.arc(x, y, 10, 0, TAU); CTX.fill();
  CTX.beginPath(); CTX.arc(x, y, 4.3, 0, TAU);
  CTX.fillStyle = "rgba(8,10,16,0.55)";
  CTX.fill();
  CTX.beginPath(); CTX.arc(x, y, 3.2, 0, TAU);
  CTX.fillStyle = "#ffffff";
  CTX.fill();
}

'@
$anchor = 'function drawEditOverlay(z) {'
$n = ([regex]::Matches($txt, [regex]::Escape($anchor))).Count
if ($n -ne 1) { Write-Output ("ABORT anchor " + $n); exit 1 }
$txt = $txt.Replace($anchor, $cursorFn + $anchor)

$enc = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($src, $txt, $enc)
Copy-Item $src (Join-Path $root "deploy\index.html") -Force
Write-Output ("OK html=" + (Get-Item $src).Length)
