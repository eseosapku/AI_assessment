$ErrorActionPreference = "Stop"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$out = "c:\Users\hp\Desktop\update\AI_assessment\qa-artifacts\non-english"

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
  $json = $obj | ConvertTo-Json -Compress -Depth 12
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

function Test-Lang($lang, $port) {
  $profile = Join-Path $out "chrome-ud-lang-$lang"
  New-Item -ItemType Directory -Force -Path $profile | Out-Null
  $proc = Start-Process -FilePath $chrome -ArgumentList @(
    "--headless=new","--disable-gpu","--no-first-run","--no-default-browser-check","--disable-extensions",
    "--lang=$lang","--accept-lang=$lang","--window-size=1440,900","--user-data-dir=$profile",
    "--remote-debugging-port=$port","about:blank"
  ) -PassThru -WindowStyle Hidden
  try {
    for ($i = 0; $i -lt 50; $i++) {
      try { $null = Invoke-RestMethod "http://127.0.0.1:$port/json/version" -TimeoutSec 2; break }
      catch { Start-Sleep -Milliseconds 200 }
    }
    $lines = @()
    foreach ($url in @("http://localhost:3000/","http://localhost:3000/signup","http://localhost:3000/forgot-password")) {
      $new = Invoke-RestMethod -Uri "http://127.0.0.1:$port/json/new?$url" -Method Put
      $ws = New-Object System.Net.WebSockets.ClientWebSocket
      $ct = [System.Threading.CancellationToken]::None
      $ws.ConnectAsync([Uri]$new.webSocketDebuggerUrl, $ct).GetAwaiter().GetResult() | Out-Null
      $null = Invoke-Cdp $ws $ct 1 "Runtime.enable" $null
      Start-Sleep -Seconds 2
      $expr = '(() => ({lang: document.documentElement.lang, nav: navigator.language, langs: navigator.languages, h1: (document.querySelector("h1")||{}).innerText || "", buttons: [...document.querySelectorAll("button")].map(b => (b.innerText||b.getAttribute("aria-label")||"").trim()).filter(Boolean).slice(0,8)}))()'
      $eval = Invoke-Cdp $ws $ct 2 "Runtime.evaluate" @{ expression = $expr; returnByValue = $true }
      $v = $eval.result.result.value
      $lines += ("URL=" + $url)
      $lines += ("htmlLang=" + $v.lang + " nav=" + $v.nav + " langs=" + ($v.langs -join ","))
      $lines += ("h1=" + $v.h1)
      $lines += ("buttons=" + ($v.buttons -join " | "))
      $ws.Dispose()
    }
    $lines | Set-Content -Encoding utf8 (Join-Path $out "lang-$lang.txt")
    "WROTE $lang"
  } finally {
    if ($proc -and -not $proc.HasExited) { taskkill /PID $proc.Id /T /F | Out-Null }
  }
}

Test-Lang "fr" 9336
Test-Lang "rw" 9337
