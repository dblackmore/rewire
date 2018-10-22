import * as React              from 'react';
import * as is                 from 'is';
import Downshift, {
  ControllerStateAndHelpers,
  StateChangeOptions }         from 'downshift';
import TextField               from '@material-ui/core/TextField';
import Paper                   from '@material-ui/core/Paper';
import Popper                  from '@material-ui/core/Popper';
import MenuItem                from '@material-ui/core/MenuItem';
import InputAdornment          from '@material-ui/core/InputAdornment';
import {Theme}                 from '@material-ui/core/styles';
import {debounce}              from 'rewire-common';
import {match}                 from 'rewire-common';
import {withStyles, WithStyle} from './styles';
import {
  ICustomProps,
  SearchFn,
  MapFn,
  defaultMap
} from '../models/search';

const styles = (theme: Theme) => ({
  container: {
    flexGrow: 1,
    position: 'relative',
  },
  popper: {
    width: 'auto',
    minWidth: '255px',
    overflowY: 'auto',
    maxHeight: 'calc(50vh - 20px)',
    boxShadow: theme.shadows[7],
    zIndex: 1300,
  },
  paperContainer: {
    position: 'absolute',
    zIndex: 1300,
    width: '100%',
  },
  paper: {
    minWidth: '255px',
    overflowY: 'auto',
    maxHeight: '50vh',
    marginBottom: '10px',
    boxShadow: theme.shadows[7],
  },
  textField: {
    width: '100%',
  },
  inputRoot: {
    lineHeight: 'inherit',
    fontSize: 'inherit',
  },
  formControlRoot: {
  },
  menuItem: {
    fontSize: 'inherit',
    height: 'auto',
    lineHeight: '1em',
  },
});

export type IAutoCompleteProps<T> = WithStyle<ReturnType<typeof styles>, ICustomProps<T> & React.InputHTMLAtrributes<any>>;

class AutoComplete<T> extends React.Component<IAutoCompleteProps<T>, any> {
  state = {suggestions: []};
  downShift: any;
  search   : SearchFn<T>;
  map      : MapFn<T>;

  constructor(props: IAutoCompleteProps<T>) {
    super(props);
    this.search = props.search;
    if (props.debounce) {
      const wait = is.number(props.debounce) ? props.debounce as number : 150;
      this.search = debounce(this.search, wait);
    }
    this.map = props.map || defaultMap;
  }

  performSearch = async (value: string) => {
    const suggestions = await this.search(value, this.props.options);
    this.setState({
      suggestions
    });
  }

  renderInput = (classes: Record<IStyleClasses, string>, error: string | undefined, inputProps: any, InputProps: any, ref: (node: any) => any) => {
    const { label, disabled, autoFocus, value, ...other } = inputProps;
    const { startAdornment, endAdornment, align }         = InputProps;

    return (
      <TextField
        className={classes.textField}
        classes={{root: classes.formControlRoot}}
        value={value}
        label={label}
        error={!disabled && !!error}
        helperText={error}
        inputRef={ref}
        disabled={disabled}
        autoFocus={autoFocus}
        InputProps={{startAdornment: startAdornment, endAdornment: endAdornment, classes: {root: classes.inputRoot}}}
        inputProps={{style: {textAlign: align || 'left'}}}
        {...other}
      />
    );
  }

  html(str: string) {
    if (str && (str.length > 0)) {
      return str.replace(/^\s+|\s+$/gm, '&nbsp;');
    }
    return str;
  }

  parse(searchText: string, value: string): {highlight: boolean, text: string}[] {
    let results: {highlight: boolean, text: string}[] = [];
    if (searchText && searchText.length > 0) {
      let regex = match(searchText);
      let prevIndex = 0;
      for (let i = 0; i < 10; i++) {
        let matches = regex.exec(value);
        if (!matches) {
          break;
        }
        let match: string = matches[0];
        let index = matches.index;
        if (prevIndex < index) {
          results.push({highlight: false, text: this.html(value.substring(prevIndex, index))});
        }
        results.push({highlight: true, text: this.html(match)});
        prevIndex = index + match.length;
      }

      if (prevIndex < value.length) {
        results.push({highlight: false, text: this.html(value.substring(prevIndex, value.length))});
      }
      return results;
    }
    results.push({highlight: false, text: this.html(value)});
    return results;
  }

  renderSuggestion = (params: any) => {
    const { suggestion, index, itemProps, theme, highlightedIndex, inputValue, classes } = params;
    const isHighlighted = highlightedIndex === index;
    const name          = this.map(suggestion);

    if (this.props.renderSuggestion) {
      return (
        <MenuItem selected={isHighlighted} component='div' key={index} className={classes.menuItem}>
          {this.props.renderSuggestion(suggestion, {theme, isHighlighted, inputValue})}
        </MenuItem>
      );
    }

    const parts = this.parse(inputValue, name);

    return (
      <MenuItem
        {...itemProps}
        key={index}
        selected={isHighlighted}
        component='div'
        className={classes.menuItem}
      >{parts.map((part, index) => {
          return part.highlight ? (
            <span key={String(index)} style={{ fontWeight: 700 }} dangerouslySetInnerHTML={{__html: part.text}} />
          ) : (
            <strong key={String(index)} style={{ fontWeight: 300 }} dangerouslySetInnerHTML={{__html: part.text}} />
          );
        })}
      </MenuItem>
    );
  }

