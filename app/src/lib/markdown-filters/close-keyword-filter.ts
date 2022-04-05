import { IssueReference } from './issue-mention-filter'
import { INodeFilter, MarkdownContext } from './node-filter'

/** Markdown locations that can have closing keywords */
const IssueClosingContext: ReadonlyArray<MarkdownContext> = [
  'Commit',
  'PullRequest',
]

/** Determines if markdown context could have issue closing mention */
export function isIssueClosingContext(markdownContext: MarkdownContext) {
  return IssueClosingContext.includes(markdownContext)
}

export class CloseKeywordFilter implements INodeFilter {
  /**
   * Searches for the words: close, closes, closed, fix, fixes, fixed, resolve,
   * resolves, resolved
   *
   * Expects one or more spaces at the end to avoid false matches like
   * owner/fixops#1
   */
  private closeText =
    /\b(?<closeText>close[sd]?|fix(e[sd])?|resolve[sd]?)(\s*:?\s+)/i

  private closesWithTextReference = new RegExp(
    this.closeText.source + '(?<issue_reference>' + IssueReference.source + ')',
    'ig'
  )

  public constructor(
    /** The context from which the markdown content originated from - such as a PullRequest or PullRequest Comment */
    private readonly markdownContext: MarkdownContext
  ) {}

  /**
   *  Close keyword filter iterates on all text nodes that are not inside a pre,
   *  code, or anchor tag.
   */
  public createFilterTreeWalker(doc: Document): TreeWalker {
    return doc.createTreeWalker(doc, NodeFilter.SHOW_TEXT, {
      acceptNode: node => {
        return (node.parentNode !== null &&
          ['CODE', 'PRE', 'A'].includes(node.parentNode.nodeName)) ||
          node.textContent === null
          ? NodeFilter.FILTER_SKIP
          : NodeFilter.FILTER_ACCEPT
      },
    })
  }

  public async filter(node: Node): Promise<ReadonlyArray<Node> | null> {
    const text = node.textContent
    if (node.nodeType !== node.TEXT_NODE || text === null) {
      return null
    }

    const matches = [...text.matchAll(this.closesWithTextReference)]
    if (matches.length === 0) {
      return null
    }

    let lastMatchEndingPosition = 0
    const nodes: Array<Text | HTMLSpanElement> = []
    for (const match of matches) {
      if (match.groups === undefined || match.index === undefined) {
        continue
      }
      const { closeText, issue_reference } = match.groups

      const span = this.createTooltipContent(closeText, issue_reference)

      const textBefore = text.slice(lastMatchEndingPosition, match.index)
      nodes.push(document.createTextNode(textBefore))
      nodes.push(span)

      lastMatchEndingPosition = match.index + closeText.length
    }

    const trailingText = text.slice(lastMatchEndingPosition)
    if (trailingText !== '') {
      nodes.push(document.createTextNode(trailingText))
    }

    return nodes
  }

  private createTooltipContent(closesText: string, issueNumber: string) {
    const tooltipSpan = document.createElement('span')
    tooltipSpan.textContent = closesText
    tooltipSpan.classList.add('issue-keyword')
    tooltipSpan.title = `This ${
      this.markdownContext === 'Commit' ? 'commit' : 'pull request'
    } closes issue ${issueNumber}.`
    return tooltipSpan
  }
}
