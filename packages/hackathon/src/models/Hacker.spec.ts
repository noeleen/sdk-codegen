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
import path from 'path'
import { LookerNodeSDK } from '@looker/sdk'
import { NodeSettingsIniFile } from '@looker/sdk-rtl'
import { Hacker } from './Hacker'

const iniFile = path.join(__dirname, '../../../../looker.ini')
const settings = new NodeSettingsIniFile(iniFile)
const sdk = LookerNodeSDK.init40(settings)

describe('Hacker', () => {
  test('gets me', async () => {
    const hacker = new Hacker(sdk)
    const me = await hacker.getMe()
    expect(me.user).toBeDefined()
    expect(me.firstName).toBeDefined()
    expect(me.lastName).toBeDefined()
    expect(me.id).toBeDefined()
    expect(me.firstName).toBeDefined()
    expect(me.roles.has('user')).toBeTruthy()
  })
  test('regular user cannot judge, staff, or admin', () => {
    const actual = new Hacker(sdk)
    expect(actual.canAdmin()).toEqual(false)
    expect(actual.canJudge()).toEqual(false)
    expect(actual.canStaff()).toEqual(false)
  })

  test('staff role can staff but not judge or admin', () => {
    const actual = new Hacker(sdk)
    actual.roles.add('staff')
    expect(actual.canAdmin()).toEqual(false)
    expect(actual.canJudge()).toEqual(false)
    expect(actual.canStaff()).toEqual(true)
  })
  test('judge role can judge but not staff or admin', () => {
    const actual = new Hacker(sdk)
    actual.roles.add('judge')
    expect(actual.canAdmin()).toEqual(false)
    expect(actual.canJudge()).toEqual(true)
    expect(actual.canStaff()).toEqual(false)
  })
  test('admin role is god', () => {
    const actual = new Hacker(sdk)
    actual.roles.add('admin')
    expect(actual.canAdmin()).toEqual(true)
    expect(actual.canJudge()).toEqual(true)
    expect(actual.canStaff()).toEqual(true)
  })
})
