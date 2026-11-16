// lib/studylab/drawerKey.test.ts
import { describe, it, expect } from 'vitest'
import { drawerKey } from './drawerKey'

const on = (tagName?: string, isContentEditable = false) => ({ tagName, isContentEditable })

describe('drawerKey', () => {
  it('opens the chat on / from anywhere but a place you type', () => {
    expect(drawerKey({ key: '/', target: on('DIV'), open: false })).toBe('open')
    expect(drawerKey({ key: '/', target: null, open: false })).toBe('open')
    expect(drawerKey({ key: '/', target: on('INPUT'), open: false })).toBeNull()
    expect(drawerKey({ key: '/', target: on('TEXTAREA'), open: false })).toBeNull()
    expect(drawerKey({ key: '/', target: on('DIV', true), open: false })).toBeNull()
  })

  it('does nothing with / once the chat is open', () => {
    expect(drawerKey({ key: '/', target: on('DIV'), open: true })).toBeNull()
  })

  it('closes the chat on Escape, and only when it is open', () => {
    expect(drawerKey({ key: 'Escape', target: on('TEXTAREA'), open: true })).toBe('close')
    expect(drawerKey({ key: 'Escape', target: on('DIV'), open: false })).toBeNull()
  })

  it('ignores every other key', () => {
    expect(drawerKey({ key: 'a', target: on('DIV'), open: false })).toBeNull()
    expect(drawerKey({ key: 'Enter', target: on('DIV'), open: true })).toBeNull()
  })
})
