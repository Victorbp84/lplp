import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { Row } from '../lib/row'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { PullRequest } from '../../models/pull-request'
import { Dispatcher } from '../dispatcher'
import { Account } from '../../models/account'
import { IAPIPullRequestReview } from '../../lib/api'
import { Octicon } from '../octicons'
import { RepositoryWithGitHubRepository } from '../../models/repository'
import { SandboxedMarkdown } from '../lib/sandboxed-markdown'
import { Button } from '../lib/button'
import {
  getPullRequestReviewStateIcon,
  getVerbForPullRequestReview,
} from './pull-request-review-helpers'

interface IPullRequestReviewProps {
  readonly dispatcher: Dispatcher
  readonly accounts: ReadonlyArray<Account>
  readonly repository: RepositoryWithGitHubRepository
  readonly pullRequest: PullRequest
  readonly review: IAPIPullRequestReview

  /** Map from the emoji shortcut (e.g., :+1:) to the image's local path. */
  readonly emoji: Map<string, string>

  /**
   * Whether or not the dialog should offer to switch to the PR's repository or
   * to checkout the PR branch when applicable (e.g. non-approved reviews).
   */
  readonly shouldCheckoutBranch: boolean
  readonly shouldChangeRepository: boolean

  readonly onSubmit: () => void
  readonly onDismissed: () => void
}

interface IPullRequestReviewState {
  readonly switchingToPullRequest: boolean
}

/**
 * Dialog to show the result of a CI check run.
 */
export class PullRequestReview extends React.Component<
  IPullRequestReviewProps,
  IPullRequestReviewState
> {
  public constructor(props: IPullRequestReviewProps) {
    super(props)

    this.state = {
      switchingToPullRequest: false,
    }
  }

  public render() {
    const { review } = this.props

    const { title, pullRequestNumber } = this.props.pullRequest
    const verb = getVerbForPullRequestReview(review)

    const header = (
      <div className="pull-request-review-dialog-header">
        {this.renderReviewIcon()}
        <div className="title-container">
          <div className="summary">
            @{review.user.login} {verb} your pull request
          </div>
          <span className="pr-title">
            <span className="pr-title">{title}</span>{' '}
            <span className="pr-number">#{pullRequestNumber}</span>{' '}
          </span>
        </div>
        {this.renderViewOnGitHubButton()}
      </div>
    )

    return (
      <Dialog
        id="pull-request-review"
        type="normal"
        title={header}
        dismissable={false}
        onSubmit={this.props.onSubmit}
        onDismissed={this.props.onDismissed}
        loading={this.state.switchingToPullRequest}
      >
        <DialogContent>{this.renderReviewBody()}</DialogContent>
        <DialogFooter>{this.renderFooterContent()}</DialogFooter>
      </Dialog>
    )
  }

  private renderFooterContent() {
    const { review, shouldChangeRepository, shouldCheckoutBranch } = this.props
    const isApprovedReview = review.state === 'APPROVED'

    // If the PR was approved, there is no need to switch branches
    const footerQuestion =
      !isApprovedReview && (shouldChangeRepository || shouldCheckoutBranch) ? (
        <div className="footer-question">
          <span>
            Do you want to switch to that Pull Request now and start working on
            the requested changes?
          </span>
        </div>
      ) : null

    let okButtonTitle: undefined | string = undefined

    if (!isApprovedReview) {
      if (shouldChangeRepository) {
        okButtonTitle = __DARWIN__
          ? 'Switch to Repository and Pull Request'
          : 'Switch to repository and pull request'
      } else if (shouldCheckoutBranch) {
        okButtonTitle = __DARWIN__
          ? 'Switch to Pull Request'
          : 'Switch to pull request'
      }
    }

    const okCancelButtonGroup = (
      <OkCancelButtonGroup
        onCancelButtonClick={this.props.onDismissed}
        cancelButtonText="Dismiss"
        okButtonText={okButtonTitle}
        okButtonDisabled={this.state.switchingToPullRequest}
        onOkButtonClick={this.onSubmit}
      />
    )

    return footerQuestion === null ? (
      okCancelButtonGroup
    ) : (
      <Row>
        {footerQuestion}
        {okCancelButtonGroup}
      </Row>
    )
  }

  private onMarkdownLinkClicked = (url: string) => {
    this.props.dispatcher.openInBrowser(url)
  }

  private renderReviewBody() {
    const { review, emoji, pullRequest } = this.props
    const { base } = pullRequest

    if (review.body.length === 0) {
      return null
    }

    return (
      <Row>
        <SandboxedMarkdown
          markdown={review.body}
          emoji={emoji}
          baseHref={base.gitHubRepository.htmlURL}
          repository={base.gitHubRepository}
          onMarkdownLinkClicked={this.onMarkdownLinkClicked}
        />
      </Row>
    )
  }

  private renderReviewIcon = () => {
    const { review } = this.props

    const icon = getPullRequestReviewStateIcon(review.state)
    return <Octicon symbol={icon.symbol} className={icon.className} />
  }

  private renderViewOnGitHubButton = () => {
    return (
      <div className="ci-check-rerun">
        <Button onClick={this.viewOnGitHub}>View on GitHub</Button>
      </div>
    )
  }

  private viewOnGitHub = () => {
    const { dispatcher, review } = this.props
    dispatcher.openInBrowser(review.html_url)
  }

  private onSubmit = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()

    const {
      dispatcher,
      repository,
      pullRequest,
      shouldChangeRepository,
      shouldCheckoutBranch,
      review,
    } = this.props

    const isApprovedReview = review.state === 'APPROVED'

    // Only switch to the PR when needed, if it's not an approved review
    if (!isApprovedReview && (shouldChangeRepository || shouldCheckoutBranch)) {
      this.setState({ switchingToPullRequest: true })
      await dispatcher.selectRepository(repository)
      await dispatcher.checkoutPullRequest(repository, pullRequest)
      this.setState({ switchingToPullRequest: false })
    }

    this.props.onDismissed()
  }
}
