/*

 MIT License

 Copyright (c) 2020 Looker Data Sciences, Inc.

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.

 */

import { ITabTable, SheetError, SheetSDK, SheetValues } from './SheetSDK'

import { ColumnHeaders, IRowModel, stringer } from './RowModel'

/**
 * Compare dates without running into numeric comparison problems
 * @param a first date to compare
 * @param b second date to compare
 * @returns 0 if dates are equal, positive if a > b, negative if a < b
 */
export const compareDates = (a: Date, b: Date) => a.getTime() - b.getTime()

export interface IWhollySheet<T extends IRowModel> {
  /** Initialized REST-based GSheets SDK */
  sheets: SheetSDK
  /** Name of the tab */
  name: string
  /** Header column names for reading/writing to the sheet */
  header: ColumnHeaders
  /** Column names to display */
  displayHeader: ColumnHeaders
  /** Name of the key column that represents the "id" */
  keyColumn: string
  /** All data in the sheet */
  rows: T[]
  /** Keyed row retrieval */
  index: Record<string, T>
  /** What's the next row of the sheet? */
  nextRow: number

  // TODO figure out init generic typing issue
  // init(values?: any): (values?: any) => T

  /**
   * Verify the column order in the sheet matches the key order of the row type
   * @param header array of column names in order
   */
  checkHeader(header: ColumnHeaders): boolean

  /**
   * True if the column name should be displayed in a UI
   *
   * False if it's an "internal" column name
   *
   * @param columnName to check for display
   */
  displayable(columnName: string): boolean

  /**
   * Gets the row's values in table.header column order
   * @param model row to introspect
   */
  values(model: T): SheetValues

  /**
   * Converts raw rows into typed rows.
   * TODO replace with constructor argument
   * @param rows array of data to convert. Either value arrays or keyed collections
   */
  typeRows<T extends IRowModel>(rows: SheetValues): T[]

  /** Reload the entire tab */
  refresh<T extends IRowModel>(): Promise<T[]>

  /**
   * Save the specified row to the sheet.
   *
   * This routine determines whether to call update or create based on whether the row position is < 1
   *
   * @param model row to save
   */
  save<T extends IRowModel>(model: T): Promise<T>

  /**
   * Create a row in the sheet
   *
   * If the row position is > 0 an error is thrown
   *
   * @param model row to create in sheet
   */
  create<T extends IRowModel>(model: T): Promise<T>

  /**
   * Update a row in the sheet
   *
   * If the row position is < 1 an error is thrown
   *
   * If the row is checkOutdated an error is thrown
   *
   * @param model row to create in sheet
   */
  update<T extends IRowModel>(model: T): Promise<T>

  /**
   * Reads the specified row directly from the sheet
   * @param row
   */
  rowGet<T extends IRowModel>(row: number): Promise<T | undefined>

  /**
   * Delete a row if it still exists
   * @param model to delete
   */
  delete<T extends IRowModel>(model: T): Promise<boolean>

  /**
   * If the row is out of date, it throws a SheetError
   * @param model row for status check
   */
  checkOutdated<T extends IRowModel>(model: T): Promise<boolean>

  /**
   * Find the matching row. If columnName is the primary key field, indexed retrieval is used
   *
   * @param value to find
   * @param columnName in which to find the value. Defaults to primary key. If primary key, indexed retrieval is use.
   */
  find(value: any, columnName?: string): T | undefined
}

// https://github.com/gsuitedevs/node-samples/blob/master/sheets/snippets/test/helpers.js

