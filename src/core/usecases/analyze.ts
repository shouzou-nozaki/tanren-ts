import type { ProviderAgent, Message } from '../ports/ai-provider'
import type { AbilityReport, Report, Session, Storage } from '../ports/storage'

type Axis = {
  key: string
  label: string
  focus: string
}

const AXES: Axis[] = [
  {
    key: 'coding',
    label: 'コーディング力',
    focus:
      '実装力・言語やAPIの知識・デバッグやエラー解決の進め方・コードの読み書きの精度に注目してください。',
  },
  {
    key: 'design',
    label: '設計力',
    focus:
      '責務分割・抽象化・依存方向・トレードオフの判断など、構造を考える力に注目してください。',
  },
]

function buildSystemPrompt(axis: Axis): string {
  return `あなたはエンジニアの「${axis.label}」を専門に評価する経験豊富なメンターです。
ユーザーとAIコーチの壁打ち履歴を読み、${axis.label}の観点に絞って実力を客観的に解析します。
${axis.focus}

次の点をレポートしてください。
- 強み(具体的な根拠とともに)
- 弱み・つまずきやすい傾向
- 次に学ぶべきこと(優先順位をつけて具体的に)

前回の解析結果が与えられた場合は、そこからの成長や変化にも必ず触れてください。
${axis.label}以外の観点には踏み込まず、励ましつつ忖度のない率直な評価を行ってください。`
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
  }
  return prompt
}

type AnalyzeHandlers = {
  onAxisStart: (label: string) => void
  onChunk: (text: string) => void
}

export async function analyze(
  provider: ProviderAgent,
  storage: Storage,
  handlers: AnalyzeHandlers,
  signal?: AbortSignal
): Promise<Report['abilities']> {
  const sessions = storage.getAllSessions()
  if (sessions.length === 0) {
    throw new Error('解析する壁打ち履歴がありません。先に tanren ask で対話してください。')
  }

  const transcript = buildTranscript(sessions)
  const previous = storage.getLatestReport()
  const abilities: AbilityReport[] = []

  // いずれかの軸で中断・失敗すれば例外が伝播し、保存はスキップされる
  for (const axis of AXES) {
    handlers.onAxisStart(axis.label)
    const previousAxis = previous?.abilities.find((a) => a.axis === axis.key)
    const messages: Message[] = [{ role: 'user', content: buildPrompt(transcript, previousAxis) }]
    const summary = await provider.chatStream(
      buildSystemPrompt(axis),
      messages,
      handlers.onChunk,
      signal
    )
    abilities.push({ axis: axis.key, summary })
  }

  storage.saveReport(abilities)
  return abilities
}
