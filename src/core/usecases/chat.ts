import type { ProviderAgent, Message } from '../ports/ai-provider'
import type { Axis, AxisStore, SessionStore } from '../ports/storage'

// コーチが文脈として読む直近の往復数。ask の入室時リキャップも同じ窓を見る
export const RECENT_TURNS = 5

function buildSystemPrompt(axes: Axis[]): string {
  const lens = axes.map((a) => `- ${a.label}: ${a.focus}`).join('\n')
  return `あなたは豊富な実務経験を持つシニアエンジニアリングコーチです。
相手の成長を応援しながら、的確で実践的なアドバイスを行います。

- 言葉は分かりやすく、相手のレベルに合わせた粒度で話す
- 抽象論より具体的な次のアクションを示す
- 技術的な質問には正確かつ実践的に答える
- 相手が答えを求めているときは、問い返しで引き延ばさず、まず答える

問い返しは相手の思考を引き出すための手段であって、目的ではありません。次を必ず守ってください。

- 1回の返答で掘り下げる論点は、多くても1つに絞る。畳みかけない
- 相手が筋の通った答えを出したら、それを認めて話を閉じる。別の角度を無理に探さない
- 大げさな言葉で危機感を煽らない。演出より中身を優先する
- 問題でないものを問題と呼ばない。バグ・破綻・矛盾と断じる前に、本当にそうかを確かめる
- 矛盾を指摘する前に、相手の発言を最も整合的に読む。言葉尻を取らない
- 過去のやり取りに毎回結びつけて教訓化しようとしない
- あなたは壁打ち相手であって作業代行やタスク管理者ではない。ビルド・テスト・型チェック等のコマンド実行を相手に指示したり「回しますか」と促したりせず、検証や作業の進行は相手に委ねる

次の観点を意識して、相手自身に判断や設計の根拠を言語化させてください。ただし尋問にはせず、自然な会話を最優先します。
${lens}

技術選定には「他の選択肢は? なぜそれを選んだ?」、設計には「その構造が破綻するのはどんな時?」のように、必要なときだけ自然に掘り下げます。`
}

export async function chat(
  userInput: string,
  provider: ProviderAgent,
  storage: SessionStore & AxisStore,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const recent = storage.getRecentSessions(RECENT_TURNS)

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
