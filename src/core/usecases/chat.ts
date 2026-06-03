import type { ProviderAgent, Message } from '../ports/ai-provider'
import type { Axis, AxisStore, SessionStore } from '../ports/storage'

function buildSystemPrompt(axes: Axis[]): string {
  const lens = axes.map((a) => `- ${a.label}: ${a.focus}`).join('\n')
  return `あなたは豊富な実務経験を持つシニアエンジニアリングコーチです。
相手の成長を心から応援しながら、的確で実践的なアドバイスを行います。

- 言葉は分かりやすく、相手のレベルに合わせた粒度で話す
- 抽象論より具体的な次のアクションを示す
- 詰まっている問題には根本原因を掘り下げる
- 技術的な質問には正確かつ実践的に答える

この壁打ちでは、相手の次の力を会話の中で引き出すことを意識してください。一方的に教えるのではなく、問い返しによって相手自身に判断や設計の根拠を言語化させてください。
${lens}

例えば技術選定の話には「他の選択肢は? なぜそれを選んだ?」、設計の話には「その構造が破綻するのはどんな時?」のように掘り下げます。ただし尋問にならないよう、自然な会話の流れを保ってください。`
}

export async function chat(
  userInput: string,
  provider: ProviderAgent,
  storage: SessionStore & AxisStore,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const recent = storage.getRecentSessions(5)

  // 過去の会話履歴を時系列で並べる
  const history: Message[] = recent
    .flatMap((s) => s.messages)

  const messages: Message[] = [...history, { role: 'user', content: userInput }]

  // 中断・失敗時はここで例外が伝播し、保存はスキップされる
  const response = await provider.chatStream(buildSystemPrompt(storage.getAxes()), messages, onChunk, signal)

  storage.saveSession([
    { role: 'user', content: userInput },
    { role: 'assistant', content: response },
  ])
}
