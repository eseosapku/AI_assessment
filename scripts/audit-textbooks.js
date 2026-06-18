const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const env = fs.readFileSync('.env', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim()

const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('NEXT_PUBLIC_SUPABASE_ANON_KEY'))

;(async () => {
  const { data: textbooks } = await sb.from('textbooks').select('textbook_id,textbook_name,filename,curriculum').order('textbook_id')
  const { data: classes } = await sb.from('classes').select('id,name').order('name')
  const { data: links } = await sb.from('class_textbooks').select('class_id,textbook_id')
  const { data: topics } = await sb.from('topics').select('topic_id,textbook_id,topic')
  const { data: subtopics } = await sb.from('subtopics').select('subtopic_id,textbook_id,topic_id,subtopic')

  const topicCount = new Map()
  const subCount = new Map()
  for (const t of topics || []) topicCount.set(t.textbook_id, (topicCount.get(t.textbook_id) || 0) + 1)
  for (const s of subtopics || []) subCount.set(s.textbook_id, (subCount.get(s.textbook_id) || 0) + 1)

  console.log('=== TEXTBOOKS (' + (textbooks?.length || 0) + ') ===')
  for (const tb of textbooks || []) {
    const tc = topicCount.get(tb.textbook_id) || 0
    const sc = subCount.get(tb.textbook_id) || 0
    console.log(`${tb.textbook_id}\tcur=${tb.curriculum}\ttopics=${tc}\tsubtopics=${sc}\t${tb.textbook_name}`)
  }

  console.log('\n=== CLASSES (' + (classes?.length || 0) + ') ===')
  const tbById = new Map((textbooks || []).map((t) => [t.textbook_id, t]))
  for (const c of classes || []) {
    const tbs = (links || []).filter((l) => l.class_id === c.id).map((l) => tbById.get(l.textbook_id)?.textbook_name).filter(Boolean)
    console.log(`${c.id}\t${c.name}\t[${tbs.join('; ')}]`)
  }

  const physics = (textbooks || []).filter((t) => /physics/i.test(t.textbook_name))
  console.log('\n=== PHYSICS TEXTBOOKS ===')
  for (const p of physics) {
    console.log(JSON.stringify(p))
    const pts = (topics || []).filter((t) => t.textbook_id === p.textbook_id)
    console.log('  topics:', pts.length, pts.slice(0, 5).map((t) => t.topic))
  }
})()
