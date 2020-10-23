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

import { v4 as uuidv4 } from 'uuid'
import { boolDefault } from '@looker/sdk-rtl/lib/browser'
import { SheetValues } from './SheetSDK'

export const noDate = new Date(-8640000000000000)

/** Signifies an empty cell */
export const nilCell = '\0'

export const addMinutes = (date: Date, minutes: number) => {
  return new Date(date.getTime() + minutes * 60000)
}

/** Convert a value to the string representation for a cell value */
export const stringer = (value: any) => {
  if (value === undefined || value === null) return nilCell
  if (value instanceof Date) {
    if (value === noDate) return nilCell
    return value.toISOString()
  }
  return value.toString()
}

/** Key/value pairs for tab data */
export type RowValues = Record<string, any>

/** Sheet (tab) column header definition */
export type ColumnHeaders = string[]

/** name of the property that tracks the row's position in the tab sheet */
export const rowPosition = '_row'

export interface IRowValidationError {
  message: string
  type: 'error'
}

export type RowValidationErrors = Record<string, IRowValidationError>

export enum RowAction {
  None,
  Create,
  Update,
  Delete,
}

/** Keyed data for a sheet row */
export interface IRowModel extends RowValues {
  /** Row position in sheet for this item. Usually assigned in WhollySheet processing */
  _row: number
  /** Unique ID for this row. Assigned to a UUID in prepare() */
  _id: string
  /** Updated date/time stamp for this row. Always set in prepare() */
  _updated: Date
  /** Batch update action. Defaults to RowAction.None, so the row is not part of the delta */
  $action: RowAction
  assign(values: any): IRowModel
  /** All keys for this object */
  keys(): ColumnHeaders
  /** The sheet Column Headers keys for this model */
  header(): ColumnHeaders
  /** The display columh headers for this model */
  displayHeader(): ColumnHeaders
  /** Column values for the entire row to write to the GSheet */
  values(): SheetValues
  /** Prepare the row for saving */
  prepare(): IRowModel
  /** Returns undefined if no errors, or the error messages */
  validate(): RowValidationErrors | undefined
  /** Convert a cell to the right type */
  typeCast(key: string, value: any): any
  /** Converts instance to plain javascript object */
  toObject(): object
  /** Converts from plain javascript object to class instance */
  fromObject(obj: object): IRowModel
  /** Mark a row for update. Returns true if the row can be marked for updating */
  setUpdate(): boolean
  /** Mark a row for deletion. Returns true if the row can be marked for deleting */
  setDelete(): boolean
  /** Mark a row for creation. Returns true if the row can be marked for creating */
  setCreate(): boolean
}

export class RowModel<T extends IRowModel> implements IRowModel {
  _row = 0
  _id = ''
  _updated: Date = noDate
  private $_action: RowAction = RowAction.None

  constructor(values?: any) {
    if (values && !Array.isArray(values) && Object.keys(values).length > 0) {
      if (values._row) this._row = values._row
      if (values._id) this._id = values._id
      if (values._updated)
        this._updated = this.typeCast('_updated', values._updated)
    }
  }

  get $action(): RowAction {
    if (this.$_action === RowAction.None && this._row === 0)
      return RowAction.Create
    return this.$_action
  }

  set $action(value: RowAction) {
    // Can't create an existing row
    if (value === RowAction.Create && this._row) return
    // Can't update or delete a new row
    if (value !== RowAction.None && !this._row) return
    this.$_action = value
  }

  setCreate(): boolean {
    if (this._row) return false
    this.$_action = RowAction.Create
    return true
  }

  setUpdate(): boolean {
    if (!this._row) return false
    this.$_action = RowAction.Update
    return true
  }

  setDelete(): boolean {
    if (!this._row) return false
    this.$_action = RowAction.Delete
    return true
  }

  keys(): ColumnHeaders {
    return Object.keys(this)
  }

  header(): ColumnHeaders {
    // remove `row`
    return this.keys()
      .slice(1)
      .filter((v) => !v.startsWith('$'))
  }

  displayHeader(): ColumnHeaders {
    // remove `row`
    return this.header().filter((v) => !v.startsWith('_'))
  }

  prepare(): T {
    if (!this._id) {
      // Generate id if not assigned
      this._id = uuidv4()
    }
    /** Always update the "updated" value before saving */
    this._updated = new Date()
    return (this as unknown) as T
  }

  values() {
    const result: SheetValues = []
    const keys = this.header()
    keys.forEach((key) => {
      result.push(stringer(this[key]))
    })
    return result
  }

  typeCast(key: string, value: any) {
    if (value === undefined || value === null) value = ''
    if (typeof this[key] === 'string') {
      return value.toString()
    }
    if (typeof this[key] === 'number') {
      if (value === '') return 0
      const isInt = /^([+-]?[1-9]\d*|0)$/
      if (value.toString().match(isInt)) {
        return parseInt(value, 10)
      }
      return parseFloat(value)
    }
    if (typeof this[key] === 'boolean') {
      return boolDefault(value, false)
    }
    if (this[key] instanceof Date) {
      if (value) return new Date(value)
      return noDate
    }
    if (Array.isArray(this[key])) {
      if (!value) return []
      return value.toString().split(',')
    }
    return this.toString()
  }

  assign(values: any): T {
    if (values) {
      const keys = this.header()
      if (Array.isArray(values)) {
        // Assign by position
        values.forEach((val, index) => {
          if (val !== undefined && val !== null) {
            const key = keys[index]
            this[key] = this.typeCast(key, val)
          }
        })
      } else {
        // Assign by name
        Object.entries(values).forEach(([key, val]) => {
          if (key in this) {
            this[key] = this.typeCast(key, val)
          }
        })
      }
    }
    return (this as unknown) as T
  }

  /** default to no errors */
  validate(): RowValidationErrors | undefined {
    return undefined
  }

  toObject(): object {
    return { ...this }
  }

  fromObject(obj: object): IRowModel {
    return this.assign(obj)
  }
}

// TODO figure out the Typescript magic for this to work
export type RowModelFactory<T extends IRowModel> = { new (values?: any): T }

// export const RowModelCreator: RowModelFactory<IRowModel> = (values?: any) =>
//   new RowModel(values)
