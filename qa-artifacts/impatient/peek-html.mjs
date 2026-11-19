const urls = [
  'http://localhost:3000/signup',
  'http://localhost:3000/art/celebration.png',
]
for (const url of urls) {
  const t0 = performance.now()
  const res = await fetch(url, { redirect: 'manual' })
  const buf = Buffer.from(await res.arrayBuffer())
  const text = buf.toString('utf8')
  const info = {
    url,
    status: res.status,
    type: res.headers.get('content-type'),
    ms: Math.round(performance.now() - t0),
    bytes: buf.length,
  }
  if (url.endsWith('/signup')) {
    const idx = text.indexOf('Create your account')
    info.createIdx = idx
    info.aroundCreate = idx >= 0 ? text.slice(Math.max(0, idx - 400), idx + 120).replace(/\s+/g, ' ') : null
    const styles = []
    const re = /style="[^"]*opacity[^"]*"/g
    let m
    while ((m = re.exec(text)) && styles.length < 8) styles.push(m[0].slice(0, 180))
    info.opacityStyles = styles
    info.hasNameInput = text.includes('id="name"')
    info.hasPasswordInput = text.includes('id="password"')
  }
  console.log(JSON.stringify(info))
}
