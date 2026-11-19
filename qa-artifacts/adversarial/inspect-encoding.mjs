const origin = 'http://localhost:3000'
const pages = [
  ['home', `/?q=${encodeURIComponent('<script>alert(1)</script>')}`, '<script>alert(1)</script>'],
  ['signup', `/signup?email=${encodeURIComponent('<img src=x onerror=alert(1)>')}`, '<img src=x onerror=alert(1)>'],
  ['reset', `/reset-password?token=${encodeURIComponent('<script>alert(1)</script>')}`, '<script>alert(1)</script>'],
]

function around(html, needle) {
  const index = html.indexOf(needle)
  if (index < 0) return null
  const slice = html.slice(Math.max(0, index - 24), index + needle.length + 24)
  return {
    index,
    codes: [...slice].map((ch) => ch.charCodeAt(0)),
    text: slice,
  }
}

const report = []
for (const [name, path, payload] of pages) {
  const res = await fetch(origin + path)
  const html = await res.text()
  const lt = html.indexOf(payload)
  const marker = name === 'signup' ? 'onerror=alert(1)' : 'alert(1)%3C'
  report.push({
    name,
    status: res.status,
    rawPayloadIndex: lt,
    rawLtInPayloadForm: html.includes(payload),
    marker: around(html, marker),
  })
}

console.log(JSON.stringify(report, null, 2))
