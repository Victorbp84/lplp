import * as React from 'react'
import classNames from 'classnames'
import {
  UserAutocompletionProvider,
  AutocompletingInput,
  IUserHit,
} from '../autocompletion'
import { IAuthor } from '../../models/author'
import { getLegacyStealthEmailForUser } from '../../lib/email'

interface IAuthorInputProps {
  /**
   * An optional class name for the wrapper element around the
   * author input component
   */
  readonly className?: string

  /**
   * The user autocomplete provider to use when searching for substring
   * matches while autocompleting.
   */
  readonly autoCompleteProvider: UserAutocompletionProvider

  /**
   * The list of authors to fill the input with initially. If this
   * prop changes from what's propagated through onAuthorsUpdated
   * while the component is mounted it will reset, loosing
   * any text that has not yet been resolved to an author.
   */
  readonly authors: ReadonlyArray<IAuthor>

  /**
   * A method called when authors has been added or removed from the
   * input field.
   */
  readonly onAuthorsUpdated: (authors: ReadonlyArray<IAuthor>) => void

  /**
   * Whether or not the input should be read-only and styled as being
   * disabled. When disabled the component will not accept focus.
   */
  readonly disabled: boolean
}

/**
 * Comparison method for use in sorting lists of markers in ascending
 * order of start positions.
 */
// function orderByPosition(x: ActualTextMarker, y: ActualTextMarker) {
//   const xPos = x.find()
//   const yPos = y.find()

//   if (xPos === undefined || yPos === undefined) {
//     return compare(xPos, yPos)
//   }

//   return compare(xPos.from, yPos.from)
// }

/**
 * Returns an email address which can be used on the host side to
 * look up the user which is to be given attribution.
 *
 * If the user has a public email address specified in their profile
 * that's used and if they don't then we'll generate a stealth email
 * address.
 */
function getEmailAddressForUser(user: IUserHit) {
  return user.email && user.email.length > 0
    ? user.email
    : getLegacyStealthEmailForUser(user.username, user.endpoint)
}

// function getDisplayTextForAuthor(author: IAuthor) {
//   return author.username === null ? author.name : `@${author.username}`
// }

/**
 * Convert a IUserHit object which is returned from
 * user-autocomplete-provider into an IAuthor object.
 *
 * If the IUserHit object lacks an email address we'll
 * attempt to create a stealth email address.
 */
function authorFromUserHit(user: IUserHit): IAuthor {
  return {
    name: user.name || user.username,
    email: getEmailAddressForUser(user),
    username: user.username,
  }
}

/**
 * Autocompletable input field for possible authors of a commit.
 *
 * Intended primarily for co-authors but written in a general enough
 * fashion to deal only with authors in general.
 */
export class AuthorInput extends React.Component<IAuthorInputProps> {
  /**
   * The internal list of authors. Note that codemirror
   * ultimately is the source of truth for what authors
   * are in here but we synchronize that into this field
   * whenever codemirror reports a change. We also use
   * this array to detect whether the author props have
   * change, in which case we blow away everything and
   * start from scratch.
   */
  // private authors: ReadonlyArray<IAuthor> = []

  // For undo association
  // private readonly markAuthorMap = new Map<ActualTextMarker, IAuthor>()
  // private readonly authorMarkMap = new Map<IAuthor, ActualTextMarker>()

  private autocompletingInputRef =
    React.createRef<AutocompletingInput<IUserHit>>()
  private shadowInputRef = React.createRef<HTMLDivElement>()
  private inputRef: HTMLInputElement | null = null

  public constructor(props: IAuthorInputProps) {
    super(props)
  }

  public focus() {
    this.autocompletingInputRef.current?.focus()
  }

  public render() {
    // const authors = this.props.authors.map(getDisplayTextForAuthor)
    // const ariaLabel = `Co-Authors: ${authors.join(', ')}`

    const className = classNames(
      'author-input-component',
      this.props.className,
      {
        disabled: this.props.disabled,
      }
    )

    return (
      <div className={className}>
        <div className="label">Co-Authors&nbsp;</div>
        <div className="shadow-input" ref={this.shadowInputRef} />
        {this.renderAuthors()}
        <AutocompletingInput<IUserHit>
          // className={descriptionClassName}
          placeholder="@username"
          // value={this.state.description || ''}
          autocompletionProviders={[this.props.autoCompleteProvider]}
          ref={this.autocompletingInputRef}
          onElementRef={this.onInputRef}
          onAutocompleteItemSelected={this.onAutocompleteItemSelected}
          onValueChanged={this.onCoAuthorsValueChanged}
          // onContextMenu={this.onAutocompletingInputContextMenu}
          // disabled={this.props.isCommitting === true}
          // spellcheck={this.props.commitSpellcheckEnabled}
        />
      </div>
    )
  }

  private onCoAuthorsValueChanged = (value: string) => {
    // Set the value to the shadow input div and then measure its width
    // to set the width of the input field.
    if (this.shadowInputRef.current === null || this.inputRef === null) {
      return
    }
    this.shadowInputRef.current.textContent = value
    const valueWidth = this.shadowInputRef.current.clientWidth
    this.shadowInputRef.current.textContent = this.inputRef.placeholder
    const placeholderWidth = this.shadowInputRef.current.clientWidth
    this.inputRef.style.width = `${Math.max(valueWidth, placeholderWidth)}px`
  }

  private onInputRef = (input: HTMLInputElement | null) => {
    if (input === null) {
      return
    }

    this.inputRef = input
  }

  private onAutocompleteItemSelected = (item: IUserHit) => {
    this.props.onAuthorsUpdated([
      ...this.props.authors,
      authorFromUserHit(item),
    ])

    if (this.inputRef !== null) {
      this.inputRef.value = ''
      this.onCoAuthorsValueChanged('')
    }
  }

  private renderAuthors() {
    return this.props.authors.map((author, index) => {
      return (
        <div key={index} className="handle">
          @{author.username}
        </div>
      )
    })
  }
}
