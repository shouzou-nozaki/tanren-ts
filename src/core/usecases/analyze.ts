import type { ProviderAgent, Message } from '../ports/ai-provider'
import type {
  AbilityReport,
  Axis,
  AxisStore,
  Report,
  ReportStore,
  Session,
  SessionStore,
} from '../ports/storage'

function buildSystemPrompt(axis: Axis): string {
  return `あなたはエンジニアの「${axis.label}」を専門に評価する経験豊富なメンターです。
ユーザーとAIコーチの壁打ち履歴を読み、${axis.label}の観点に絞って実力を客観的に解析します。
${axis.focus}

次の点をレポートしてください。
- 強み(具体的な根拠とともに)
- 弱み・つまずきやすい傾向

前回の解析結果が与えられた場合は、そこからの成長や変化にも必ず触れてください。
${axis.label}以外の観点には踏み込まず、励ましつつ忖度のない率直な評価を行ってください。

続いて、次に取り組むべきことを以下の形式で箇条書きにしてください(各項目は具体的で実行可能な1文)。
次のアクション:
- ...
- ...

最後に、この観点の現在の到達度を5段階で採点し、末尾に1行だけ記してください。基準は次の通りです。
5: 高い水準で安定して発揮できている
4: おおむね発揮できているが一部に課題が残る
3: 基礎はあるが場当たり的で不安定
2: 断片的で根拠が弱い
1: ほとんど見られない
ただし今回の壁打ちにこの観点を評価する材料が乏しい場合は、無理に採点しないでください。
スコア: N/5    (採点できない場合は「スコア: 評価不能」)`
}

// エージェント出力末尾の「スコア: N/5」を読む。読めなければ null(=据え置き扱い)
export function parseScore(text: string): number | null {
  const marker = text.lastIndexOf('スコア')
  if (marker === -1) return null
  const m = text.slice(marker).match(/([1-5])\s*\/\s*5/)
  return m ? Number(m[1]) : null
}

// エージェント出力末尾の「次のアクション:」以降の箇条書きを抽出する
export function parseNextActions(text: string): string[] {
  const marker = text.lastIndexOf('次のアクション')
  if (marker === -1) return []
  return text
    .slice(marker)
    .split('\n')
    .filter((l) => /^\s*([-*・]|\d+[.)])\s*/.test(l))
    .map((l) => l.replace(/^\s*([-*・]|\d+[.)])\s*/, '').trim())
    .filter((l) => l.length > 0)
}

const SESSION_LIMIT = 20

// 過去の評価は前回レポートに畳み込まれているため、生ログは「前回以降の新規ぶん」だけ送る
function selectSessions(sessions: Session[], previous: Report | null): Session[] {
  const fresh = previous
    ? sessions.filter((s) => s.createdAt > previous.createdAt)
    : sessions
  return fresh.slice(-SESSION_LIMIT)
}

function buildTranscript(sessions: Session[]): string {
  return sessions
    .map((s) =>
      s.messages
        .map((m) => `${m.role === 'user' ? 'ユーザー' : 'コーチ'}: ${m.content}`)
        .join('\n')
    )
    .join('\n---\n')
}

function buildPrompt(transcript: string, previous: AbilityReport | undefined): string {
  let prompt = `以下はユーザーとAIコーチの壁打ち履歴です。これを分析してレポートしてください。\n\n${transcript}`
  if (previous) {
    prompt += `\n\n前回の同じ観点の解析結果は次の通りです。前回からの成長・変化も評価してください。\n\n${previous.summary}`
    if (previous.nextActions.length > 0) {
      const list = previous.nextActions.map((a) => `- ${a}`).join('\n')
      prompt += `\n\n前回あなたが提示した「次のアクション」は以下です。今回の壁打ちでこれらに取り組めたか・進捗があったかを必ず評価してください。\n${list}`
    }
  }
  return prompt
}

type AnalyzeHandlers = {
  onAxisStart: (label: string) => void
  onChunk: (text: string) => void
}

export async function analyze(
  provider: ProviderAgent,
  storage: SessionStore & ReportStore & AxisStore,
  handlers: AnalyzeHandlers,
  signal?: AbortSignal
): Promise<Report['abilities']> {
  const sessions = storage.getAllSessions()
  if (sessions.length === 0) {
    throw new Error('解析する壁打ち履歴がありません。先に tanren ask で対話してください。')
  }

  const previous = storage.getLatestReport()
  const target = selectSessions(sessions, previous)
  if (target.length === 0) {
    throw new Error('前回の解析以降、新しい壁打ちがありません。先に tanren ask で対話してください。')
  }

  const transcript = buildTranscript(target)
  const axes = storage.getAxes()
  const abilities: AbilityReport[] = []

  // いずれかの軸で中断・失敗すれば例外が伝播し、保存はスキップされる
  for (const axis of axes) {
    handlers.onAxisStart(axis.label)
    const previousAxis = previous?.abilities.find((a) => a.axis === axis.key)
    const messages: Message[] = [{ role: 'user', content: buildPrompt(transcript, previousAxis) }]
    const summary = await provider.chatStream(
      buildSystemPrompt(axis),
      messages,
      handlers.onChunk,
      signal
    )
    // 今回採点できなければ前回点を据え置く
    const score = parseScore(summary) ?? previousAxis?.score ?? null
    abilities.push({
      axis: axis.key,
      summary,
      nextActions: parseNextActions(summary),
      score,
    })
  }

  storage.saveReport(abilities)
  return abilities
}
