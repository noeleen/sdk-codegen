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
import { omit } from 'lodash'
import { DefaultSettings } from '@looker/sdk-rtl/lib/browser'
import { ITabTable, SheetSDK } from '@looker/wholly-sheet'
import { getExtensionSDK } from '@looker/extension-sdk'
import { getCore40SDK } from '@looker/extension-sdk-react'
import { initActiveSheet, SheetData } from '../models/SheetData'
import { GAuthSession } from '../authToken/gAuthSession'
import {
  Hacker,
  Project,
  Projects,
  Hackers,
  IProjectProps,
  IHackerProps,
  IHackathonProps,
  IJudgingProps,
  IRegistrationProps,
  ITechnologyProps,
  sheetHeader,
  Judging,
} from '../models'
import { ExtensionProxyTransport } from '../authToken/extensionProxyTransport'
import { ProjectsHeadings, HackersHeadings, JudgingsHeadings } from './types'

/**
 * Client to wholly sheets data.
 *
 * Wholly sheets deals with classes of data but has the ability to convert
 * the classes into and from javascript objects. The redux store only wants to
 * deal with json objects. The redux sagas use this class to get javascript
 * objects from wholly sheets classes and to update wholly sheets classes
 * with javascript object data.
 *
 * Important. DO NOT LEAK THE WHOLLY SHEETS CLASSES!!!!
 * Always convert to or from javascript objects.
 */
class SheetsClient {
  private sheetData?: SheetData
  private hackers?: Hackers
  private hacker?: IHackerProps

  async getProjects(): Promise<IProjectProps[]> {
    const projects = await this.getSheetProjects(true)
    return this.decorateProjectObjects(projects.toObject(), projects.rows)
  }

  async getCurrentProjects(hackathonId?: string): Promise<IProjectProps[]> {
    const data = await this.getSheetData()
    await data.projects.refresh()
    const hackathon = await this.getSheetHackathon(hackathonId)
    const rows = data.projects.filterBy(hackathon)
    // Create a projects object from the filtered rows
    const result = new Projects(data, {
      header: data.projects.header,
      rows: rows,
    } as ITabTable)
    return this.decorateProjectObjects(result.toObject(), rows)
  }

  async createProject(hacker_id: string, projectProps: IProjectProps) {
    projectProps.date_created = new Date()
    projectProps._user_id = hacker_id
    const projects = await this.getSheetProjects()
    const project = new Project()
    project.fromObject(projectProps)
    await projects.save(project)
  }

  async updateProject(
    projectProps: IProjectProps,
    addedJudges: IHackerProps[],
    deletedJudges: IHackerProps[]
  ) {
    const data = await this.getSheetData()
    const projects = data.projects
    const project = projects.find(projectProps._id, '_id')
    if (project) {
      // TODO fromObject does not like this
      const projProps = omit(projectProps, [
        '$judges',
        '$judge_count',
        '$members',
        '$team_count',
      ])
      deletedJudges.forEach((judge) => {
        const hackerJudge = this.hackers?.judges.find(
          (availableJudge) => availableJudge.user.id === judge.user.id
        )
        if (hackerJudge) {
          project.deleteJudge(hackerJudge)
        }
      })
      addedJudges.forEach((judge) => {
        const hackerJudge = this.hackers?.judges.find(
          (availableJudge) => availableJudge.user.id === judge.user.id
        )
        if (hackerJudge) {
          project.addJudge(hackerJudge)
        }
      })
      // TODO fromObject messes up $judging which is why judge updates are done first.
      // For the moment self correcting as the prohects are refreshed
      project.fromObject(projProps)
      await projects.update(project)
    } else {
      throw new Error(`project not found for ${projectProps._id}`)
    }
  }

  async deleteProject(projectId: String) {
    const projects = await this.getSheetProjects()
    const project = projects.find(projectId, '_id')
    if (project) {
      await projects.delete(project)
    } else {
      throw new Error(`project not found for ${projectId}`)
    }
  }

