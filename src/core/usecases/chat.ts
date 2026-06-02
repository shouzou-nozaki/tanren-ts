import type { ProviderAgent, Message } from '../ports/ai-provider'
import type { SessionStore } from '../ports/storage'

const SYSTEM_PROMPT = `あなたは豊富な実務経験を持つシニアエンジニアリングコーチです。
相手の成長を心から応援しながら、的確で実践的なアドバイスを行います。

- 言葉は分かりやすく、相手のレベルに合わせた粒度で話す
- 抽象論より具体的な次のアクションを示す
- 詰まっている問題には根本原因を掘り下げる
- 技術的な質問には正確かつ実践的に答える`

export async function chat(
  userInput: string,
  provider: ProviderAgent,
  storage: SessionStore,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const recent = storage.getRecentSessions(5)

  // 過去の会話履歴を時系列で並べる
  const history: Message[] = recent
    .flatMap((s) => s.messages)

  const messages: Message[] = [...history, { role: 'user', content: userInput }]

  // 中断・失敗時はここで例外が伝播し、保存はスキップされる
  const response = await provider.chatStream(SYSTEM_PROMPT, messages, onChunk, signal)

  storage.saveSession([
    { role: 'user', content: userInput },
    { role: 'assistant', content: response },
  ])
}
