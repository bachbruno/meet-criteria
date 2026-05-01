import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkNodeVersion,
  checkFigmaDesktop,
  MIN_NODE_MAJOR,
} from './system-checks.mjs'

test('MIN_NODE_MAJOR é 18 (requisito do figma-console MCP)', () => {
  assert.equal(MIN_NODE_MAJOR, 18)
})

test('checkNodeVersion aprova 20.10.0', () => {
  const r = checkNodeVersion({ nodeVersion: '20.10.0' })
  assert.equal(r.ok, true)
  assert.equal(r.major, 20)
  assert.equal(r.detected, '20.10.0')
})

test('checkNodeVersion aprova exatamente 18.0.0 (limite inclusivo)', () => {
  const r = checkNodeVersion({ nodeVersion: '18.0.0' })
  assert.equal(r.ok, true)
  assert.equal(r.major, 18)
})

test('checkNodeVersion reprova 16.20.0 com mensagem clara', () => {
  const r = checkNodeVersion({ nodeVersion: '16.20.0' })
  assert.equal(r.ok, false)
  assert.equal(r.major, 16)
  assert.match(r.message, /18/)
})

test('checkNodeVersion reprova string mal-formada', () => {
  const r = checkNodeVersion({ nodeVersion: 'banana' })
  assert.equal(r.ok, false)
  assert.match(r.message, /parse|invalid|version/i)
})

test('checkFigmaDesktop encontra app no macOS via path padrão', () => {
  const r = checkFigmaDesktop({
    platform: 'darwin',
    exists: (p) => p === '/Applications/Figma.app',
  })
  assert.equal(r.ok, true)
  assert.equal(r.path, '/Applications/Figma.app')
})

test('checkFigmaDesktop reporta não encontrado no macOS quando ausente', () => {
  const r = checkFigmaDesktop({
    platform: 'darwin',
    exists: () => false,
  })
  assert.equal(r.ok, false)
  assert.match(r.message, /Figma Desktop/i)
})

test('checkFigmaDesktop encontra Figma no Windows em LOCALAPPDATA', () => {
  const r = checkFigmaDesktop({
    platform: 'win32',
    env: { LOCALAPPDATA: 'C:/Users/me/AppData/Local' },
    exists: (p) => p === 'C:/Users/me/AppData/Local/Figma/Figma.exe',
  })
  assert.equal(r.ok, true)
  assert.match(r.path, /Figma\.exe$/)
})

test('checkFigmaDesktop em Linux reporta não-suportado-com-detecção (fallback informativo)', () => {
  const r = checkFigmaDesktop({
    platform: 'linux',
    exists: () => false,
  })
  assert.equal(r.ok, false)
  assert.equal(r.unsupported, true)
  assert.match(r.message, /Linux|manual/i)
})
