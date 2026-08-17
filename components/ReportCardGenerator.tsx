'use client'

import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, FileText, Download, Printer,
  Calendar, ChevronDown, ChevronUp, User, BookOpen, Award, Clock
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'
import ThemeToggle from './ThemeToggle'
import ProfileSidebar from './ProfileSidebar'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AssessmentRecord {
  id: string
  subject: string
  topics: string[]
  difficulty: string
  score: number
  percentage: number
  completedAt: string   // ISO string
  completedDate: Date
  grade: string
  weekKey: string       // "2026-W12"
  weekLabel: string     // "Mar 16 – Mar 22, 2026"
  weekStart: Date
}

interface WeekGroup {
  key: string
  label: string
  weekStart: Date
  assessments: AssessmentRecord[]
}

interface ClassroomRow {
  id: string
  name: string
  description?: string | null
}

interface ClassroomMember {
  id: string
  student_id: string | null
  student_email: string | null
  student_name: string | null
  status: string | null
}

interface ClassroomStudentDetail {
  student: {
    student_id: string | null
    student_email: string | null
    student_name: string | null
  }
  assignments: Array<{
    assignment_id: string
    title: string
    subject: string
    status: string
    completed_at: string | null
    last_attempt_at: string | null
    score: number | null
    result_id: string | null
    result: {
      score: number | null
      percentage: number | null
      created_at: string | null
    } | null
  }>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGrade(pct: number): string {
  if (pct >= 90) return 'A+'
  if (pct >= 80) return 'A'
  if (pct >= 70) return 'B+'
  if (pct >= 60) return 'B'
  if (pct >= 50) return 'C'
  return 'D'
}

function getWeekStart(d: Date): Date {
  const day = d.getDay()           // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day  // shift to Monday
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  mon.setHours(0, 0, 0, 0)
  return mon
}

function weekKey(monDate: Date): string {
  const y = monDate.getFullYear()
  // ISO week number
  const start = new Date(y, 0, 1)
  const week = Math.ceil((((monDate.getTime() - start.getTime()) / 86400000) + start.getDay() + 1) / 7)
  return `${y}-W${String(week).padStart(2, '0')}`
}

function weekLabel(monDate: Date): string {
  const sun = new Date(monDate)
  sun.setDate(monDate.getDate() + 6)
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(monDate)} – ${fmt(sun)}, ${sun.getFullYear()}`
}

const GRADE_COLOR: Record<string, { text: string; bg: string }> = {
  'A+': { text: '#059669', bg: '#ecfdf5' },
  'A': { text: '#059669', bg: '#ecfdf5' },
  'B+': { text: '#2563eb', bg: '#eff6ff' },
  'B': { text: '#2563eb', bg: '#eff6ff' },
  'C': { text: '#d97706', bg: '#fffbeb' },
  'D': { text: '#dc2626', bg: '#fef2f2' },
}

// ─── Report HTML builder ──────────────────────────────────────────────────────

function buildReportCardHtml(
  user: { name: string; studentId: string; class: string },
  selected: AssessmentRecord[],
  weeks: WeekGroup[],
  generatedOn: string
): string {
  const selectedWeeks = weeks.filter(w => w.assessments.some(a => selected.find(s => s.id === a.id)))

  const dateRange = selected.length
    ? (() => {
      const dates = selected.map(a => a.completedDate.getTime())
      const minD = new Date(Math.min(...dates))
      const maxD = new Date(Math.max(...dates))
      const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      return minD.getTime() === maxD.getTime() ? fmt(minD) : `${fmt(minD)} – ${fmt(maxD)}`
    })()
    : '—'

  const totalSelected = selected.length
  const overallAvg = totalSelected
    ? Math.round(selected.reduce((s, a) => s + a.percentage, 0) / totalSelected)
    : 0
  const overallGrade = getGrade(overallAvg)
  const gc = GRADE_COLOR[overallGrade]

  // Subject summaries
  const subjectMap: Record<string, number[]> = {}
  selected.forEach(a => {
    if (!subjectMap[a.subject]) subjectMap[a.subject] = []
    subjectMap[a.subject].push(a.percentage)
  })
  const subjectRows = Object.entries(subjectMap).map(([subj, scores]) => {
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    const g = getGrade(avg)
    const c = GRADE_COLOR[g]
    return `<tr>
      <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:13px;font-weight:600;color:#111827;">${subj}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;text-align:center;font-size:13px;color:#6b7280;">${scores.length}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;text-align:center;">
        <div style="display:inline-flex;align-items:center;gap:8px;">
          <div style="width:80px;height:6px;background:#f3f4f6;border-radius:3px;overflow:hidden;">
            <div style="width:${avg}%;height:100%;background:${c.text};border-radius:3px;"></div>
          </div>
          <span style="font-size:13px;font-weight:700;color:${c.text};width:36px;">${avg}%</span>
        </div>
      </td>
      <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;text-align:center;">
        <span style="display:inline-block;padding:2px 10px;border-radius:6px;font-size:12px;font-weight:800;background:${c.bg};color:${c.text};">${g}</span>
      </td>
    </tr>`
  }).join('')

  // Week sections
  const weekSections = selectedWeeks.map(wk => {
    const wkSelected = wk.assessments.filter(a => selected.find(s => s.id === a.id))
    const rows = wkSelected.map(a => {
      const gc2 = GRADE_COLOR[a.grade]
      const dateStr = a.completedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      return `<tr>
        <td style="padding:9px 16px;border-bottom:1px solid #f9fafb;font-size:12px;color:#6b7280;">${dateStr}</td>
        <td style="padding:9px 16px;border-bottom:1px solid #f9fafb;font-size:13px;font-weight:600;color:#111827;">${a.subject}</td>
        <td style="padding:9px 16px;border-bottom:1px solid #f9fafb;font-size:12px;color:#6b7280;max-width:200px;">${a.topics.slice(0, 2).join(', ')}</td>
        <td style="padding:9px 16px;border-bottom:1px solid #f9fafb;text-align:center;">
          <div style="display:inline-flex;align-items:center;gap:6px;">
            <div style="width:60px;height:5px;background:#f3f4f6;border-radius:3px;overflow:hidden;">
              <div style="width:${a.percentage}%;height:100%;background:${gc2.text};border-radius:3px;"></div>
            </div>
            <span style="font-size:12px;font-weight:700;color:${gc2.text};">${a.percentage}%</span>
          </div>
        </td>
        <td style="padding:9px 16px;border-bottom:1px solid #f9fafb;text-align:center;">
          <span style="display:inline-block;padding:2px 8px;border-radius:5px;font-size:11px;font-weight:800;background:${gc2.bg};color:${gc2.text};">${a.grade}</span>
        </td>
      </tr>`
    }).join('')
    return `
      <div style="margin-bottom:24px;">
        <div style="background:#f8fafc;border-left:3px solid #3b82f6;padding:8px 14px;border-radius:0 6px 6px 0;margin-bottom:0;">
          <span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#3b82f6;">Week of ${wk.label}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#f9fafb;">
            <th style="padding:8px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;">Date</th>
            <th style="padding:8px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;">Subject</th>
            <th style="padding:8px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;">Topic(s)</th>
            <th style="padding:8px 16px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;">Score</th>
            <th style="padding:8px 16px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;">Grade</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Report Card – ${user.name}</title>
  <style>
    @page { size: A4; margin: 16mm 14mm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111827; background: #fff; }
    .page { max-width: 860px; margin: 0 auto; padding: 48px 48px 64px; }
  </style>
</head>
<body>
<div class="page">

  <!-- ══ HEADER ══ -->
  <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:24px;border-bottom:2px solid #111827;margin-bottom:32px;">
    <div style="display:flex;align-items:center;gap:14px;">
      <div style="width:48px;height:48px;background:linear-gradient(135deg,#2563eb,#7c3aed);border-radius:12px;display:flex;align-items:center;justify-content:center;">
        <span style="font-size:22px;font-weight:900;color:#fff;">B</span>
      </div>
      <div>
        <div style="font-size:20px;font-weight:900;color:#111827;letter-spacing:-.02em;">Brain Ink</div>
        <div style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.1em;margin-top:1px;">AI Assessment Platform</div>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:22px;font-weight:900;color:#111827;text-transform:uppercase;letter-spacing:.04em;">Academic Report Card</div>
      <div style="font-size:12px;color:#6b7280;margin-top:4px;">Generated: ${generatedOn}</div>
    </div>
  </div>

  <!-- ══ STUDENT INFO + OVERALL GRADE ══ -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;gap:24px;">
    <div style="flex:1;background:#f9fafb;border-radius:12px;padding:20px 24px;">
      <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#9ca3af;margin-bottom:14px;">Student Information</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0;font-size:12px;color:#6b7280;width:110px;">Full Name</td>
          <td style="padding:4px 0;font-size:13px;font-weight:700;color:#111827;">${user.name}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:12px;color:#6b7280;">Student ID</td>
          <td style="padding:4px 0;font-size:13px;font-weight:700;color:#111827;">${user.studentId || '—'}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:12px;color:#6b7280;">Class</td>
          <td style="padding:4px 0;font-size:13px;font-weight:700;color:#111827;">${user.class || '—'}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:12px;color:#6b7280;">Report Period</td>
          <td style="padding:4px 0;font-size:13px;font-weight:700;color:#111827;">${dateRange}</td>
        </tr>
      </table>
    </div>
    <div style="background:${gc.bg};border-radius:12px;padding:20px 28px;text-align:center;min-width:140px;">
      <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:${gc.text};opacity:.7;margin-bottom:10px;">Overall</div>
      <div style="font-size:52px;font-weight:900;color:${gc.text};line-height:1;">${overallGrade}</div>
      <div style="font-size:20px;font-weight:700;color:${gc.text};margin-top:4px;">${overallAvg}%</div>
      <div style="font-size:11px;color:${gc.text};opacity:.7;margin-top:6px;">${totalSelected} assessment${totalSelected !== 1 ? 's' : ''}</div>
    </div>
  </div>

  <!-- ══ SUBJECT SUMMARY ══ -->
  <div style="margin-bottom:32px;">
    <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#9ca3af;margin-bottom:12px;">Performance by Subject</div>
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #f3f4f6;border-radius:12px;overflow:hidden;">
      <thead><tr style="background:#f9fafb;">
        <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;">Subject</th>
        <th style="padding:10px 16px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;">Tests</th>
        <th style="padding:10px 16px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;">Average</th>
        <th style="padding:10px 16px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;">Grade</th>
      </tr></thead>
      <tbody>${subjectRows}</tbody>
    </table>
  </div>

  <!-- ══ WEEKLY BREAKDOWN ══ -->
  <div style="margin-bottom:40px;">
    <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#9ca3af;margin-bottom:16px;">Weekly Assessment Log</div>
    ${weekSections}
  </div>

  <!-- ══ GRADE LEGEND ══ -->
  <div style="background:#f9fafb;border-radius:10px;padding:16px 20px;margin-bottom:40px;">
    <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#9ca3af;margin-bottom:10px;">Grade Scale</div>
    <div style="display:flex;gap:24px;flex-wrap:wrap;">
      ${[['A+', '90–100%'], ['A', '80–89%'], ['B+', '70–79%'], ['B', '60–69%'], ['C', '50–59%'], ['D', '< 50%']].map(([g, r]) => {
    const c = GRADE_COLOR[g as string]
    return `<div style="display:flex;align-items:center;gap:6px;">
          <span style="display:inline-block;padding:2px 8px;border-radius:5px;font-size:11px;font-weight:800;background:${c.bg};color:${c.text};">${g}</span>
          <span style="font-size:11px;color:#6b7280;">${r}</span>
        </div>`
  }).join('')}
    </div>
  </div>

  <!-- ══ SIGNATURES ══ -->
  <div style="display:flex;gap:40px;margin-top:8px;padding-top:32px;border-top:1px solid #e5e7eb;">
    ${['Class Teacher', "Parent / Guardian", "Principal"].map(role => `
      <div style="flex:1;text-align:center;">
        <div style="height:40px;border-bottom:1px solid #d1d5db;margin-bottom:8px;"></div>
        <div style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;">${role}</div>
      </div>`).join('')}
  </div>

  <div style="margin-top:32px;text-align:center;font-size:10px;color:#d1d5db;">
    This report was generated by Brain Ink AI Assessment Platform · ${generatedOn}
  </div>

</div>
</body>
</html>`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportCardGenerator() {
  const router = useRouter()
  const { user } = useAuth()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [allAssessments, setAllAssessments] = useState<AssessmentRecord[]>([])
  const [weeks, setWeeks] = useState<WeekGroup[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<string>>(new Set())
  const [isGenerating, setIsGenerating] = useState(false)
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([])
  const [members, setMembers] = useState<ClassroomMember[]>([])
  const [selectedClassroomId, setSelectedClassroomId] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<ClassroomMember | null>(null)
  const [studentDetail, setStudentDetail] = useState<ClassroomStudentDetail | null>(null)
  const [teacherError, setTeacherError] = useState('')
  const [isLoadingTeacher, setIsLoadingTeacher] = useState(false)
  const [isLoadingStudent, setIsLoadingStudent] = useState(false)
  const firstName = user?.name?.split(' ')[0] || 'Student'
  const isTeacher = user?.role === 'teacher'

  const selectedClassroom = classrooms.find(c => c.id === selectedClassroomId) || null
  const reportUser = isTeacher
    ? {
      name: studentDetail?.student?.student_name
        || selectedStudent?.student_name
        || selectedStudent?.student_email
        || 'Student',
      studentId: studentDetail?.student?.student_id
        || selectedStudent?.student_id
        || selectedStudent?.student_email
        || '',
      class: selectedClassroom?.name || '',
    }
    : {
      name: user?.name || 'Student',
      studentId: user?.studentId || '',
      class: user?.class || '',
    }
  const reportClassLabel = reportUser.class
    ? (isTeacher ? reportUser.class : `Class ${reportUser.class}`)
    : ''

  const handleClassroomChange = (value: string) => {
    setSelectedClassroomId(value)
    setSelectedStudent(null)
    setStudentDetail(null)
    setMembers([])
    setAllAssessments([])
    setWeeks([])
    setSelectedIds(new Set())
  }

  const handleStudentChange = (value: string) => {
    const next = members.find(m => m.id === value) || null
    setSelectedStudent(next)
  }

  // Fetch all completed assessments for the student
  useEffect(() => {
    if (!user?.id || isTeacher) return
    const load = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/results?user_id=${encodeURIComponent(user.id)}`)
        const json = await res.json()
        if (!res.ok || !json.data) {
          console.error('Failed to fetch assessments:', json.error)
          setIsLoading(false)
          return
        }

