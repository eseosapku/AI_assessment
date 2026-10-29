import fs from 'node:fs'
import pdfParse from 'pdf-parse'

const paths = process.argv.slice(2)
for (const file of paths) {
  const data = await pdfParse(fs.readFileSync(file))
  console.log('\n====', file)
  console.log('pages', data.numpages, 'chars', data.text.length)
  console.log(data.text.slice(0, 1800))
}
