import {PureComponent} from 'react';
import {
  IRow,
  IColumn,
  IGroupRow,
  getValue,
  isGroupRow
}                              from '../models/GridTypes';
import * as React              from 'react';
import ResizeObserver          from 'resize-observer-polyfill';
import cc                      from 'classcat';
import classNames              from 'classnames';
import Color                   from 'color';
import {Observe}               from 'rewire-core';
import {Theme}                 from '@material-ui/core/styles';
import {WithStyle, withStyles} from 'rewire-ui';

export interface IRowProps {
  row              : IRow;
  columns          : IColumn[];
  Cell             : React.ComponentClass<any>;
  rowElements?     : {[s: string]: HTMLTableRowElement};
  fixedRowElements?: {[s: string]: HTMLTableRowElement};
  isFixedRow?      : boolean;
  index            : number;
  visibleColumns   : number;
  className?       : string;
}

const styles = (theme: Theme) => {
  let color = theme.palette.groupRowBackground.main;

  let styleObj = {
    group: {
      fontSize: theme.fontSizes.groupRow,
      lineHeight: `calc(1.3 * ${theme.fontSizes.groupRow})`,
      '&:before': {
        color: Color(color).darken(.45).string(),
      },
    },
    notVisible: {
      visibility: 'collapse',

    },
    visible: {
      visibility: 'visible',
    },
  };

  for (let i = 0; i < 7; i++) {
    styleObj[`groupLevel${i}`] = {
      backgroundColor:   Color(color).lighten(i * 0.12).string(),
      borderBottomColor: `${Color(color).lighten(i * 0.12).darken(.15).string()} !important`,
    };
  }

  return styleObj;
};

type RowProps = WithStyle<ReturnType<typeof styles>, IRowProps>;

const Row = withStyles(styles, class extends PureComponent<RowProps, {}> {
  element: HTMLTableRowElement;
  elementResizeObserver: any;

  constructor(props: RowProps) {
    super(props);
    let row = props.row;
    Object.keys(row.cells).forEach(columnName => {
      let value = row.cells[columnName].value;
      if (typeof value === 'object') {
        row.data[columnName] = value.clone ? value.clone() : Object.assign({}, value);
      } else {
        row.data[columnName] = value;
      }
    });
  }

  componentWillUnmount() {
    if (!this.element || isGroupRow(this.props.row)) {
      return;
    }

    let rElements = this.props.isFixedRow ? this.props.fixedRowElements : this.props.rowElements;
    if (rElements) {
      delete rElements[this.props.row.id];
    }

    if (!this.props.isFixedRow && this.elementResizeObserver) {
      this.elementResizeObserver.disconnect();
      delete this.elementResizeObserver;
    }
  }

  componentDidMount() {
    if (!this.element || this.props.isFixedRow || isGroupRow(this.props.row)) {
      return;
    }

    this.elementResizeObserver = new ResizeObserver(elements => {
      for (let element of elements) {
        let fixedRowElement = this.props.fixedRowElements && this.props.fixedRowElements[this.props.row.id];
        if (fixedRowElement) {
          fixedRowElement.style.height = element.contentRect.height + 'px';
        }
      }
    });
    this.elementResizeObserver.observe(this.element);
  }

  handleRowClick = () => {
    // this.props.row.grid.selectRows([this.props.row]);
  }

  handleGroupRowClick = (groupRow: IGroupRow) => () => {
    groupRow.expanded = !groupRow.expanded;
    this.groupRowExpansion(groupRow, groupRow.expanded);
  }

  groupRowExpansion(groupRow: IGroupRow, expanded: boolean) {
    groupRow.rows.forEach(row => {
      row.visible = expanded;
      if (isGroupRow(row)) {
        this.groupRowExpansion(row, row.expanded && row.visible);
      } else {
        // while cell row bug exists, need to do this.
        row.cellsByColumnPosition.forEach(cell => {
          cell.row.visible = expanded;
        });
      }
    });
  }

  renderCells = () => {
    if (!this.props.row.cells) return [];

    let cells: JSX.Element[] = [];
    this.props.columns.forEach((column) => {
      let cell = this.props.row.cells[column.name];
      let Cell = this.props.Cell;
      if ((cell.colSpan ===  0) || (cell.rowSpan === 0)) return;
        cells.push(<Cell key={cell.id} cell={cell} />);
    });
    return cells;
  }

  renderRow() {
    let className = cc([this.props.className, {selected: this.props.row.selected}, this.props.row.cls, 'tabrow']);
    className     = classNames(className, this.props.row.visible ? this.props.classes.visible : this.props.classes.notVisible + ' notVisible');

    let ref: ((node: any) => any) | undefined = undefined;
    let rElements = this.props.isFixedRow ? this.props.fixedRowElements : this.props.rowElements;
    if (rElements) {
      ref = (rowElement: any) => {
        this.element = rowElement;
        rElements![this.props.row.id] = rowElement;
      };
    }

    return (
      <tr className={className} ref={ref} onClick={this.handleRowClick}>
        {this.renderCells()}
      </tr>
    );
  }

  renderChildRows(groupRow: IGroupRow): React.ReactNode[] | null {
    // if (!groupRow.expanded) return null;

    return groupRow.rows.map((r, idx) => <Row key={r.id} row={r} rowElements={this.props.rowElements} fixedRowElements={this.props.fixedRowElements} columns={this.props.columns} index={idx} Cell={this.props.Cell} isFixedRow={this.props.isFixedRow} className={((idx % 2) === 1) ? 'alt' : ''} visibleColumns={this.props.visibleColumns} />);
  }

  renderGroupRow(groupRow: IGroupRow) {
    let value: JSX.Element | string | undefined;
    let className: any[] = ['group', 'level-' + groupRow.level];
    if (groupRow.grid.dataColumns === this.props.columns && (groupRow.grid.fixedColumns.length > 0)) {
      value = <span>&nbsp;</span>;
    } else {
      className.push({expanded: groupRow.expanded, collapsed: !groupRow.expanded});
      value = getValue(groupRow, groupRow.column);
    }

    return (
      < >
        <tr style={{visibility: groupRow.visible ? 'visible' : 'collapse'}}>
          <td colSpan={this.props.visibleColumns} className={classNames(cc(className), this.props.classes.group, this.props.classes[`groupLevel${groupRow.level}`])} onClick={this.handleGroupRowClick(groupRow)}>
            <div><span>{value}</span></div>
          </td>
        </tr>
        {this.renderChildRows(groupRow)}
      </>
    );
  }

  render() {
    return <Observe render={() => isGroupRow(this.props.row) ? this.renderGroupRow(this.props.row) : this.renderRow()} />;
  }
});

export default Row;
