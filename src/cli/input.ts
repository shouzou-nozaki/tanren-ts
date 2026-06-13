import { StringDecoder } from 'node:string_decoder'
import chalk from 'chalk'

// 端末にペーストの開始・終了を知らせてもらうブラケットペースト。
// 有効化すると、貼り付けたテキストは 200~ … 201~ で囲まれて届く
const PASTE_ENABLE = '\x1b[?2004h'
const PASTE_DISABLE = '\x1b[?2004l'
const PASTE_START = '\x1b[200~'
const PASTE_END = '\x1b[201~'

// 通常時の Enter で送信。ペースト中の改行は文字として取り込むので、
// 改行や空行を含む文章でも丸ごと貼れる。Ctrl+C / 空のままEOF はキャンセルで null
export function readMultilineInput(label: string): Promise<string | null> {
  const stdin = process.stdin
  const out = process.stdout
  const interactive = Boolean(stdin.isTTY && out.isTTY)
  const decoder = new StringDecoder('utf8')

  let buffer = ''
  let pasting = false
  let pending = '' // エスケープ列がチャンク跨ぎで途切れたとき用に溜める

  const echo = (s: string): void => {
    if (interactive) out.write(s)
  }

  return new Promise((resolve) => {
    let done = false

    const cleanup = (): void => {
      stdin.removeListener('data', onData)
      if (interactive) {
        out.write(PASTE_DISABLE)
        if (stdin.isTTY) stdin.setRawMode(false)
      }
      try {
        stdin.pause()
      } catch {
        /* 既に閉じていても気にしない */
      }
    }

    const finish = (value: string | null): void => {
      if (done) return
      done = true
      cleanup()
      resolve(value)
    }

    const handleChar = (ch: string): void => {
      if (pasting) {
        // ペースト中はあらゆる改行を本文の改行として残す
        const c = ch === '\r' ? '\n' : ch
        buffer += c
        echo(c)
        return
      }
      // Enter は送信
      if (ch === '\r' || ch === '\n') {
        echo('\n')
        finish(buffer)
        return
      }
      // Ctrl+C は常にキャンセル
      if (ch === '\x03') {
        echo('\n')
        finish(null)
        return
      }
      // Ctrl+D は空のときだけEOF扱い。入力中は無視する
      if (ch === '\x04') {
        if (buffer.length === 0) {
          echo('\n')
          finish(null)
        }
        return
      }
      // Backspace（DEL / BS）。直近の1文字を消す
      if (ch === '\x7f' || ch === '\b') {
        if (buffer.length === 0) return
        const last = buffer[buffer.length - 1]
        buffer = buffer.slice(0, -1)
        // 行頭をまたぐ削除は端末上の戻しが面倒なので、画面はそのまま内部だけ消す
        if (last !== '\n') echo('\b \b')
        return
      }
      // その他の制御文字は捨てる（タブは通す）
      if (ch !== '\t' && ch < ' ') return
      buffer += ch
      echo(ch)
    }

    // pending を先頭から食えるだけ食う。未完のエスケープ列が末尾に残ったら持ち越す
    const processPending = (): void => {
      let i = 0
      while (i < pending.length && !done) {
        if (pending.startsWith(PASTE_START, i)) {
          pasting = true
          i += PASTE_START.length
          continue
        }
        if (pending.startsWith(PASTE_END, i)) {
          pasting = false
          i += PASTE_END.length
          continue
        }
        const ch = pending[i]
        if (ch === '\x1b') {
          const rest = pending.slice(i)
          // ペーストマーカーの途中かもしれない。続きを待つ
          if (PASTE_START.startsWith(rest) || PASTE_END.startsWith(rest)) break
          // KittyキーボードプロトコルではEnterやBackspaceがCSI-u列で届く
          const key = parseCsiU(rest)
          if (key === 'incomplete') break
          if (key) {
            if (key.code === 13) {
              // Shift+Enter は改行、ただのEnterは送信
              if (key.shift) {
                buffer += '\n'
                echo('\n')
              } else {
                echo('\n')
                finish(buffer)
              }
            } else if (key.code === 127 || key.code === 8) {
              handleChar('\x7f')
            }
            // それ以外のCSI-uキーは無視する
            i += key.consumed
            continue
          }
          // 矢印キー等の残りのCSI列はまとめて読み飛ばす
          const consumed = skipEscape(rest)
          if (consumed === -1) break // 未完。続きを待つ
          i += consumed
          continue
        }
        handleChar(ch)
        i++
      }
      pending = pending.slice(i)
    }

    const onData = (chunk: Buffer): void => {
      pending += decoder.write(chunk)
      processPending()
    }

    echo(chalk.green(label))
    if (interactive) {
      if (stdin.isTTY) stdin.setRawMode(true)
      out.write(PASTE_ENABLE)
    }
    stdin.resume()
    stdin.on('data', onData)
    // パイプ入力などでEOFに達したとき。溜まっていれば送信、無ければ null
    stdin.once('end', () => finish(buffer.length > 0 ? buffer : null))
  })
}

// \x1b[<code>u / \x1b[<code>;<mods>u 形式のCSI-uキーを解読する
function parseCsiU(
  rest: string
): { code: number; shift: boolean; consumed: number } | 'incomplete' | null {
  const m = rest.match(/^\x1b\[(\d+)(?:;(\d+))?u/)
  if (m) {
    const mods = m[2] ? Number(m[2]) : 1
    return { code: Number(m[1]), shift: ((mods - 1) & 1) !== 0, consumed: m[0].length }
  }
  // まだ途中（\x1b / \x1b[13 / \x1b[13; など）なら続きを待つ
  if (/^\x1b(\[\d*(;\d*)?)?$/.test(rest)) return 'incomplete'
  return null
}

// ESC で始まるCSI/SS3列を読み飛ばす。消費した文字数、未完なら -1 を返す
function skipEscape(rest: string): number {
  if (rest.length < 2) return -1
  const second = rest[1]
  if (second === '[' || second === 'O') {
    // CSI/SS3 は @〜~ の範囲の終端バイトまで（途中の数字や ; は飛ばす）
    for (let j = 2; j < rest.length; j++) {
      if (rest[j] >= '@' && rest[j] <= '~') return j + 1
    }
    return -1
  }
  // 単独ESCや短い列はESCだけ捨てる
  return 1
}
