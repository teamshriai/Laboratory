import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'

describe('CSV export', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(toCsv([['a,b', 'say "hi"', 'two\nlines', 4.2, null]])).toBe(
      '"a,b","say ""hi""","two\nlines",4.2,',
    )
  })

  it('neutralises cells a spreadsheet would run as formulas', () => {
    expect(toCsv([['=SUM(A1)', '+1', '@cmd', '-x', '-5', '-0.4']])).toBe(
      "'=SUM(A1),'+1,'@cmd,'-x,-5,-0.4",
    )
  })

  it('separates rows with CRLF', () => {
    expect(toCsv([['a'], ['b']])).toBe('a\r\nb')
  })
})
