import { git, IGitExecutionOptions, gitNetworkArguments } from './core'
import { Repository } from '../../models/repository'
import { Branch, BranchType } from '../../models/branch'
import { ICheckoutProgress } from '../../models/progress'
import { IGitAccount } from '../../models/git-account'
import {
  CheckoutProgressParser,
  executionOptionsWithProgress,
} from '../progress'
import { AuthenticationErrors } from './authentication'
import { enableRecurseSubmodulesFlag } from '../feature-flag'
import {
  envForRemoteOperation,
  getFallbackUrlForProxyResolve,
} from './environment'
import { WorkingDirectoryFileChange } from '../../models/status'
import { ManualConflictResolution } from '../../models/manual-conflict-resolution'
import { CommitOneLine } from '../../models/commit'

export type ProgressCallback = (progress: ICheckoutProgress) => void

async function getCheckoutArgs(
  repository: Repository,
  branch: Branch,
  account: IGitAccount | null,
  progressCallback?: ProgressCallback
) {
  const baseArgs =
    progressCallback != null
      ? [...gitNetworkArguments(), 'checkout', '--progress']
      : [...gitNetworkArguments(), 'checkout']

  if (enableRecurseSubmodulesFlag()) {
    return branch.type === BranchType.Remote
      ? baseArgs.concat(
          branch.name,
          '-b',
          branch.nameWithoutRemote,
          '--recurse-submodules',
          '--'
        )
      : baseArgs.concat(branch.name, '--recurse-submodules', '--')
  } else {
    return branch.type === BranchType.Remote
      ? baseArgs.concat(branch.name, '-b', branch.nameWithoutRemote, '--')
      : baseArgs.concat(branch.name, '--')
  }
}

/**
 * Check out the given branch.
 *
 * @param repository - The repository in which the branch checkout should
 *                     take place
 *
 * @param branch     - The branch name that should be checked out
 *
 * @param progressCallback - An optional function which will be invoked
 *                           with information about the current progress
 *                           of the checkout operation. When provided this
 *                           enables the '--progress' command line flag for
 *                           'git checkout'.
 */
export async function checkoutBranch(
  repository: Repository,
  account: IGitAccount | null,
  branch: Branch,
  progressCallback?: ProgressCallback
): Promise<true> {
  let opts: IGitExecutionOptions = {
    env: await envForRemoteOperation(
      account,
      getFallbackUrlForProxyResolve(account, repository)
    ),
    expectedErrors: AuthenticationErrors,
  }

  if (progressCallback) {
    const title = `Checking out branch ${branch.name}`
    const kind = 'checkout'
    const target = branch.name

    opts = await executionOptionsWithProgress(
      { ...opts, trackLFSProgress: true },
      new CheckoutProgressParser(),
      progress => {
        if (progress.kind === 'progress') {
          const description = progress.details.text
          const value = progress.percent

          progressCallback({
            kind,
            title,
            description,
            value,
            target,
          })
        }
      }
    )

    // Initial progress
    progressCallback({ kind, title, value: 0, target })
  }

  const args = await getCheckoutArgs(
    repository,
    branch,
    account,
    progressCallback
  )

  await git(args, repository.path, 'checkoutBranch', opts)

  // we return `true` here so `GitStore.performFailableGitOperation`
  // will return _something_ differentiable from `undefined` if this succeeds
  return true
}

/**
 * Check out the given commit.
 * Literally invokes `git checkout <commit SHA>`.
 *
 * @param repository - The repository in which the branch checkout should
 *                     take place
 *
 * @param commit     - The commit that should be checked out
 *
 * @param progressCallback - An optional function which will be invoked
 *                           with information about the current progress
 *                           of the checkout operation. When provided this
 *                           enables the '--progress' command line flag for
 *                           'git checkout'.
 */
export async function checkoutCommit(
  repository: Repository,
  account: IGitAccount | null,
  commit: CommitOneLine,
  progressCallback?: ProgressCallback
): Promise<true> {
  let opts: IGitExecutionOptions = {
    env: await envForRemoteOperation(
      account,
      getFallbackUrlForProxyResolve(account, repository)
    ),
    expectedErrors: AuthenticationErrors,
  }

  if (progressCallback) {
    const title = `Checking out commit ${commit.sha}`
    const kind = 'checkout'
    const target = commit.sha

    opts = await executionOptionsWithProgress(
      { ...opts, trackLFSProgress: true },
      new CheckoutProgressParser(),
      progress => {
        if (progress.kind === 'progress') {
          const description = progress.details.text
          const value = progress.percent

          progressCallback({
            kind,
            title,
            description,
            value,
            target,
          })
        }
      }
    )

    // Initial progress
    progressCallback({ kind, title, value: 0, target })
  }

  const args = ['checkout', commit.sha]

  await git(args, repository.path, 'checkoutCommit', opts)

  // we return `true` here so `GitStore.performFailableGitOperation`
  // will return _something_ differentiable from `undefined` if this succeeds
  return true
}

/** Check out the paths at HEAD. */
export async function checkoutPaths(
  repository: Repository,
  paths: ReadonlyArray<string>
): Promise<void> {
  await git(
    ['checkout', 'HEAD', '--', ...paths],
    repository.path,
    'checkoutPaths'
  )
}

/**
 * Check out either stage #2 (ours) or #3 (theirs) for a conflicted
 * file.
 */
export async function checkoutConflictedFile(
  repository: Repository,
  file: WorkingDirectoryFileChange,
  resolution: ManualConflictResolution
) {
  await git(
    ['checkout', `--${resolution}`, '--', file.path],
    repository.path,
    'checkoutConflictedFile'
  )
}
