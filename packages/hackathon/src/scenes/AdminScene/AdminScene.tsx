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
import React, { FC, useEffect } from 'react'
import { TabList, Tab, TabPanels, TabPanel } from '@looker/components'
import { useHistory, useRouteMatch } from 'react-router-dom'
import { Routes } from '../../routes/AppRouter'
import { UserAttributes } from './components/UserAttributes'

const tabnames = ['general', 'userattributes']

const getTabNameIndex = (tabname?: string) => {
  let tabIndex = tabnames.indexOf(tabname || 'general')
  if (tabIndex < 0) {
    tabIndex = 0
  }
  return {
    tabname: tabnames[tabIndex],
    tabIndex,
  }
}

export const AdminScene: FC = () => {
  const history = useHistory()
  const match = useRouteMatch<{ func: string; tabname: string }>(
    '/:func/:tabname'
  )

  useEffect(() => {
    const currentTabname = match?.params?.tabname
    const { tabname } = getTabNameIndex(currentTabname)
    if (tabname !== currentTabname) {
      history.push(`/admin/${tabname}`)
    }
  }, [history, match])

  const onSelectTab = (index: number) => {
    const currentTabname = match?.params?.tabname
    const tabname = tabnames[index]
    if (tabname !== currentTabname) {
      history.push(`${Routes.ADMIN}/${tabname}`)
    }
  }

  const { tabIndex } = getTabNameIndex(match?.params?.tabname)

  return (
    <>
      <TabList selectedIndex={tabIndex} onSelectTab={onSelectTab}>
        <Tab>General</Tab>
        <Tab>User Attributes</Tab>
      </TabList>
      <TabPanels selectedIndex={tabIndex}>
        <TabPanel>
          <div>General admin stuff TBD</div>
        </TabPanel>
        <TabPanel>
          <UserAttributes />
        </TabPanel>
      </TabPanels>
    </>
  )
}