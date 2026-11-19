$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
[System.Net.ServicePointManager]::DefaultConnectionLimit = 20
[System.Net.ServicePointManager]::Expect100Continue = $false

$outDir = 'c:\Users\hp\Desktop\update\AI_assessment\qa-artifacts\power-user'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$jsonPath = Join-Path $outDir 'route-scan.json'
$logPath = Join-Path $outDir 'scan-log.txt'
if (Test-Path $logPath) { Remove-Item $logPath -Force }

$routes = @(
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/welcome',
  '/complete-profile',
  '/dashboard',
  '/practice',
  '/exam-prep',
  '/recall',
  '/recall/review',
  '/progress',
  '/report-card',
  '/reports',
  '/settings',
  '/classrooms',
  '/studylab',
  '/studylab/demo',
  '/studylab/gap-map',
  '/assessment',
  '/assignments/new',
  '/assignments/from-pdf',
  '/admin',
  '/admin/referrals',
  '/referrals',
  '/subscription/success',
  '/bedrock-test',
  '/dev/scenes',
  '/dev/learnspace',
  '/dev/render',
  '/dev/sort',
  '/dev/activities',
  '/manage-classes',
  '/Practice',
  '/DASHBOARD',
  '/signup/',
  '/login?next=/practice'
)

function Write-Log([string]$msg) {
  $line = "$(Get-Date -Format 'HH:mm:ss') $msg"
  Add-Content -Path $logPath -Value $line -Encoding UTF8
  Write-Output $line
}

function Redact([string]$s) {
  if ([string]::IsNullOrEmpty($s)) { return $s }
  $s = [regex]::Replace($s, '(?i)postgres(?:ql)?://\S+', '[REDACTED_URL]')
  $s = [regex]::Replace($s, '(?i)mysql://\S+', '[REDACTED_URL]')
  $s = [regex]::Replace($s, '(?i)DATABASE_URL\s*[=:]\s*\S+', 'DATABASE_URL=[REDACTED]')
  $s = [regex]::Replace($s, '(?i)(secret|password|api[_-]?key|token)\s*[=:]\s*\S+', '$1=[REDACTED]')
  return $s
}

function Resolve-NextUrl([string]$current, [string]$location) {
  if ([string]::IsNullOrWhiteSpace($location)) { return $null }
  $location = $location.Trim()
  if ($location -match '^(?i)https?://') {
    return ([Uri]$location).AbsoluteUri
  }
  $base = New-Object System.Uri($current)
  $next = New-Object System.Uri($base, $location)
  return $next.AbsoluteUri
}

function Test-Localhost([string]$url) {
  try {
    $u = [Uri]$url
  } catch {
    return $false
  }
  return ($u.Scheme -eq 'http' -and $u.Host -eq 'localhost' -and $u.Port -eq 3000)
}

function Get-VisibleText([string]$html) {
  if ([string]::IsNullOrEmpty($html)) { return '' }
  $noScript = [regex]::Replace($html, '(?is)<script\b[^>]*>.*?</script>', ' ')
  $noStyle = [regex]::Replace($noScript, '(?is)<style\b[^>]*>.*?</style>', ' ')
  $noNext = [regex]::Replace($noStyle, '(?is)<template\b[^>]*>.*?</template>', ' ')
  $text = [regex]::Replace($noNext, '(?is)<[^>]+>', ' ')
  $text = [System.Net.WebUtility]::HtmlDecode($text)
  $text = [regex]::Replace($text, '\s+', ' ').Trim()
  return $text
}

