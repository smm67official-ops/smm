import type { ReactNode } from 'react';

export type Column<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  numeric?: boolean;
  width?: string;
};

export type TableProps<T> = {
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  className?: string;
};

export default function Table<T>({ columns, rows, rowKey, empty, className = '' }: TableProps<T>) {
  return (
    <div className={`sv-table-wrap ${className}`.trim()}>
      <div style={{ overflowX: 'auto' }}>
        <table className="sv-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={{ width: column.width, textAlign: column.numeric ? 'end' : undefined }}
                  scope="col"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: 'var(--sv-space-10)' }}>
                  {empty ?? 'No data'}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((column) => (
                    <td key={column.key} className={column.numeric ? 'sv-table__numeric' : undefined}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
