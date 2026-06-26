// Assemble a standalone HTML document from the three editable parts of a web
// sandbox card. Rendered inside a sandboxed iframe (allow-scripts only), so the
// student's JS runs but cannot reach the parent page.
export function assembleWebDoc(html?: string, css?: string, js?: string): string {
  const body = (html ?? '').trim()
  const style = (css ?? '').trim()
  const script = (js ?? '').trim()
  // Escape a closing </script> in user JS so it can't break out of the tag.
  const safeScript = script.replace(/<\/script>/gi, '<\\/script>')
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    style ? `<style>\n${style}\n</style>` : '',
    '</head>',
    '<body>',
    body,
    safeScript ? `<script>\n${safeScript}\n</script>` : '',
    '</body>',
    '</html>',
  ]
    .filter(Boolean)
    .join('\n')
}