  async lockProjects(
    lock: boolean,
    hackathonId?: string
  ): Promise<IProjectProps[]> {
    const projects = await this.getSheetProjects()
    const hackathon = await this.getSheetHackathon(hackathonId)
    if (hackathon) {
      await projects.lock(hackathon, lock)
      return await this.getCurrentProjects(hackathonId)
    } else {
      throw new Error(this.getHackathodErrorMessage(hackathonId))
    }
  }

  async getCurrentHackathon(): Promise<IHackathonProps> {
    const hackathon = await this.getSheetHackathon()
    if (hackathon) {
      return hackathon.toObject()
    } else {
      throw new Error(this.getHackathodErrorMessage())
    }
  }

  async getJudgings(hackathonId?: string): Promise<IJudgingProps[]> {
    const hackathon = await this.getSheetHackathon(hackathonId)
    if (hackathon) {
      const data = await this.getSheetData()
      await data.judgings.refresh()
      let judgings = data.judgings.filterBy(hackathon).map((j) => j.toObject())
      const hacker = await this.getHacker()
      if (!hacker.canAdmin) {
        if (hacker.canJudge) {
          judgings = judgings.filter((j) => j.user_id === hacker.id)
        } else {
          judgings = []
        }
      }
      return judgings
    } else {
      throw new Error(this.getHackathodErrorMessage(hackathonId))
    }
  }

  async saveJudging(judgingProps: IJudgingProps) {
    const data = await this.getSheetData()
    const judging = data.judgings.find(judgingProps._id, '_id')
    if (judging) {
      judging.fromObject(judgingProps)
      await data.judgings.save(judging)
    } else {
      throw new Error(`judging not found for ${judgingProps._id}`)
    }
  }

  async getHacker(): Promise<IHackerProps> {
    if (!this.hacker) {
      const data = await this.getSheetData()
      await this.loadHackers(data)
      const lookerSdk = getCore40SDK()
      const hacker = new Hacker(lookerSdk)
      await hacker.getMe()
      // TODO revisit this with JK
      const me = this.hackers?.rows.find(
        (maybeMe) => maybeMe.user.id === hacker.user.id
      )
      this.hacker = me
        ? this.decorateHacker(me.toObject())
        : this.decorateHacker(hacker.toObject())
    }
    return this.hacker
  }

  async getHackers(): Promise<{
    hackers: IHackerProps[]
    judges: IHackerProps[]
    admins: IHackerProps[]
    staff: IHackerProps[]
  }> {
    const hackers =
      this.hackers?.users?.map((hacker) =>
        this.decorateHacker(hacker.toObject())
      ) || []
    const judges =
      this.hackers?.judges?.map((hacker) =>
        this.decorateHacker(hacker.toObject())
      ) || []
    const admins =
      this.hackers?.admins?.map((hacker) =>
        this.decorateHacker(hacker.toObject())
      ) || []
    const staff =
      this.hackers?.staff?.map((hacker) =>
        this.decorateHacker(hacker.toObject())
      ) || []
    return { hackers, judges, admins, staff }
  }

  async registerUser(
    user: Hacker,
    hackathonId?: string
  ): Promise<IRegistrationProps> {
    const hackathon = await this.getSheetHackathon(hackathonId)
    if (hackathon) {
      const data = await this.getSheetData()
      const registration = await data.registerUser(hackathon, user)
      return registration.toObject()
    } else {
      throw new Error(this.getHackathodErrorMessage(hackathonId))
    }
  }

  async getTechnologies(): Promise<ITechnologyProps[]> {
    const data = await this.getSheetData()
    if (!data.technologies || data.technologies.rows.length < 1) {
      await data.technologies.refresh()
    }
    return data.technologies.toObject()
  }

  async changeMembership(projectId: string, hackerId: string, leave: boolean) {
    const projects = await this.getSheetProjects()
    const project = projects.find(projectId, '_id')
    if (project) {
      // TODO for some reason hacker id not populated. Verify with JK
      // TODO originally used users but ended using rows in order to add myself
      const hacker = this.hackers!.rows.find(
        (hacker) => String(hacker.user.id) === hackerId
      )
      if (hacker) {
        if (leave) {
          await project.leave(hacker)
        } else {
          await project.join(hacker)
        }
      } else {
        throw new Error(`hacker not found for ${hackerId}`)
      }
    } else {
      throw new Error(`project not found for ${projectId}`)
    }
  }

