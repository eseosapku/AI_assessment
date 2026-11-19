$ErrorActionPreference = "Stop"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$out = "c:\Users\hp\Desktop\update\AI_assessment\qa-artifacts\non-english"
$profile = Join-Path $out "chrome-ud-cdp"
$port = 9333
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
  } catch {
    Start-Sleep -Milliseconds 200
  }
}
if (-not $ready) { throw "devtools port did not open" }

function Receive-Ws($ws, $ct) {
  $ms = New-Object System.IO.MemoryStream
  $buf = New-Object byte[] 131072
  do {
    $seg = [ArraySegment[byte]]::new($buf)
    $res = $ws.ReceiveAsync($seg, $ct).GetAwaiter().GetResult()
    if ($res.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) { break }
    $ms.Write($buf, 0, $res.Count)
  } while (-not $res.EndOfMessage)
  return [Text.Encoding]::UTF8.GetString($ms.ToArray())
}

function Send-Ws($ws, $ct, $obj) {
  $json = $obj | ConvertTo-Json -Compress -Depth 20
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $seg = [ArraySegment[byte]]::new($bytes)
  $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).GetAwaiter().GetResult() | Out-Null
}

function Invoke-Cdp($ws, $ct, $id, $method, $params) {
  $msg = @{ id = $id; method = $method }
  if ($params) { $msg.params = $params }
  Send-Ws $ws $ct $msg
  while ($true) {
    $raw = Receive-Ws $ws $ct
    if (-not $raw) { continue }
    $obj = $raw | ConvertFrom-Json
    if ($obj.id -eq $id) { return $obj }
  }
}

function Connect-Page($url) {
  $new = Invoke-RestMethod -Uri "http://127.0.0.1:$port/json/new?$url" -Method Put
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = [System.Threading.CancellationToken]::None
  $ws.ConnectAsync([Uri]$new.webSocketDebuggerUrl, $ct).GetAwaiter().GetResult() | Out-Null
  return @{ ws = $ws; ct = $ct; target = $new }
}

try {
  $conn = Connect-Page "http://localhost:3000/forgot-password"
  $ws = $conn.ws
  $ct = $conn.ct
  $null = Invoke-Cdp $ws $ct 1 "Page.enable" $null
  $null = Invoke-Cdp $ws $ct 2 "Runtime.enable" $null
  Start-Sleep -Seconds 2
  $expr = @'
(() => {
  const h1 = document.querySelector("h1");
  const chain = [];
  let el = h1;
  while (el) {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    chain.push({tag: el.tagName, id: el.id || "", cls: String(el.className||"").slice(0,100), opacity: s.opacity, color: s.color, bg: s.backgroundColor, display: s.display, visibility: s.visibility, transform: s.transform, y: Math.round(r.y), h: Math.round(r.height), w: Math.round(r.width)});
    el = el.parentElement;
  }
  return {title: document.title, text: (document.body.innerText||"").slice(0,900), chain};
})()
'@
  $eval = Invoke-Cdp $ws $ct 3 "Runtime.evaluate" @{ expression = $expr; returnByValue = $true }
  $eval.result.result.value | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 (Join-Path $out "forgot-layout.json")
  $shot = Invoke-Cdp $ws $ct 4 "Page.captureScreenshot" @{ format = "png"; fromSurface = $true }
  [IO.File]::WriteAllBytes((Join-Path $out "forgot-password-1440x900.png"), [Convert]::FromBase64String($shot.result.data))
  "FORGOT_SHOT_OK"
  $ws.Dispose()

  $conn2 = Connect-Page "http://localhost:3000/signup"
  $ws2 = $conn2.ws
  $ct2 = $conn2.ct
  $null = Invoke-Cdp $ws2 $ct2 1 "Page.enable" $null
  $null = Invoke-Cdp $ws2 $ct2 2 "Runtime.enable" $null
  Start-Sleep -Seconds 2
  $expr2 = @'
(() => {
  const buttons = [...document.querySelectorAll("button")].map(b => {
    const r = b.getBoundingClientRect();
    return {text: (b.innerText||"").trim().slice(0,80), aria: b.getAttribute("aria-label"), title: b.getAttribute("title"), labelledby: b.getAttribute("aria-labelledby"), svg: !!b.querySelector("svg"), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)};
  });
  const country = document.querySelector("#country");
  const opt = country && country.selectedOptions && country.selectedOptions[0];
  const inputs = [...document.querySelectorAll("input")].map(i => {
    const lab = document.querySelector(`label[for="${i.id}"]`);
    return {id: i.id, placeholder: i.getAttribute("placeholder"), label: lab ? lab.innerText.trim() : null};
  });
  const product = [...document.querySelectorAll("body *")].find(e => [...e.childNodes].some(n => n.nodeType===3 && (n.textContent||"").includes("PRODUCT OF")));
  let productBox = null;
  if (product) {
    const r = product.getBoundingClientRect();
    productBox = {text: product.innerText.slice(0,80), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)};
  }
  return {buttons, inputs, countryText: opt ? opt.textContent : null, countryValue: country ? country.value : null, productBox, bodyH: document.body.scrollHeight};
})()
'@
  $eval2 = Invoke-Cdp $ws2 $ct2 3 "Runtime.evaluate" @{ expression = $expr2; returnByValue = $true }
  $eval2.result.result.value | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 (Join-Path $out "signup-layout.json")
  $null = Invoke-Cdp $ws2 $ct2 4 "Runtime.evaluate" @{ expression = "document.querySelector('#password') && document.querySelector('#password').scrollIntoView({block:'center', inline:'nearest'})"; returnByValue = $true }
  Start-Sleep -Milliseconds 400
  $shot2 = Invoke-Cdp $ws2 $ct2 5 "Page.captureScreenshot" @{ format = "png"; fromSurface = $true }
  [IO.File]::WriteAllBytes((Join-Path $out "signup-password-fields.png"), [Convert]::FromBase64String($shot2.result.data))
  "SIGNUP_PASSWORD_SHOT_OK"
  $ws2.Dispose()
} finally {
  if ($proc -and -not $proc.HasExited) {
    taskkill /PID $proc.Id /T /F | Out-Null
  }
}
