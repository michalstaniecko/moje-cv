import { describe, expect, test, vi } from 'vitest'
import { createExportedFiles } from './exportedFiles'

function setup() {
  const shell = {
    openPath: vi.fn(async (_path: string) => ''),
    showItemInFolder: vi.fn((_path: string) => {})
  }
  return { shell, files: createExportedFiles(shell) }
}

describe('exported files', () => {
  test('opens and shows a file saved by an export', async () => {
    const { shell, files } = setup()
    files.remember('/Users/ewa/Documents/CV_Ewa.pdf')

    await files.open('/Users/ewa/Documents/CV_Ewa.pdf')
    files.showInFolder('/Users/ewa/Documents/CV_Ewa.pdf')

    expect(shell.openPath).toHaveBeenCalledWith('/Users/ewa/Documents/CV_Ewa.pdf')
    expect(shell.showItemInFolder).toHaveBeenCalledWith('/Users/ewa/Documents/CV_Ewa.pdf')
  })

  test('refuses to open or show a path that no export saved', async () => {
    const { shell, files } = setup()
    files.remember('/Users/ewa/Documents/CV_Ewa.pdf')

    await files.open('/Applications/Calculator.app')
    files.showInFolder('/etc/passwd')

    expect(shell.openPath).not.toHaveBeenCalled()
    expect(shell.showItemInFolder).not.toHaveBeenCalled()
  })

  test('remembers files from every export format', async () => {
    const { shell, files } = setup()
    files.remember('/Users/ewa/Documents/CV_Ewa.pdf')
    files.remember('/Users/ewa/Documents/CV_Ewa.docx')

    await files.open('/Users/ewa/Documents/CV_Ewa.pdf')
    await files.open('/Users/ewa/Documents/CV_Ewa.docx')

    expect(shell.openPath.mock.calls.map(([path]) => path)).toEqual([
      '/Users/ewa/Documents/CV_Ewa.pdf',
      '/Users/ewa/Documents/CV_Ewa.docx'
    ])
  })
})
