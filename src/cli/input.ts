import * as readline from 'node:readline'
import chalk from 'chalk'

function pauseStdin(): void {
  try {
    if (process.stdin.readable && !process.stdin.destroyed) process.stdin.pause()
  } catch {
    return
  }
}

// Enterで改行して行を溜め、空行で送信する。Ctrl+C / EOF はキャンセルで null を返す。
// @inquirer の input と違い改行で即確定しないため、複数行のペーストが丸ごと入る
export function readMultilineInput(label: string): Promise<string | null> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const lines: string[] = []
  const firstPrompt = chalk.green(label)
  const contPrompt = chalk.gray('… ')

  return new Promise((resolve) => {
    let done = false
    const finish = (value: string | null): void => {
      if (done) return
      done = true
      rl.close()
      pauseStdin()
      resolve(value)
    }

    rl.setPrompt(firstPrompt)
    rl.prompt()

    rl.on('line', (line) => {
      if (line === '') {
        if (lines.length > 0) finish(lines.join('\n'))
        else rl.prompt() // 何も無いところでの空行は無視して待つ
        return
      }
      lines.push(line)
      rl.setPrompt(contPrompt)
      rl.prompt()
    })

    rl.on('SIGINT', () => finish(null))
    rl.on('close', () => finish(lines.length > 0 ? lines.join('\n') : null))
  })
}
