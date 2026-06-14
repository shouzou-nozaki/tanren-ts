import { query, type CanUseTool } from '@anthropic-ai/claude-agent-sdk'
import type { Provider, ProviderAgent, Message } from '../../core/ports/ai-provider'

// パスが渡されたら推測で語らず実際に読ませる(Claude Agent SDK のツール利用前提)
const TOOL_HINT =
  '\n\nファイルやディレクトリのパスが示されたら、推測で語らず Read・Grep・Glob で実際に中身を読んでから具体的に答えてください。コードの変更や差分について問われたら、git diff・git log など読み取り専用の git で実際の変更を確認してください。ファイルの編集や git の書き込み操作はできません。'

// コーチに許可する読み取り専用の git サブコマンド
const READONLY_GIT = new Set([
  'diff',
  'log',
  'show',
  'status',
  'blame',
  'branch',
  'tag',
  'remote',
  'describe',
  'rev-parse',
  'shortlog',
  'ls-files',
  'ls-tree',
  'reflog',
  'whatchanged',
])

// 読み取り専用の git だけ true。連結・リダイレクト・コマンド置換を含むものは一律 false
export function isReadonlyGit(command: string): boolean {
  const cmd = command.trim()
  if (/[;&|<>`$()]|\n/.test(cmd)) return false
  const m = cmd.match(/^git\s+([a-z][a-z-]*)([\s\S]*)$/)
  if (!m) return false
  const sub = m[1]
  if (sub === 'stash') return /^\s+(list|show)\b/.test(m[2]) // stash は list/show のみ
  return READONLY_GIT.has(sub)
}

const READ_TOOLS = new Set(['Read', 'Grep', 'Glob'])

// 壁打ちコーチは読み取り専用。Read/Grep/Glob と読み取り専用 git の Bash だけ通す
const canUseTool: CanUseTool = async (toolName, input) => {
  if (READ_TOOLS.has(toolName)) return { behavior: 'allow', updatedInput: input }
  if (toolName === 'Bash' && isReadonlyGit(String(input.command ?? ''))) {
    return { behavior: 'allow', updatedInput: input }
  }
  return {
    behavior: 'deny',
    message:
      '許可されているのは Read/Grep/Glob と、読み取り専用の git（diff/log/show/status 等）だけです。',
  }
}

function buildPrompt(messages: Message[]): string {
  if (messages.length <= 1) return messages[messages.length - 1]?.content ?? ''
  const history = messages
    .slice(0, -1)
    .map((m) => `${m.role === 'user' ? 'ユーザー' : 'コーチ'}: ${m.content}`)
    .join('\n')
  const last = messages[messages.length - 1].content
  return `これまでの会話:\n${history}\n\n新しい発言:\n${last}`
}

class ClaudeAgent implements ProviderAgent {
  readonly capabilities = { readsLocalSource: true }

  async chatStream(
    systemPrompt: string,
    messages: Message[],
    onChunk: (text: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const controller = new AbortController()
    if (signal) {
      if (signal.aborted) controller.abort()
      else signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    const stream = query({
      prompt: buildPrompt(messages),
      options: {
        systemPrompt: systemPrompt + TOOL_HINT,
        allowedTools: ['Read', 'Grep', 'Glob'],
        disallowedTools: ['Write', 'Edit', 'NotebookEdit'],
        canUseTool,
        maxTurns: 10,
        includePartialMessages: true,
        abortController: controller,
      },
    })

    let fullText = ''
    let resultError: string | undefined
    for await (const msg of stream) {
      if (signal?.aborted) throw signal.reason ?? new Error('中断されました')

      if (msg.type === 'stream_event') {
        const event = msg.event
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          onChunk(event.delta.text)
          fullText += event.delta.text
        }
      } else if (msg.type === 'result' && msg.subtype !== 'success') {
        // ツール使用中などに上限へ達しても、得られた応答は捨てない
        resultError = msg.subtype
      }
    }

    // 応答が全く取れなかった時だけエラーとする
    if (fullText.length === 0 && resultError) {
      throw new Error(`Claude応答エラー: ${resultError}`)
    }
    return fullText
  }
}

export class ClaudeProvider implements Provider {
  readonly requiresApiKey = false
  setup(): ProviderAgent {
    return new ClaudeAgent()
  }
}
