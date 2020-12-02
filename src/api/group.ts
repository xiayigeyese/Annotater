import { get, post, deletee, put } from './index'
import { Label } from './dataset'

export type DatasetGroupList = Array<{
  id: string;
  name: string;
}>

export function getGroups (server: string): Promise<DatasetGroupList> {
  return get(server, '/groups')
}

export type DatasetGroup = {
  id: string;
  name: string;
  labels: Array<Label>;
  datasets: Array<{
    id: string;
    name: string;
    dimensions: [number, number, number];
  }>;
}

export function getGroup (server: string, id: string): Promise<DatasetGroup> {
  return get(server, `/groups/${id}`)
}

export function addGroupLabel (server: string, groupId: string, label: Label): Promise<string> {
  return post(server, `/groups/${groupId}/labels`, label)
}

export function removeGroupLabel (server: string, groupId: string, labelId: string): Promise<null> {
  return deletee(server, `/groups/${groupId}/labels/${labelId}`, {})
}

export function updateGroupLabel (server: string, groupId: string, labelId: string, data: Label): Promise<null> {
  return put(server, `/groups/${groupId}/labels/${labelId}`, data)
}
