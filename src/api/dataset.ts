import { get } from './index'

export interface Label {
  id: string;
  name: string;
  type: string;
  color: string;
}

export interface Dataset {
  id: string;
  name: string;
  dimensions: [number, number, number];
}

// 查询已有的数据集
export function getDatasets (server: string): Promise<Dataset> {
  return get(server, '/datasets')
}
