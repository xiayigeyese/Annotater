export type Point = [number, number]

// bbox: [xMin, yMin, xMax, yMax]
export function GetBBox (line: Array<Point>): number[] {
  const bbox = [
    Number.MAX_VALUE,
    Number.MAX_VALUE,
    -1,
    -1
  ]
  line.forEach(p => {
    bbox[0] = Math.min(bbox[0], p[0])
    bbox[1] = Math.min(bbox[1], p[1])
    bbox[2] = Math.max(bbox[2], p[0])
    bbox[3] = Math.max(bbox[3], p[1])
  })
  return bbox
}

// 两个bbox合并
export function MergeBBox (bbox1: Array<number>, bbox2: Array<number>): number[] {
  return [
    Math.min(bbox1[0], bbox2[0]),
    Math.min(bbox1[1], bbox2[1]),
    Math.max(bbox1[2], bbox2[2]),
    Math.max(bbox1[3], bbox2[3])
  ]
}

// 计算包围盒面积
function GetBBoxArea (bboxXYXY: Array<number>): number {
  return Math.abs((bboxXYXY[2] - bboxXYXY[0] + 1) * (bboxXYXY[3] - bboxXYXY[1] + 1))
}

// 计算两个包围盒的iou
export function GetBBoxIOU (bbox1: Array<number>, bbox2: Array<number>): number {
  const width = Math.min(bbox1[2], bbox2[2]) - Math.max(bbox1[0], bbox2[0])
  const height = Math.min(bbox1[3], bbox2[3]) - Math.max(bbox1[1], bbox2[1])
  if (width <= 0 || height <= 0) {
    return 0
  }

  const area1 = GetBBoxArea(bbox1)
  const area2 = GetBBoxArea(bbox2)
  const areaI = width * height

  return areaI / (area1 + area2 - areaI)
}

// 判断第一个包围盒是否包含包含第二个包围盒
export function IsOuterBBox (bbox1: Array<number>, bbox2: Array<number>): boolean {
  return bbox1[0] <= bbox2[0] && bbox1[1] <= bbox2[1] && bbox1[2] >= bbox2[2] && bbox1[3] >= bbox2[3]
}

// 判断第一个包围盒是否被第二个包围盒包含
export function IsInnerBBox (bbox1: Array<number>, bbox2: Array<number>): boolean {
  return bbox1[0] >= bbox2[0] && bbox1[1] >= bbox2[1] && bbox1[2] <= bbox2[2] && bbox1[3] <= bbox2[3]
}