        const data = json.data as any[]

        const records: AssessmentRecord[] = data.map(item => {
          const pct = item.percentage ?? item.score ?? 0
          const completedDate = new Date(item.created_at)
          const monDate = getWeekStart(completedDate)
          const topics: string[] = item.assessments?.topics ?? []
          return {
            id: item.id,
            subject: item.assessments?.subject || 'Assessment',
            topics: Array.isArray(topics) ? topics : [String(topics)],
            difficulty: item.assessments?.difficulty || '',
            score: item.score ?? 0,
            percentage: Math.round(pct),
            completedAt: item.created_at,
            completedDate,
            grade: getGrade(pct),
            weekKey: weekKey(monDate),
            weekLabel: weekLabel(monDate),
            weekStart: monDate,
          }
        })

        // Group into weeks
        const weekMap = new Map<string, WeekGroup>()
        records.forEach(r => {
          if (!weekMap.has(r.weekKey)) {
            weekMap.set(r.weekKey, {
              key: r.weekKey,
              label: r.weekLabel,
              weekStart: r.weekStart,
              assessments: [],
            })
          }
          weekMap.get(r.weekKey)!.assessments.push(r)
        })

        const sortedWeeks = Array.from(weekMap.values()).sort(
          (a, b) => b.weekStart.getTime() - a.weekStart.getTime()
        )

