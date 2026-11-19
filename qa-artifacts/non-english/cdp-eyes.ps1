$ErrorActionPreference = "Stop"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$out = "c:\Users\hp\Desktop\update\AI_assessment\qa-artifacts\non-english"
$profile = Join-Path $out "chrome-ud-eyes"
$port = 9335
New-Item -ItemType Directory -Force -Path $profile | Out-Null
$proc = Start-Process -FilePath $chrome -ArgumentList @(
  "--headless=new","--disable-gpu","--no-first-run","--no-default-browser-check","--disable-extensions",
  "--force-device-scale-factor=1","--window-size=1440,900","--user-data-dir=$profile",
  "--remote-debugging-port=$port","about:blank"
) -PassThru -WindowStyle Hidden
for ($i = 0; $i -lt 50; $i++) {
  try { $null = Invoke-RestMethod "http://127.0.0.1:$port/json/version" -TimeoutSec 2; break }
  catch { Start-Sleep -Milliseconds 200 }
}
function Receive-Ws($ws, $ct) {
  $ms = New-Object System.IO.MemoryStream
  $buf = New-Object byte[] 262144
  do {
    $seg = [ArraySegment[byte]]::new($buf)
    $res = $ws.ReceiveAsync($seg, $ct).GetAwaiter().GetResult()
    if ($res.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) { break }
    $ms.Write($buf, 0, $res.Count)
  } while (-not $res.EndOfMessage)
  [Text.Encoding]::UTF8.GetString($ms.ToArray())
}
function Send-Ws($ws, $ct, $obj) {
  $json = $obj | ConvertTo-Json -Compress -Depth 20
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $seg = [ArraySegment[byte]]::new($bytes)
  $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).GetAwaiter().GetResult() | Out-Null
}
function Invoke-Cdp($ws, $ct, $id, $method, $params) {
  $msg = @{ id = $id; method = $method }
  if ($null -ne $params) { $msg.params = $params }
  Send-Ws $ws $ct $msg
  while ($true) {
    $raw = Receive-Ws $ws $ct
    if (-not $raw) { continue }
    try { $obj = $raw | ConvertFrom-Json } catch { continue }
    if ($obj.id -eq $id) { return $obj }
  }
}
try {
  $new = Invoke-RestMethod -Uri "http://127.0.0.1:$port/json/new?http://localhost:3000/signup" -Method Put
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = [System.Threading.CancellationToken]::None
  $ws.ConnectAsync([Uri]$new.webSocketDebuggerUrl, $ct).GetAwaiter().GetResult() | Out-Null
  $null = Invoke-Cdp $ws $ct 1 "Page.enable" $null
  $null = Invoke-Cdp $ws $ct 2 "Emulation.setDeviceMetricsOverride" @{ width = 1440; height = 900; deviceScaleFactor = 1; mobile = $false }
  Start-Sleep -Seconds 2
  $expr = @'
(() => {
  const el = document.querySelector("#password");
  el.scrollIntoView({block:"center", inline:"nearest"});
  const buttons = [...document.querySelectorAll("#password, #confirmPassword")].map(input => {
    const b = input.parentElement.querySelector("button");
    const r = b.getBoundingClientRect();
    const ir = input.getBoundingClientRect();
    return {id: input.id, bx: Math.round(r.x), by: Math.round(r.y), bw: Math.round(r.width), bh: Math.round(r.height), ix: Math.round(ir.x), iy: Math.round(ir.y), iw: Math.round(ir.width), ih: Math.round(ir.height), aria: b.getAttribute("aria-label"), title: b.getAttribute("title")};
  });
  return {buttons, scrollY: Math.round(window.scrollY)};
})()
'@
  $eval = Invoke-Cdp $ws $ct 3 "Runtime.evaluate" @{ expression = $expr; returnByValue = $true }
  $eval.result.result.value | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 (Join-Path $out "signup-eye-after-scroll.json")
  Start-Sleep -Milliseconds 300
  $shot = Invoke-Cdp $ws $ct 4 "Page.captureScreenshot" @{ format = "png" }
  [IO.File]::WriteAllBytes((Join-Path $out "signup-scrolled-password.png"), [Convert]::FromBase64String($shot.result.data))
  "SCROLL_SHOT_OK"
  $ws.Dispose()
} finally {
  if ($proc -and -not $proc.HasExited) { taskkill /PID $proc.Id /T /F | Out-Null }
}