function Find-Markers([string]$html, [string]$visible) {
  $phrases = @('Application error', 'Unhandled')
  $overlayNeedles = @(
    'nextjs-portal',
    'data-nextjs-dialog',
    '__nextjs-error-overlay',
    'nextjs-error-overlay',
    'data-next-error'
  )
  $visibleHits = @()
  $rawHits = @()
  $overlayHits = @()
  foreach ($p in $phrases) {
    if ($visible -and $visible.IndexOf($p, [StringComparison]::Ordinal) -ge 0) {
      $visibleHits += $p
    }
    if ($html -and $html.IndexOf($p, [StringComparison]::Ordinal) -ge 0) {
      $rawHits += $p
    }
  }
  foreach ($p in $overlayNeedles) {
    if ($html -and $html.IndexOf($p, [StringComparison]::Ordinal) -ge 0) {
      $overlayHits += $p
    }
  }
  $scriptOnly = @()
  foreach ($p in $rawHits) {
    if ($visibleHits -notcontains $p) { $scriptOnly += $p }
  }
  return @{
    visible = @($visibleHits)
    raw = @($rawHits)
    scriptOnly = @($scriptOnly)
    overlay = @($overlayHits)
  }
}

function Read-ResponseBody($response) {
  if (-not $response) { return '' }
  try {
    $stream = $response.GetResponseStream()
    if (-not $stream) { return '' }
    $reader = New-Object System.IO.StreamReader($stream)
    $text = $reader.ReadToEnd()
    $reader.Dispose()
    return $text
  } catch {
    return ''
  }
}

function Invoke-One([string]$url, $session) {
  $ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  $attempt = 0
  while ($attempt -lt 2) {
    $attempt++
    try {
      $resp = Invoke-WebRequest -Uri $url -Method Get -MaximumRedirection 0 -UseBasicParsing -WebSession $session -TimeoutSec 45 -Headers @{
        'User-Agent' = $ua
        'Cache-Control' = 'no-cache'
        'Accept' = 'text/html,application/xhtml+xml'
      }
      $loc = $resp.Headers['Location']
      if ($loc -is [System.Array]) { $loc = $loc[0] }
      return @{
        ok = $true
        status = [int]$resp.StatusCode
        location = [string]$loc
        body = [string]$resp.Content
        contentType = [string]$resp.Headers['Content-Type']
        error = $null
      }
    } catch {
      $ex = $_.Exception
      $webResp = $null
      if ($ex.Response) { $webResp = $ex.Response }
      elseif ($ex.InnerException -and $ex.InnerException.Response) { $webResp = $ex.InnerException.Response }
      if ($webResp) {
        $status = 0
        try { $status = [int]$webResp.StatusCode } catch { $status = 0 }
        $loc = $null
        try { $loc = $webResp.Headers['Location'] } catch { $loc = $null }
        if ($loc -is [System.Array]) { $loc = $loc[0] }
        $body = Read-ResponseBody $webResp
        try { $webResp.Close() } catch {}
        $ctype = $null
        try { $ctype = $webResp.Headers['Content-Type'] } catch { $ctype = $null }
        return @{
          ok = $true
          status = $status
          location = [string]$loc
          body = [string]$body
          contentType = [string]$ctype
          error = $null
        }
      }
      $msg = Redact ($ex.Message)
      if ($attempt -lt 2 -and ($msg -match 'timed out|operation has timed out|Unable to connect|connection')) {
        Write-Log "RETRY $url ($msg)"
        Start-Sleep -Seconds 2
        continue
      }
      return @{
        ok = $false
        status = $null
        location = $null
        body = ''
        contentType = $null
        error = $msg
      }
    }
  }
  return @{
    ok = $false
    status = $null
    location = $null
    body = ''
    contentType = $null
    error = 'no response after retry'
  }
}

$results = New-Object System.Collections.Generic.List[object]
$homeFingerprint = $null

