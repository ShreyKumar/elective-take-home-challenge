import { describe, expect, it } from 'vitest'
import { parseCapacity, parseCount, parseName } from './validation'

// parseCapacity and parseCount share the same positive-integer rule, so their
// accept/reject tables are identical; parseName has its own (non-empty) rule.
describe.each([
  ['parseCapacity', parseCapacity],
  ['parseCount', parseCount],
])('%s (positive integer)', (_label, parse) => {
  // Plain positive integers pass through unchanged.
  it('accepts positive integers', () => {
    expect(parse('1')).toBe(1) // capacity 1 / take 1 is the minimum valid value
    expect(parse('10')).toBe(10)
    expect(parse('99999')).toBe(99999)
    expect(parse('007')).toBe(7) // leading zeros are normalized by Number(), not rejected
  })

  // Surrounding whitespace is trimmed before parsing, not rejected — tabs and
  // newlines included, mirroring parseName's whitespace handling.
  it('trims surrounding whitespace', () => {
    expect(parse('  5  ')).toBe(5)
    expect(parse('\t5\n')).toBe(5)
  })

  // Zero fails the >= 1 floor even though it is a non-negative integer.
  it('rejects zero', () => {
    expect(parse('0')).toBeNull()
    expect(parse('00')).toBeNull()
  })

  // Empty / whitespace-only strings have no digits to parse.
  it('rejects blank input', () => {
    expect(parse('')).toBeNull()
    expect(parse('   ')).toBeNull()
  })

  // Signs, decimals, exponents, and stray letters are all non-digit input.
  it('rejects non-integer and non-numeric input', () => {
    for (const bad of ['-1', '1.5', '1e3', 'abc', '5x', '1,000', '+2']) {
      expect(parse(bad)).toBeNull()
    }
  })
})

describe('parseName', () => {
  // A name is any non-empty string; it is returned trimmed.
  it('accepts a non-empty name and trims it', () => {
    expect(parseName('Ada')).toBe('Ada')
    expect(parseName('  Grace Hopper  ')).toBe('Grace Hopper')
  })

  // Empty and whitespace-only names are rejected.
  it('rejects empty and whitespace-only names', () => {
    expect(parseName('')).toBeNull()
    expect(parseName('   ')).toBeNull()
    expect(parseName('\t\n')).toBeNull()
  })

  // Names are labels, not identifiers — punctuation and numbers are fine.
  it('accepts names with punctuation, numbers, and unicode', () => {
    expect(parseName("O'Brien")).toBe("O'Brien")
    expect(parseName('Studio 54')).toBe('Studio 54')
    expect(parseName('  José  ')).toBe('José')
  })
})
