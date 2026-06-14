import { StringDecoder } from 'node:string_decoder'
import chalk from 'chalk'

// 端末にペーストの開始・終了を知らせてもらうブラケットペースト。
// 有効化すると、貼り付けたテキストは 200~ … 201~ で囲まれて届く
const PASTE_ENABLE = '\x1b[?2004h'
const PASTE_DISABLE = '\x1b[?2004l'
const PASTE_START = '\x1b[200~'
const PASTE_END = '\x1b[201~'
// Kittyキーボードプロトコル。flag 1（曖昧解消）で Shift+Enter を CSI-u で区別できる
const KITTY_ENABLE = '\x1b[>1u'
const KITTY_DISABLE = '\x1b[<u'

// Enter で送信、Shift+Enter / Ctrl+J で改行。ペーストは改行ごと丸ごと取り込む。
// キーのたびに入力欄を再描画するので、複数行でも削除が画面に反映される。
// Ctrl+C / 空のままEOF はキャンセルで null を返す
export function readMultilineInput(label: string): Promise<string | null> {
  const stdin = process.stdin
  const out = process.stdout
  const interactive = Boolean(stdin.isTTY && out.isTTY)
  const decoder = new StringDecoder('utf8')
  const coloredLabel = chalk.green(label)
  const promptWidth = displayWidth(label)

  let buffer = ''
  let pasting = false
  let wasRaw = false // 入室前の raw 状態。退室時にここへ戻す
  let pending = '' // エスケープ列がチャンク跨ぎで途切れたとき用に溜める
  let renderedRows = 0 // 直近の描画でカーソルがホームから何行下にいるか

  return new Promise((resolve) => {
    let done = false

    // buffer を正として入力欄を丸ごと描き直す。前回ぶんを消してから書く
    const render = (): void => {
      if (!interactive) return
      const cols = out.columns || 80
      if (renderedRows > 0) out.write(`\x1b[${renderedRows}A`)
      out.write('\r\x1b[0J') // 行頭へ戻し、画面末尾まで消す
      out.write(coloredLabel + buffer)
      renderedRows = rowsAboveCursor(promptWidth, buffer, cols)
    }

    const cleanup = (): void => {
      stdin.removeListener('data', onData)
      if (interactive) {
        out.write(PASTE_DISABLE)
        out.write(KITTY_DISABLE)
        if (stdin.isTTY) stdin.setRawMode(wasRaw)
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
      if (interactive) out.write('\n') // 入力欄の下へ抜けて、続く出力を改行から始める
      cleanup()
      resolve(value)
    }

    const handleChar = (ch: string): void => {
      if (pasting) {
        // ペースト中はあらゆる改行を本文の改行として残す。制御文字は改行とタブ以外捨てる
        const c = ch === '\r' ? '\n' : ch
        if (c < ' ' && c !== '\n' && c !== '\t') return
        buffer += c
        return
      }
      if (ch === '\r') {
        finish(buffer) // Enter = 送信
        return
      }
      if (ch === '\n') {
        // Ctrl+J や一部端末の Shift+Enter は改行。パイプ等では送信
        if (interactive) buffer += '\n'
        else finish(buffer)
        return
      }
      if (ch === '\x03') {
        finish(null) // Ctrl+C
        return
      }
      if (ch === '\x04') {
        if (buffer.length === 0) finish(null) // Ctrl+D は空のときだけEOF
        return
      }
      if (ch === '\x7f' || ch === '\b') {
        if (buffer.length > 0) buffer = dropLastChar(buffer) // Backspace
        return
      }
      if (ch !== '\t' && ch < ' ') return // その他の制御文字は捨てる
      buffer += ch
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
              if (key.shift && interactive) buffer += '\n' // Shift+Enter = 改行
              else finish(buffer) // Enter = 送信
            } else if (key.code === 127 || key.code === 8) {
              handleChar('\x7f') // Backspace
            }
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
      if (!done) render()
    }

    const onData = (chunk: Buffer): void => {
      pending += decoder.write(chunk)
      processPending()
    }

    if (interactive) {
      wasRaw = Boolean(stdin.isRaw)
      if (stdin.isTTY) stdin.setRawMode(true)
      out.write(PASTE_ENABLE)
      out.write(KITTY_ENABLE)
    }
    render()
    stdin.resume()
    stdin.on('data', onData)
    // パイプ入力などでEOFに達したとき。溜まっていれば送信、無ければ null
    stdin.once('end', () => finish(buffer.length > 0 ? buffer : null))
  })
}

// buffer の末尾1文字（コードポイント単位。絵文字も丸ごと）を落とす
function dropLastChar(s: string): string {
  const chars = Array.from(s)
  chars.pop()
  return chars.join('')
}

// 描画後のカーソルが、入力欄の先頭行から何行下にいるかを返す（折り返しと日本語幅を考慮）
function rowsAboveCursor(promptWidth: number, buffer: string, cols: number): number {
  const lines = buffer.split('\n')
  let rows = 0
  for (let i = 0; i < lines.length; i++) {
    const w = (i === 0 ? promptWidth : 0) + displayWidth(lines[i])
    if (i < lines.length - 1) {
      // 改行で終わる行は ceil 行ぶん消費する
      rows += Math.max(1, Math.ceil(w / cols))
    } else {
      // 末尾行はカーソルがそこに居る。遅延折り返しを考え (w-1)/cols で数える
      rows += w === 0 ? 0 : Math.floor((w - 1) / cols)
    }
  }
  return rows
}

// 文字列の表示幅。CJK・全角・絵文字帯は幅2、それ以外は1とみなす近似
function displayWidth(s: string): number {
  let w = 0
  for (const ch of s) w += charWidth(ch.codePointAt(0) ?? 0)
  return w
}

function charWidth(cp: number): number {
  if (cp === 0) return 0
  if (
    (cp >= 0x1100 && cp <= 0x115f) || // Hangul Jamo
    cp === 0x2329 ||
    cp === 0x232a ||
    (cp >= 0x2e80 && cp <= 0x303e) || // CJK 部首〜記号
    (cp >= 0x3041 && cp <= 0x33ff) || // かな・カタカナ・CJK記号
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK 拡張A
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK 統合漢字
    (cp >= 0xa000 && cp <= 0xa4cf) || // Yi
    (cp >= 0xac00 && cp <= 0xd7a3) || // ハングル音節
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK 互換漢字
    (cp >= 0xfe30 && cp <= 0xfe4f) || // CJK 互換形
    (cp >= 0xff00 && cp <= 0xff60) || // 全角形
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1faff) || // 絵文字帯
    (cp >= 0x20000 && cp <= 0x3fffd) // CJK 拡張B以降
  ) {
    return 2
  }
  return 1
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