foreach ($path in $routes) {
  $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $current = 'http://localhost:3000' + $path
  $chain = New-Object System.Collections.Generic.List[object]
  $seen = @{}
  $finalStatus = $null
  $finalUrl = $null
  $body = ''
  $contentType = $null
  $note = @()
  $transportError = $null
  $loop = $false
  $stoppedExternal = $false

  for ($hop = 0; $hop -lt 10; $hop++) {
    if ($seen.ContainsKey($current)) {
      $loop = $true
      $note += 'redirect loop'
      $finalUrl = $current
      break
    }
    $seen[$current] = $true
    if (-not (Test-Localhost $current)) {
      $stoppedExternal = $true
      $note += 'stopped before non-localhost URL'
      $finalUrl = $current
      break
    }
    $hit = Invoke-One $current $session
    if (-not $hit.ok) {
      $transportError = $hit.error
      $finalUrl = $current
      $chain.Add([ordered]@{ url = $current; status = $null; location = $null; error = $hit.error })
      break
    }
    $status = $hit.status
    $loc = $hit.location
    $chain.Add([ordered]@{ url = $current; status = $status; location = $(if ($loc) { $loc } else { $null }) })
    $isRedirect = ($status -ge 300 -and $status -lt 400 -and $loc)
    if ($isRedirect) {
      $next = Resolve-NextUrl $current $loc
      if (-not $next) {
        $note += 'redirect missing usable location'
        $finalStatus = $status
        $finalUrl = $current
        $body = $hit.body
        $contentType = $hit.contentType
        break
      }
      $current = $next
      continue
    }
    $finalStatus = $status
    $finalUrl = $current
    $body = $hit.body
    $contentType = $hit.contentType
    break
  }

  if (-not $finalUrl) {
    $note += 'exceeded 10 redirect hops'
    $finalUrl = $current
    $loop = $true
  }

  $title = $null
  if ($body -match '(?is)<title[^>]*>(.*?)</title>') {
    $title = Redact ([regex]::Replace($Matches[1], '\s+', ' ').Trim())
  }
  $visible = Get-VisibleText $body
  $visible = Redact $visible
  $markers = Find-Markers $body $visible
  $preview = $visible
  if ($preview.Length -gt 240) { $preview = $preview.Substring(0, 240) }

  $finalPath = $null
  try { $finalPath = ([Uri]$finalUrl).PathAndQuery } catch { $finalPath = $finalUrl }

  if ($path -eq '/') {
    $homeFingerprint = $preview
  } elseif ($homeFingerprint -and $preview -eq $homeFingerprint -and $finalPath -ne '/' -and $finalPath -notlike '/?*') {
    $note += 'visible text matches marketing homepage'
  }

  $errorText = @()
  if ($markers.visible.Count -gt 0) { $errorText += ($markers.visible -join ', ') }
  if ($markers.overlay.Count -gt 0) { $errorText += ('overlay:' + ($markers.overlay -join ',')) }
  $scriptNote = $null
  if ($markers.scriptOnly.Count -gt 0) {
    $scriptNote = 'script-only match: ' + ($markers.scriptOnly -join ', ')
  }

  $row = [ordered]@{
    path = $path
    status = $finalStatus
    finalUrl = $finalUrl
    finalPath = $finalPath
    title = $title
    contentType = $contentType
    bodyLength = $(if ($body) { $body.Length } else { 0 })
    visibleLength = $(if ($visible) { $visible.Length } else { 0 })
    visiblePreview = $preview
    errorText = $(if ($errorText.Count -gt 0) { ($errorText -join ' | ') } else { $null })
    scriptOnlyMatch = $scriptNote
    redirectLoop = $loop
    externalStop = $stoppedExternal
    transportError = $transportError
    notes = $(if ($note.Count -gt 0) { ($note -join '; ') } else { $null })
    chain = $chain
  }
  $results.Add($row)

  $chainSummary = ($chain | ForEach-Object {
    if ($_.status) { "$($_.status)" } else { 'ERR' }
  }) -join '->'
  $errCol = $(if ($row.errorText) { $row.errorText } else { '-' })
  Write-Log ("{0} status={1} final={2} chain={3} title={4} vis={5} err={6} notes={7} script={8} transport={9}" -f $path, $finalStatus, $finalUrl, $chainSummary, $title, $row.visibleLength, $errCol, $row.notes, $scriptNote, $transportError)

  $results | ConvertTo-Json -Depth 8 | Set-Content -Path $jsonPath -Encoding UTF8
}

Write-Log 'SCAN_DONE'
