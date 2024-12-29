import type { Rule } from './builtin-rules/types'
import { Buffer } from 'node:buffer'
import * as vscode from 'vscode'
import { Configs } from '../config'

export interface RuleBlock extends Rule {
  importance: 'must' | 'should' | 'may' // RFC style importance level
  source?: string // Optional source link
}

// Define meta rule format
const META_RULE_COMMENT = `> @meta-rule
> Rules in this file follow this format:
> @rule <title> | <importance>
> importance: must/should/may (RFC style)
> Example: > @rule KISS | must
@end-meta`

// Rule block comment format
export const BLOCK_COMMENT_START = '> @rule'
export const BLOCK_COMMENT_END = '\n'

// Generate rule block comment
export function generateBlockComment(rule: RuleBlock): string {
  const parts = [rule.title, rule.importance]
  if (rule.source)
    parts.push(rule.source)
  return `${BLOCK_COMMENT_START} ${parts.join(' | ')}${BLOCK_COMMENT_END}`
}

// Parse rule info from comment
export function parseRuleComment(comment: string): Partial<RuleBlock> {
  const content = comment.replace(BLOCK_COMMENT_START, '').trim()
  const [title, importance, source] = content.split('|').map(s => s.trim())
  return {
    title,
    importance: importance as RuleBlock['importance'],
    ...(source ? { source } : {}),
  }
}

// Export ensureMetaRule function
export async function ensureMetaRule(filePath: string): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders
  if (!workspaceFolders)
    return

  try {
    const fileUri = vscode.Uri.file(filePath)
    let content: string

    try {
      const fileContent = await vscode.workspace.fs.readFile(fileUri)
      content = fileContent.toString()
    }
    catch {
      content = `# ${Configs.cursorRules ? 'Cursor Rules' : 'Copilot Instructions'}`
    }

    if (!content.includes('@meta-rule')) {
      const newContent = `${META_RULE_COMMENT}\n\n${content}`
      await vscode.workspace.fs.writeFile(fileUri, Buffer.from(newContent))
    }
  }
  catch (error) {
    console.error('Failed to ensure meta rule:', error)
  }
}

// Parse rule blocks
export function parseRuleBlocks(content: string): { blocks: string[], comments: string[] } {
  const blocks: string[] = []
  const comments: string[] = []

  // Use more precise regex to match rule blocks
  const regex = new RegExp(`${BLOCK_COMMENT_START}([^@\n]+)${BLOCK_COMMENT_END}([^>@\n]+)(?=${BLOCK_COMMENT_START}|$)`, 'g')

  const matches = content.matchAll(regex)
  for (const match of matches) {
    comments.push(match[1].trim())
    blocks.push(match[2].trim())
  }

  return { blocks, comments }
}

// Check if rule block is duplicate
export function isRuleBlockDuplicate(existingContent: string, newBlock: string): boolean {
  const { blocks } = parseRuleBlocks(existingContent)
  return blocks.some(block => block.trim() === newBlock.trim())
}

// Check if rule title is duplicate
export function isRuleTitleDuplicate(existingContent: string, newTitle: string): boolean {
  const { comments } = parseRuleBlocks(existingContent)
  return comments.some((comment) => {
    const ruleInfo = parseRuleComment(comment)
    return ruleInfo.title?.toLowerCase() === newTitle.toLowerCase()
  })
}
