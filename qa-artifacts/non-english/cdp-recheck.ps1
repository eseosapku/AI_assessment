$ErrorActionPreference = "Stop"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$out = "c:\Users\hp\Desktop\update\AI_assessment\qa-artifacts\non-english"
$profile = Join-Path $out "chrome-ud-cdp2"
$port = 9334
New-Item -ItemType Directory -Force -Path $profile | Out-Null

$proc = Start-Process -FilePath $chrome -ArgumentList @(
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-extensions",
  "--force-device-scale-factor=1",
  "--window-size=1440,900",
  "--user-data-dir=$profile",
  "--remote-debugging-port=$port",
  "about:blank"
) -PassThru -WindowStyle Hidden

$ready = $false
for ($i = 0; $i -lt 50; $i++) {
  try {
    $null = Invoke-RestMethod -Uri "http://127.0.0.1:$port/json/version" -TimeoutSec 2
    $ready = $true
    break
  } catch { Start-Sleep -Milliseconds 200 }
}
if (-not $ready) { throw "devtools port did not open" }

function Receive-Ws($ws, $ct) {
  $ms = New-Object System.IO.MemoryStream
  $buf = New-Object byte[] 262144
  do {
    $seg = [ArraySegment[byte]]::new($buf)
    $res = $ws.ReceiveAsync($seg, $ct).GetAwaiter().GetResult()
    if ($res.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) { break }
    $ms.Write($buf, 0, $res.Count)
  } while (-not $res.EndOfMessage)
  return [Text.Encoding]::UTF8.GetString($ms.ToArray())
}
function Send-Ws($ws, $ct, $obj) {
  $json = $obj | ConvertTo-Json -Compress -Depth 30
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
function Connect-Page($url) {
  $encoded = [Uri]::EscapeDataString($url)
  # Chrome json/new expects the raw URL as the query, not fully escaped.
  $new = Invoke-RestMethod -Uri ("http://127.0.0.1:{0}/json/new?{1}" -f $port, $url) -Method Put
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = [System.Threading.CancellationToken]::None
  $ws.ConnectAsync([Uri]$new.webSocketDebuggerUrl, $ct).GetAwaiter().GetResult() | Out-Null
  return @{ ws = $ws; ct = $ct }
}

try {
  $c = Connect-Page "http://localhost:3000/forgot-password"
  $null = Invoke-Cdp $c.ws $c.ct 1 "Page.enable" $null
  $null = Invoke-Cdp $c.ws $c.ct 2 "Runtime.enable" $null
  $null = Invoke-Cdp $c.ws $c.ct 3 "Emulation.setDeviceMetricsOverride" @{ width = 1440; height = 900; deviceScaleFactor = 1; mobile = $false }
  Start-Sleep -Seconds 5
  $expr = @'
(() => {
  const el = document.querySelector("main .w-full.max-w-md");
  const anims = el ? el.getAnimations({subtree:true}).map(a => ({name: a.animationName || a.id || "", playState: a.playState, currentTime: a.currentTime, pending: !!a.pending})) : [];
  return {
    opacity: el ? getComputedStyle(el).opacity : null,
    transform: el ? getComputedStyle(el).transform : null,
    inline: el ? el.getAttribute("style") : null,
    reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    anims,
    textSample: (document.body.innerText || "").slice(0, 240),
    vw: window.innerWidth,
    vh: window.innerHeight
  };
})()
'@
  $eval = Invoke-Cdp $c.ws $c.ct 4 "Runtime.evaluate" @{ expression = $expr; returnByValue = $true }
  $eval.result.result.value | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 (Join-Path $out "forgot-opacity.json")
  $shot = Invoke-Cdp $c.ws $c.ct 5 "Page.captureScreenshot" @{ format = "png"; fromSurface = $true }
  [IO.File]::WriteAllBytes((Join-Path $out "forgot-password-1440x900.png"), [Convert]::FromBase64String($shot.result.data))
  "FORGOT_OK opacity_written"
  $c.ws.Dispose()

  $c2 = Connect-Page "http://localhost:3000/signup"
  $null = Invoke-Cdp $c2.ws $c2.ct 1 "Page.enable" $null
  $null = Invoke-Cdp $c2.ws $c2.ct 2 "Runtime.enable" $null
  $null = Invoke-Cdp $c2.ws $c2.ct 3 "Emulation.setDeviceMetricsOverride" @{ width = 1440; height = 1500; deviceScaleFactor = 1; mobile = $false }
  Start-Sleep -Seconds 2
  $expr2 = @'
(() => {
  const buttons = [...document.querySelectorAll("button")].filter(b => !b.innerText.trim() && !b.getAttribute("aria-label")).map(b => {
    const r = b.getBoundingClientRect();
    return {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), html: b.outerHTML.slice(0, 180)};
  });
  const phrase = [...document.querySelectorAll("body *")].filter(e => (e.innerText||"").includes("PRODUCT OF") && e.children.length < 4).slice(0, 3).map(e => {
    const r = e.getBoundingClientRect();
    return {text: e.innerText.trim().slice(0, 120), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)};
  });
  return {buttons, phrase, vh: window.innerHeight};
})()
'@
  $eval2 = Invoke-Cdp $c2.ws $c2.ct 4 "Runtime.evaluate" @{ expression = $expr2; returnByValue = $true }
  $eval2.result.result.value | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 (Join-Path $out "signup-eye-layout.json")
  $btns = $eval2.result.result.value.buttons
  if ($btns -and $btns.Count -ge 1) {
    $b = $btns[0]
    $clipY = [Math]::Max(0, $b.y - 80)
    $shot2 = Invoke-Cdp $c2.ws $c2.ct 5 "Page.captureScreenshot" @{ format = "png"; clip = @{ x = 820; y = $clipY; width = 560; height = 360; scale = 1 } }
    [IO.File]::WriteAllBytes((Join-Path $out "signup-eye-buttons.png"), [Convert]::FromBase64String($shot2.result.data))
    "EYE_SHOT y=$clipY"
  } else {
    "NO_EYE_BUTTONS"
  }
  $c2.ws.Dispose()
} finally {
  if ($proc -and -not $proc.HasExited) { taskkill /PID $proc.Id /T /F | Out-Null }
}
