// Dev helper: print parse + classify + markdown for given nids. Not part of the import.
// MODE=people prints listing extraction; MODE=fields prints extracted fields.
import fs from 'fs'
import { classify } from './classify'
import { CRAWL_DIR } from './config'
import { courseFields, peopleFromListing, personFromProfile, postFields, publicationFields, scholarsFromTable } from './extract'
import { toMarkdown } from './markdown'
import { parseNode } from './parse'

for (const nid of process.argv.slice(2)) {
  const n = parseNode(fs.readFileSync(`${CRAWL_DIR}/nodes/${nid}.html`, 'utf8'))
  if (!n) {
    console.log(nid, 'not a node view')
    continue
  }
  const { contentHtml, ...rest } = n
  console.log('=====', JSON.stringify(rest), JSON.stringify(classify(n)))
  if (process.env.MODE === 'people') {
    const seeds = n.canonicalPath.endsWith('research_scholars')
      ? scholarsFromTable(contentHtml)
      : peopleFromListing(contentHtml, 'faculty')
    for (const s of seeds) console.log(JSON.stringify(s))
  } else if (process.env.MODE === 'fields') {
    console.log(
      JSON.stringify({
        person: personFromProfile(n),
        course: courseFields(n),
        post: postFields(n),
        pub: publicationFields(n),
      }),
    )
  } else console.log(toMarkdown(contentHtml).slice(0, Number(process.env.N || 3000)))
}