        setAllAssessments(records)
        setWeeks(sortedWeeks)
        // Select all by default
        setSelectedIds(new Set(records.map(r => r.id)))
        setIsLoading(false)
      } catch (err) {
        console.error('Failed to load assessments:', err)
        setIsLoading(false)
      }
    }
    load()
  }, [user, isTeacher])

  useEffect(() => {
    if (!user?.id || !isTeacher) return
    const loadTeacherClassrooms = async () => {
      setIsLoadingTeacher(true)
      setTeacherError('')
      try {
        const res = await fetch(`/api/classrooms?teacher_id=${user.id}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load classrooms')
        setClassrooms(json.data ?? [])
      } catch (err: any) {
        setTeacherError(err?.message || 'Failed to load classrooms')
        setClassrooms([])
      } finally {
        setIsLoadingTeacher(false)
      }
    }

    loadTeacherClassrooms()
  }, [user, isTeacher])

  useEffect(() => {
    if (!isTeacher) return
    if (!selectedClassroomId) {
      setMembers([])
      setSelectedStudent(null)
      setStudentDetail(null)
      setAllAssessments([])
      setWeeks([])
      setSelectedIds(new Set())
      return
    }
    const loadMembers = async () => {
      setIsLoadingTeacher(true)
      setTeacherError('')
      try {
        const res = await fetch(`/api/classrooms/${selectedClassroomId}/members?status=accepted`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load students')
        setMembers(json.data ?? [])
      } catch (err: any) {
        setTeacherError(err?.message || 'Failed to load students')
        setMembers([])
      } finally {
        setIsLoadingTeacher(false)
      }
    }

    loadMembers()
  }, [isTeacher, selectedClassroomId])

  useEffect(() => {
    if (!isTeacher) return
    if (!selectedClassroomId || !selectedStudent) {
      setStudentDetail(null)
      setAllAssessments([])
      setWeeks([])
      setSelectedIds(new Set())
      setIsLoading(false)
      return
    }

    const loadStudentDetail = async () => {
      setIsLoadingStudent(true)
      setTeacherError('')
      setIsLoading(true)
      try {
        const params = new URLSearchParams()
        if (selectedStudent.student_id) params.set('student_id', selectedStudent.student_id)
        if (selectedStudent.student_email) params.set('student_email', selectedStudent.student_email)
        const res = await fetch(`/api/classrooms/${selectedClassroomId}/students?${params.toString()}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load student assignments')
        setStudentDetail(json)

        const completedAssignments = (json.assignments ?? [])
          .filter((row: any) => row.status === 'completed' && (row.result || row.score !== null))

        const records: AssessmentRecord[] = completedAssignments.map((row: any) => {
          const pct = Number(row.score ?? row.result?.percentage ?? row.result?.score ?? 0)
          const completedAt = row.completed_at || row.result?.created_at || row.last_attempt_at || new Date().toISOString()
          const completedDate = new Date(completedAt)
          const monDate = getWeekStart(completedDate)
          return {
            id: String(row.assignment_id),
            subject: row.subject || 'Assessment',
            topics: row.title ? [String(row.title)] : [],
            difficulty: '',
            score: Math.round(pct),
            percentage: Math.round(pct),
            completedAt,
            completedDate,
            grade: getGrade(pct),
            weekKey: weekKey(monDate),
            weekLabel: weekLabel(monDate),
            weekStart: monDate,
          }
        })

        const weekMap = new Map<string, WeekGroup>()
        records.forEach(r => {
          if (!weekMap.has(r.weekKey)) {
            weekMap.set(r.weekKey, {
              key: r.weekKey,
              label: r.weekLabel,
              weekStart: r.weekStart,
              assessments: [],
            })
          }
          weekMap.get(r.weekKey)!.assessments.push(r)
        })
        const sortedWeeks = Array.from(weekMap.values()).sort(
          (a, b) => b.weekStart.getTime() - a.weekStart.getTime()
        )

        setAllAssessments(records)
        setWeeks(sortedWeeks)
        setSelectedIds(new Set(records.map(r => r.id)))
      } catch (err: any) {
        setTeacherError(err?.message || 'Failed to load student assignments')
        setStudentDetail(null)
        setAllAssessments([])
        setWeeks([])
        setSelectedIds(new Set())
      } finally {
        setIsLoadingStudent(false)
        setIsLoading(false)
      }
    }

    loadStudentDetail()
  }, [isTeacher, selectedClassroomId, selectedStudent])

  const selectedAssessments = allAssessments.filter(a => selectedIds.has(a.id))
  const needsTeacherSelection = isTeacher && (!selectedClassroomId || !selectedStudent)

  const toggleAssessment = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleWeek = (wk: WeekGroup) => {
    const allSelected = wk.assessments.every(a => selectedIds.has(a.id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      wk.assessments.forEach(a => allSelected ? next.delete(a.id) : next.add(a.id))
      return next
    })
  }

  const toggleCollapseWeek = (key: string) => {
    setCollapsedWeeks(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const selectAll = () => setSelectedIds(new Set(allAssessments.map(a => a.id)))
  const deselectAll = () => setSelectedIds(new Set())

  const openReportWindow = useCallback((autoPrint: boolean) => {
    if (selectedAssessments.length === 0 || !user) return
    if (isTeacher && !selectedStudent) return
    if (autoPrint) setIsGenerating(true)
    const generatedOn = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })
    const html = buildReportCardHtml(reportUser, selectedAssessments, weeks, generatedOn)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    if (!win) { URL.revokeObjectURL(url); if (autoPrint) setIsGenerating(false); return }
    win.addEventListener('load', () => {
      if (autoPrint) {
        win.print()
        setIsGenerating(false)
      }
      // Revoke after a delay to allow the page to fully load
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    })
  }, [selectedAssessments, user, weeks, isTeacher, selectedStudent, reportUser])

  const generateAndPrint = useCallback(() => openReportWindow(true), [openReportWindow])
  const generateAndDownload = useCallback(() => openReportWindow(false), [openReportWindow])

  // Stats for selected
  const overallAvg = selectedAssessments.length
    ? Math.round(selectedAssessments.reduce((s, a) => s + a.percentage, 0) / selectedAssessments.length)
    : 0
  const overallGrade = getGrade(overallAvg)
  const gc = GRADE_COLOR[overallGrade]

  return (
    <div className="min-h-screen bg-[#F3F4F6] dark:bg-[#0C0C0E] transition-colors duration-300">

      {/* ── Header (students get the studio shell's header; teachers render bare, so keep theirs) ── */}
      {isTeacher && (
      <header className="sticky top-0 z-30 h-14 bg-white/75 dark:bg-[#0C0C0E]/80 backdrop-blur-xl header-fade">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
            <div className="w-px h-4 bg-gray-200 dark:bg-gray-800" />
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Report Card</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="w-px h-4 bg-gray-200 dark:bg-gray-800 mx-1" />
            <button
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block">{firstName}</span>
            </button>
          </div>
        </div>
      </header>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-5">

        {/* ── Page title ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[24px] px-7 py-7 text-white"
          style={{ background: 'linear-gradient(115deg,#0C74B4,#0E94D6 52%,#2ACBF2)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/art/certificate.png" alt="" aria-hidden className="pointer-events-none absolute right-6 top-1/2 hidden h-[86%] -translate-y-1/2 object-contain drop-shadow-xl sm:block" />
          <div className="relative">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/85 mb-1">Generator</p>
            <h1 className="text-3xl font-extrabold tracking-tight">Report Card</h1>
            <p className="mt-1 max-w-md text-sm font-semibold text-white/85">
              {isTeacher
                ? 'Select a classroom and student to generate a report card from class assignments.'
                : 'Select assessments below to include in your official report card.'}
            </p>
          </div>
        </motion.div>

        {isTeacher && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-white/5 p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-ss-slate mb-2">Classroom</label>
                <select
                  value={selectedClassroomId}
                  onChange={(e) => handleClassroomChange(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white"
                >
                  <option value="">Select classroom</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-ss-slate mb-2">Student</label>
                <select
                  value={selectedStudent?.id ?? ''}
                  onChange={(e) => handleStudentChange(e.target.value)}
                  disabled={!selectedClassroomId || members.length === 0}
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-gray-900 dark:text-white disabled:opacity-60"
                >
                  <option value="">Select student</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.student_name || m.student_email || 'Student'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {(isLoadingTeacher || isLoadingStudent) && (
              <div className="text-xs text-ss-slate">Loading class data...</div>
            )}
            {teacherError && (
              <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 rounded-lg px-3 py-2">
                {teacherError}
              </div>
            )}
          </div>
        )}

        {needsTeacherSelection ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-24 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-white/5"
          >
            <User className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Select a classroom and student to begin.</p>
            <p className="text-xs text-ss-slate dark:text-gray-600 mt-1">Report cards are generated from classroom assignments only.</p>
          </motion.div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600 mx-auto mb-3" />
              <p className="text-sm text-ss-slate">Loading assessments…</p>
            </div>
          </div>
        ) : allAssessments.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-32 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-white/5"
          >
            <BookOpen className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
              {isTeacher ? 'No completed assignments for this student yet.' : 'No completed assessments yet.'}
            </p>
            <p className="text-xs text-ss-slate dark:text-gray-600 mt-1">
              {isTeacher
                ? 'Once the student completes class assignments, you can generate a report card here.'
                : 'Complete some assessments first, then come back to generate your report card.'}
            </p>
            {!isTeacher && (
              <button
                onClick={() => router.push('/')}
                className="mt-5 px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
              >
                Go to Dashboard
              </button>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">

            {/* ── LEFT: Selection panel ── */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-white/5 overflow-hidden">

                {/* Toolbar */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/5">
                  <p className="text-xs font-bold uppercase tracking-wider text-ss-slate dark:text-gray-500">
                    Assessments
                    <span className="ml-2 text-blue-600 dark:text-blue-400">{selectedIds.size} / {allAssessments.length} selected</span>
                  </p>
                  <div className="flex items-center gap-3">
                    <button onClick={selectAll} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">All</button>
                    <button onClick={deselectAll} className="text-xs font-semibold text-ss-slate hover:text-gray-600 dark:hover:text-gray-300 hover:underline">None</button>
                  </div>
                </div>

                {/* Week groups */}
                <div className="divide-y divide-gray-100 dark:divide-white/5">
                  {weeks.map(wk => {
                    const isCollapsed = collapsedWeeks.has(wk.key)
                    const wkAvg = Math.round(wk.assessments.reduce((s, a) => s + a.percentage, 0) / wk.assessments.length)
                    const wkGc = GRADE_COLOR[getGrade(wkAvg)]
                    return (
                      <div key={wk.key}>
                        {/* Week header — visual divider only, click to collapse */}
                        <button
                          onClick={() => toggleCollapseWeek(wk.key)}
                          className="w-full flex items-center gap-2 px-6 py-3 bg-gray-50 dark:bg-white/[0.03] text-left hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors"
                        >
                          <Calendar className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                          <span className="text-xs font-bold text-gray-600 dark:text-gray-400 flex-1">{wk.label}</span>
                          <span className="text-[10px] font-semibold text-ss-slate mr-1">
                            {wk.assessments.length} test{wk.assessments.length !== 1 ? 's' : ''}
                          </span>
                          <span className="text-xs font-bold" style={{ color: wkGc.text }}>avg {wkAvg}%</span>
                          {isCollapsed
                            ? <ChevronDown className="w-3.5 h-3.5 text-ss-slate flex-shrink-0 ml-2" />
                            : <ChevronUp className="w-3.5 h-3.5 text-ss-slate flex-shrink-0 ml-2" />
                          }
                        </button>

                        {/* Assessment rows — individual checkboxes */}
                        <AnimatePresence initial={false}>
                          {!isCollapsed && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.18 }}
                              style={{ overflow: 'hidden' }}
                            >
                              {wk.assessments.map(a => {
                                const gc2 = GRADE_COLOR[a.grade]
                                const isSel = selectedIds.has(a.id)
                                const dateStr = a.completedDate.toLocaleDateString('en-US', {
                                  weekday: 'short', month: 'short', day: 'numeric'
                                })
                                return (
                                  <button
                                    key={a.id}
                                    onClick={() => toggleAssessment(a.id)}
                                    className={`w-full flex items-center gap-3 px-6 py-3.5 text-left transition-all border-l-[3px] ${isSel
                                      ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500'
                                      : 'bg-white dark:bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-white/[0.02]'
                                      }`}
                                  >
                                    <div className="flex-shrink-0">
                                      {isSel ? (
                                        <div className="w-4 h-4 rounded bg-blue-600 flex items-center justify-center">
                                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
                                        </div>
                                      ) : (
                                        <div className="w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-600" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className={`text-sm font-semibold truncate ${isSel ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                                          {a.subject}
                                        </span>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                                          style={{ background: gc2.bg, color: gc2.text }}>
                                          {a.grade}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-3 mt-0.5">
                                        <span className="text-xs text-ss-slate flex items-center gap-1">
                                          <Clock className="w-3 h-3" />{dateStr}
                                        </span>
                                        {a.topics.length > 0 && (
                                          <span className="text-xs text-ss-slate truncate">{a.topics.slice(0, 2).join(', ')}</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <div className="w-16 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${a.percentage}%`, background: gc2.text }} />
                                      </div>
                                      <span className="text-xs font-bold w-9 text-right" style={{ color: gc2.text }}>
                                        {a.percentage}%
                                      </span>
                                    </div>
                                  </button>
                                )
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>

            {/* ── RIGHT: Preview + Generate ── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-4 lg:sticky lg:top-20"
            >
              {/* Summary card */}
              <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-5">
                <p className="text-xs font-bold uppercase tracking-wider text-ss-slate dark:text-gray-500">Report Preview</p>

                {/* Student info */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{reportUser.name}</p>
                      <p className="text-xs text-ss-slate">
                        {reportClassLabel}{reportUser.studentId ? ` · ID ${reportUser.studentId}` : ''}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-gray-100 dark:bg-white/5" />

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-ss-slate mb-1">Selected</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white">{selectedIds.size}</p>
                    <p className="text-[10px] text-ss-slate">assessments</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: gc.bg }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: gc.text, opacity: 0.7 }}>Overall</p>
                    <p className="text-2xl font-black" style={{ color: gc.text }}>{overallGrade}</p>
                    <p className="text-[10px] font-semibold" style={{ color: gc.text, opacity: 0.8 }}>{overallAvg}% avg</p>
                  </div>
                </div>

                {/* Subject breakdown */}
                {selectedAssessments.length > 0 && (() => {
                  const subMap: Record<string, number[]> = {}
                  selectedAssessments.forEach(a => {
                    if (!subMap[a.subject]) subMap[a.subject] = []
                    subMap[a.subject].push(a.percentage)
                  })
                  return (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-ss-slate">By Subject</p>
                      {Object.entries(subMap).map(([subj, scores]) => {
                        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
                        const gc3 = GRADE_COLOR[getGrade(avg)]
                        return (
                          <div key={subj} className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 dark:text-gray-400 flex-1 truncate">{subj}</span>
                            <div className="w-16 h-1 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${avg}%`, background: gc3.text }} />
                            </div>
                            <span className="text-xs font-bold w-9 text-right" style={{ color: gc3.text }}>{avg}%</span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}

                <div className="h-px bg-gray-100 dark:bg-white/5" />

                {/* Actions */}
                <div className="space-y-2.5">
                  <button
                    onClick={generateAndPrint}
                    disabled={selectedIds.size === 0}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Printer className="w-4 h-4" />
                    Print Report Card
                  </button>
                  <button
                    onClick={generateAndDownload}
                    disabled={selectedIds.size === 0 || isGenerating}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-800 dark:text-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Download className="w-4 h-4" />
                    {isGenerating ? 'Opening…' : 'Save as PDF'}
                  </button>
                </div>

                {selectedIds.size === 0 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center">
                    Select at least one assessment to generate a report card.
                  </p>
                )}
              </div>

              {/* Week count badge */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-white/5 px-5 py-4 flex items-center gap-3">
                <Award className="w-5 h-5 text-violet-500 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    {weeks.filter(w => w.assessments.some(a => selectedIds.has(a.id))).length} week{weeks.filter(w => w.assessments.some(a => selectedIds.has(a.id))).length !== 1 ? 's' : ''} covered
                  </p>
                  <p className="text-[11px] text-ss-slate mt-0.5">Report card includes weekly breakdown</p>
                </div>
              </div>
            </motion.div>

          </div>
        )}
      </main>

      <ProfileSidebar isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </div>
  )
}
