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
import { ITabTable } from '@looker/wholly-sheet'
import { Projects, SheetData } from '../../models'
import { ProjectAction, Actions } from './actions'

// This is the first cut for state and to be honest I dont like it.
// It will likely change
export interface ProjectsState {
  projects: Projects
  currentProjects: Projects
  projectsLoaded: boolean
}

const EmptyProjects = new Projects(
  {} as SheetData,
  { rows: [], header: [] } as ITabTable
)

const defaultState: Readonly<ProjectsState> = Object.freeze({
  projects: EmptyProjects,
  currentProjects: EmptyProjects,
  projectsLoaded: false,
})

export const projectsReducer = (
  state: ProjectsState = defaultState,
  action: ProjectAction
): ProjectsState => {
  switch (action.type) {
    case Actions.ALL_PROJECTS_SUCCESS:
      return {
        ...state,
        projects: action.payload,
        projectsLoaded: true,
      }
    case Actions.CURRENT_PROJECTS_SUCCESS:
      return {
        ...state,
        currentProjects: action.payload,
        projectsLoaded: true,
      }
    case Actions.DELETE_PROJECT:
      return {
        ...state,
      }
    default:
      return state
  }
}