/** CRUDF operations for a GSheet tab */
export abstract class WhollySheet<T extends IRowModel>
  implements IWhollySheet<T> {
  index: Record<string, T> = {}
  rows: T[]

  protected constructor(
    public readonly sheets: SheetSDK,
    /** name of the tab in the GSheet document */
    public readonly name: string,
    public readonly table: ITabTable,
    public readonly keyColumn: string = 'id' // public readonly NewItem: RowModelFactory<T>
  ) {
    this.rows = this.typeRows(table.rows)
    this.checkHeader()
    this.createIndex()
  }

  // Using this until I can figure out the constructor syntax, maybe https://stackoverflow.com/a/43674389
  abstract typeRows<T extends IRowModel>(rows: SheetValues): T[]

  typeRow<T extends IRowModel>(row: SheetValues): T {
    const rows = this.typeRows([row])
    return (rows[0] as unknown) as T
  }

  // // TODO figure out init generic typing issue
  // init(values?: any): T {
  //   const result: T = new this.NewItem(values)
  //   return result
  // }

  /**
   * convert value to the strong type, or undefined if not value
   * @param value to strongly type
   * @private
   */
  private toAT<T extends IRowModel>(value: unknown): T | undefined {
    if (value) return value as T
    return undefined
  }

  checkHeader() {
    // Nothing to check
    if (this.rows.length === 0) return true
    const row = this.rows[0]
    const rowHeader = row.header().join()
    const tableHeader = this.table.header.join()
    if (tableHeader !== rowHeader)
      throw new SheetError(
        `Expected table.header to be ${rowHeader} not ${tableHeader}`
      )
    return true
  }

  get header() {
    return this.table.header
  }

  get nextRow() {
    // +1 for header row
    // +1 for 1-based rows
    return this.rows.length + 2
  }

  private createIndex() {
    this.index = {}
    this.rows.forEach((r) => {
      this.index[r[this.keyColumn]] = r
    })
  }

  values<T extends IRowModel>(model: T) {
    const result: SheetValues = []
    this.header.forEach((h) => {
      result.push(stringer(model[h]))
    })
    return result
  }

  async save<T extends IRowModel>(model: T): Promise<T> {
    // A model with a non-zero row is an update
    if (model.row) return await this.update<T>(model)
    // Create currently returns the row not the model
    return ((await this.create<T>(model)) as unknown) as T
  }

  checkId<T extends IRowModel>(model: T) {
    if (!model[this.keyColumn])
      throw new SheetError(
        `"${this.keyColumn}" must be assigned for row ${model.row}`
      )
  }

  async create<T extends IRowModel>(model: T): Promise<T> {
    if (model.row > 0)
      throw new SheetError(
        `create needs "${model.id}" row to be < 1, not ${model.row}`
      )
    model.prepare()
    this.checkId(model)
    const values = this.values(model)
    const result = await this.sheets.rowCreate(this.name, this.nextRow, values)
    if (result.row < 1 || !result.values || result.values.length === 0)
      throw new SheetError(`Could not create row for ${model[this.keyColumn]}`)
    // This returns an array of values with 1 entry per row value array
    const newRow = this.typeRow(result.values[0])
    newRow.row = result.row
    if (result.row === this.nextRow) {
      // No other rows have been added
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      this.rows.push((newRow as unknown) as T)
      this.createIndex()
    } else {
      await this.refresh()
    }
    return (this.index[newRow[this.keyColumn]] as unknown) as T
  }

  async update<T extends IRowModel>(model: T): Promise<T> {
    this.checkId(model)
    if (!model.row)
      throw new SheetError(`"${model.id}" row must be > 0 to update`)

    await this.checkOutdated(model)
    const rowPos = model.row - 2
    model.prepare()
    const values = this.values(model)
    /** This will throw an error if the request fails */
    const result = await this.sheets.rowUpdate(this.name, model.row, values)
    if (result.values) {
      // This returns an array of values with 1 entry per row value array
      const updateValues = result.values[0]
      this.rows[rowPos].assign(updateValues)
    }
    // ID may have changed?
    this.createIndex()
    return (this.rows[rowPos] as unknown) as T
  }

  find(value: any, columnName?: string): T | undefined {
    if (!value) return undefined
    let key = columnName || this.keyColumn
    if (typeof value === 'number') {
      // Default key to row
      if (!columnName) key = 'row'
    }
    if (columnName === this.keyColumn) {
      // Find by index
      return this.toAT(this.index[value.toString()])
    }
    return this.toAT(this.rows.find((r) => r[key] === value))
  }

  private _displayHeader: ColumnHeaders = []
  get displayHeader(): ColumnHeaders {
    if (this._displayHeader.length === 0) {
      this._displayHeader = this.header.filter((colName) =>
        this.displayable(colName)
      )
    }
    return this._displayHeader
  }

  async delete<T extends IRowModel>(model: T) {
    await this.checkOutdated(model)
    const values = await this.sheets.rowDelete(this.name, model.row)
    this.rows = this.typeRows(values)
    this.createIndex()
    return true
  }

  displayable(columnName: string): boolean {
    return !(columnName.startsWith('_') || columnName.startsWith('$'))
  }

  async rowGet<T extends IRowModel>(row: number): Promise<T | undefined> {
    const values = await this.sheets.rowGet(this.name, row)
    if (!values || values.length === 0) return undefined
    // Returns a nested array of values, 1 top element per row
    const typed = this.typeRow(values[0])
    // ugly hack cheat for type conversion
    return (typed as unknown) as T
  }

  async checkOutdated<T extends IRowModel>(model: T) {
    if (model.row < 1) return false
    const errors: string[] = []
    const fetched = await this.rowGet(model.row)
    if (!fetched) {
      errors.push('Row not found')
    } else {
      if (
        fetched.updated !== undefined &&
        compareDates(fetched.updated, model.updated) !== 0
      )
        errors.push(`update is ${fetched.updated} not ${model.updated}`)
      if (fetched[this.keyColumn] !== model[this.keyColumn])
        errors.push(
          `${this.keyColumn} is "${fetched[this.keyColumn]}" not "${
            model[this.keyColumn]
          }"`
        )
    }
    if (errors.length > 0)
      throw new SheetError(`Row ${model.row} is outdated: ${errors.join()}`)
    return false
  }

  async refresh<T extends IRowModel>(): Promise<T[]> {
    let values = await this.sheets.tabValues(this.name)
    // trim header row
    values = values.slice(1)
    const rows = (this.typeRows(values) as unknown) as T[]
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    this.rows = rows
    this.rows.forEach((r, index) => (r.row = index + 2))
    this.createIndex()
    return rows
  }
}
