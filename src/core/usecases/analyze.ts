import type { ProviderAgent, Message } from '../ports/ai-provider'
import type { Report, Session, Storage } from '../ports/storage'

const ANALYSIS_SYSTEM_PROMPT = `あなたはエンジニアの学習を分析する経験豊富なメンターです。
ユーザーとAIコーチの壁打ち履歴を読み、本人の実力を客観的に解析します。

次の観点でレポートしてください。
- 技術的な強み(具体的な根拠とともに)
- 弱み・つまずきやすい傾向
- 思考や質問の仕方の特徴
- 次に学ぶべきこと(優先順位をつけて具体的に)

前回の解析結果が与えられた場合は、そこからの成長や変化にも必ず触れてください。
励ましつつ、忖度のない率直な評価を行ってください。`

function buildPrompt(sessions: Session[], previous: Report | null): string {
  const body = sessions
    .map((s) =>
      s.messages
        .map((m) => `${m.role === 'user' ? 'ユーザー' : 'コーチ'}: ${m.content}`)
        .join('\n')
    )
    .join('\n---\n')

  let prompt = `以下はユーザーとAIコーチの壁打ち履歴です。これを分析してレポートしてください。\n\n${body}`
  if (previous) {
    prompt += `\n\n前回(${previous.createdAt})の解析結果は次の通りです。前回からの成長・変化も評価してください。\n\n${previous.content}`
  }
  return prompt
}

export async function analyze(
  provider: ProviderAgent,
  storage: Storage,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const sessions = storage.getAllSessions()
  if (sessions.length === 0) {
    throw new Error('解析する壁打ち履歴がありません。先に tanren ask で対話してください。')
  }

  const previous = storage.getLatestReport()
  const messages: Message[] = [{ role: 'user', content: buildPrompt(sessions, previous) }]

  // 中断・失敗時はここで例外が伝播し、保存はスキップされる
  const report = await provider.chatStream(ANALYSIS_SYSTEM_PROMPT, messages, onChunk, signal)
  storage.saveReport(report)
  return report
}
