import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function parseId(value: string | undefined) {
    const id = String(value ?? '').trim()
    return id ? id : null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const classroomId = parseId(resolved?.id)
    if (!classroomId) {
        return NextResponse.json({ error: 'Invalid classroom id' }, { status: 400 })
    }

    try {
        const { data, error } = await supabase
            .from('classrooms')
            .select('id,name,description,teacher_id,created_at,updated_at')
            .eq('id', classroomId)
            .single()

        if (error) {
            console.error('Classroom fetch error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ data })
    } catch (err) {
        console.error('Classroom fetch error:', err)
        return NextResponse.json({ error: 'Failed to load classroom' }, { status: 500 })
    }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const classroomId = parseId(resolved?.id)
    if (!classroomId) {
        return NextResponse.json({ error: 'Invalid classroom id' }, { status: 400 })
    }

    try {
        const body = await request.json()
        const name = body?.name !== undefined ? String(body.name).trim() : null
        const description = body?.description !== undefined ? String(body.description).trim() : null

        if (name === null && description === null) {
            return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
        }

        if (name !== null && !name) {
            return NextResponse.json({ error: 'Classroom name is required' }, { status: 400 })
        }

        const updatePayload: Record<string, any> = {
            updated_at: new Date().toISOString(),
        }
        if (name !== null) updatePayload.name = name
        if (description !== null) updatePayload.description = description

        const { error } = await supabase
            .from('classrooms')
            .update(updatePayload)
            .eq('id', classroomId)

        if (error) {
            const status = error.code === '23505' ? 409 : 500
            console.error('Classroom update error:', error)
            return NextResponse.json({ error: error.message }, { status })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Classroom update error:', err)
        return NextResponse.json({ error: 'Failed to update classroom' }, { status: 500 })
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolved = await params
    const classroomId = parseId(resolved?.id)
    if (!classroomId) {
        return NextResponse.json({ error: 'Invalid classroom id' }, { status: 400 })
    }

    try {
        const { error } = await supabase
            .from('classrooms')
            .delete()
            .eq('id', classroomId)

        if (error) {
            console.error('Classroom delete error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Classroom delete error:', err)
        return NextResponse.json({ error: 'Failed to delete classroom' }, { status: 500 })
    }
}