  getProjectsHeadings(): ProjectsHeadings {
    const headers = [
      'locked',
      'contestant',
      'title',
      'description',
      'project_type',
      'technologies',
      '$team_count',
      '$judge_count',
    ]
    const template = new Project()
    return sheetHeader(headers, template)
  }

  getHackersHeadings(): HackersHeadings {
    const template = new Hacker()
    const lookerSdk = getCore40SDK()
    const hackersContainer = new Hackers(lookerSdk)
    const headers = hackersContainer.displayHeaders
    return sheetHeader(headers, template)
  }

  getJudgingsHeadings(): JudgingsHeadings {
    const headers = [
      '$judge_name',
      '$title',
      'execution',
      'ambition',
      'coolness',
      'impact',
      'score',
      'notes',
    ]
    const template = new Judging()
    return sheetHeader(headers, template)
  }

  private async getSheetProjects(refresh = false) {
    const data = await this.getSheetData()
    if (refresh) {
      await data.projects.refresh()
    }
    return data.projects
  }

  private async getSheetHackathon(hackathonId?: string) {
    if (hackathonId) {
      const hackathons = await this.getSheetHackathons()
      return await hackathons.find(hackathonId, '_id')
    } else {
      const data = this.getSheetData()
      return await (await data).currentHackathon
    }
  }

  private async getSheetHackathons() {
    const data = await this.getSheetData()
    return data.hackathons
  }

  private getHackathodErrorMessage(hackathonId?: string) {
    return hackathonId
      ? `hackathon not found for ${hackathonId}`
      : 'current hackathon not found'
  }

  private async getSheetData(): Promise<SheetData> {
    if (this.sheetData) return this.sheetData
    // Values required
    const extSDK = getExtensionSDK()
    const tokenServerUrl =
      (await extSDK.userAttributeGetItem('token_server_url')) || ''
    const sheetId = (await extSDK.userAttributeGetItem('sheet_id')) || ''

    const options = {
      ...DefaultSettings(),
      ...{ base_url: tokenServerUrl },
    }

    const transport = new ExtensionProxyTransport(extSDK, options)
    const gSession = new GAuthSession(extSDK, options, transport)
    const sheetSDK = new SheetSDK(gSession, sheetId)
    const doc = await sheetSDK.index()
    this.sheetData = initActiveSheet(sheetSDK, doc)
    return this.sheetData
  }

  private async loadHackers(data: SheetData) {
    if (!this.hackers) {
      const lookerSdk = getCore40SDK()
      const foo = new Hackers(lookerSdk)
      this.hackers = await foo.load(data)
    }
  }

  /**
   * Temporary method that adds missing data.
   * @param projectPropsList
   */
  private decorateProjectObjects(
    projectPropsList: IProjectProps[],
    projects: Project[]
  ): IProjectProps[] {
    return projectPropsList.map((projectProps, index) => {
      projects[index].load()
      if (!projectProps.$judges) {
        projectProps.$judges = projects[index].$judges
      }
      if (!projectProps.$judge_count) {
        projectProps.$judge_count = projects[index].$judge_count
      }
      if (!projectProps.$members) {
        projectProps.$members = projects[index].$members
      }
      if (!projectProps.$team_count) {
        projectProps.$team_count = projectProps.$members.length
      }
      return projectProps
    })
  }

  private decorateHacker(hackerProps: IHackerProps): IHackerProps {
    if (hackerProps.id === undefined) {
      hackerProps.id = String(hackerProps.user.id)
    }
    if (hackerProps.firstName === undefined) {
      hackerProps.firstName = hackerProps.user.first_name!
    }
    if (hackerProps.firstName === undefined) {
      hackerProps.lastName = hackerProps.user.last_name!
    }
    if (hackerProps.name === undefined) {
      hackerProps.name = hackerProps.user.display_name!
    }
    if (hackerProps.registered === undefined) {
      hackerProps.registered = hackerProps.registration.date_registered
    }
    if (hackerProps.attended === undefined) {
      hackerProps.attended = hackerProps.registration.attended
    }
    return hackerProps
  }
}

export const sheetsClient = new SheetsClient()