  renderSuggestionsContainer = (options: any) => {
    const { getMenuProps, isOpen, suggestionsContainerNode, children, classes, usePopper } = options;
    const menuProps = {
      onKeyPress: this.handleMenuKeyPress,
      onMouseDown: this.handleMenuMouseDown,
      onClick: this.handleMenuClick,
      onDoubleClick: this.handleMenuDoubleClick,
    };

    if (usePopper) {
      return (
        <Popper open={isOpen} placement='bottom-start' anchorEl={suggestionsContainerNode} className={classes.popper}>
          <div {...(isOpen ? getMenuProps({}, {suppressRefError: true}) : {})} {...menuProps}>
            <Paper>
              {children}
            </Paper>
          </div>
        </Popper>
      );
    }

    return (
      isOpen
        ? <div className={classes.paperContainer}>
            <Paper className={classes.paper}>
              {children}
            </Paper>
          </div>
        : undefined
    );
  }

  handleInputChanged = (inputValue: string, helpers: ControllerStateAndHelpers) => {
    if (helpers.isOpen) {
      this.performSearch(inputValue);
    }
  }

  handleItemChanged = (options: StateChangeOptions, helpers: ControllerStateAndHelpers) => {
    if (!options) {
      return;
    }
    if (options.hasOwnProperty('selectedItem')) {
      this.props.onSelectItem(options.selectedItem);
    }
  }

  handleKeyDown = (event: React.KeyboardEvent<any>) => {
    if (event.altKey || event.ctrlKey) {
      return;
    }

    switch (event.keyCode) {
      case 9:
      case 13:
        const state = this.downShift.getState();
        if (state.isOpen) {
          if (!state.inputValue) {
            this.downShift.clearSelection();
            return;
          }
        this.downShift.selectHighlightedItem({
            type: '__autocomplete_keydown_enter__'
          });
        }
        break;
      case 38:
      case 40:
        if (this.state.suggestions.length > 0) {
          event.stopPropagation();
        }
        break;
    }
  }

  handleMenuKeyPress = (event: React.KeyboardEvent<any>) => {
    event.stopPropagation();
    event.preventDefault();
  }

  handleMenuMouseDown = (event: React.MouseEvent<any>) => {
    event.stopPropagation();
    event.preventDefault();
  }

  handleMenuClick = (event: React.MouseEvent<any>) => {
    event.stopPropagation();
    event.preventDefault();
  }

  handleMenuDoubleClick = (event: React.MouseEvent<any>) => {
    event.stopPropagation();
    event.preventDefault();
  }

  componentWillReceiveProps (nextProps: ICustomProps<T>) {
    if (nextProps.selectedItem === undefined && (nextProps.selectedItem !== this.props.selectedItem) && this.downShift) {
      this.downShift.clearSelection();
    }

    if (nextProps.options) {
      if (nextProps.options.parentId !== (this.props.options && this.props.options.parentId)) {
        nextProps.onSelectItem(undefined);
      }
    }
  }

  shouldComponentUpdate(nextProps: ICustomProps<T> & React.InputHTMLAttributes<any>, nextState: any, nextContext: any) {
    return (
        (nextProps.selectedItem !== this.props.selectedItem) ||
        (nextProps.error !== this.props.error) ||
        (nextProps.disabled !== this.props.disabled) ||
        (nextProps.visible !== this.props.visible) ||
        (nextState.suggestions !== this.state.suggestions)
      );
  }

  render() {
    const { classes, theme, disabled, visible, error, label, placeholder, autoFocus, align, usePopper } = this.props;
    if (visible === false) {
      return null;
    }

    let suggestionsContainerNode: HTMLElement;

    const startAdornment = this.props.startAdornment ? <InputAdornment position='start'>{this.props.startAdornment}</InputAdornment> : undefined;
    const endAdornment   = this.props.endAdornment ? <InputAdornment position='end'>{this.props.endAdornment}</InputAdornment> : undefined;

    return (
      <Downshift
        defaultHighlightedIndex={0}
        selectedItem={this.props.selectedItem}
        itemToString={this.map}
        onInputValueChange={this.handleInputChanged}
        onUserAction={this.handleItemChanged}
        ref={(v) => this.downShift = v}
        >
          {({
            getInputProps,
            getItemProps,
            getMenuProps,
            isOpen,
            inputValue,
            selectedItem,
            highlightedIndex,
          }) => (
            <div className={classes.container + ' ' + (this.props.className || '')}>
              {this.renderInput(classes, error,
                getInputProps({
                  disabled: disabled,
                  onKeyDown: this.handleKeyDown,
                  autoFocus: autoFocus,
                  label: label,
                  placeholder: placeholder,
                }),
                {align: align, startAdornment: startAdornment, endAdornment: endAdornment},
                (node => {
                  suggestionsContainerNode = node;
                }),
              )}
              {this.renderSuggestionsContainer({
                getMenuProps: getMenuProps,
                suggestionsContainerNode: suggestionsContainerNode,
                isOpen: isOpen,
                classes: classes,
                usePopper: usePopper,
                children: this.state.suggestions.map((suggestion, index) =>
                  this.renderSuggestion({
                    suggestion,
                    index,
                    inputValue,
                    theme,
                    classes: classes,
                    itemProps: getItemProps({ item: suggestion }),
                    highlightedIndex,
                    selectedItem,
                  }),
                ),
              })}
            </div>
          )}
      </Downshift>
    );
  }
}

export default withStyles(styles, AutoComplete);
