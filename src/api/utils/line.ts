import { Point } from '@/api/utils/bbox'

function SealLine (linePoints: Point[]): void {
  const startP = linePoints[0]
  const endP = linePoints[linePoints.length - 1]
  if (startP[0] !== endP[0] && startP[1] !== endP[1]) {
    linePoints.push([startP[0], startP[1]])
  }
}

function BresenhamLine (point1: Point, point2: Point): Point[] {
  let points: Point[] = []
  let steep = false
  let flag = false
  let tmp = 0
  let [x0, y0] = point1
  let [x1, y1] = point2
  if (Math.abs(x0 - x1) < Math.abs(y0 - y1)) {
    tmp = x0
    x0 = y0
    y0 = tmp
    tmp = x1
    x1 = y1
    y1 = tmp
    steep = true
  }
  if (x0 > x1) {
    tmp = x0
    x0 = x1
    x1 = tmp
    tmp = y0
    y0 = y1
    y1 = tmp
    flag = true
  }
  const dx = x1 - x0
  const dy = y1 - y0
  const dError2 = Math.abs(dy) * 2
  let error2 = 0
  let y = y0
  for (let x = x0; x <= x1; x++) {
    if (steep) {
      points.push([y, x])
    } else {
      points.push([x, y])
    }
    error2 += dError2
    if (error2 > dx) {
      y += (y1 > y0 ? 1 : -1)
      error2 -= dx * 2
    }
  }
  if (flag) {
    points = points.reverse()
  }
  return points
}

function Deduplication (points: Array<[number, number]>): Array<[number, number]> {
  const newPoints: Array<[number, number]> = []
  points.forEach(point => {
    const newPoint: [number, number] = [point[0], point[1]]
    if (newPoints.length > 0) {
      const oldPoint = newPoints[newPoints.length - 1]
      if (newPoint[0] !== oldPoint[0] || newPoint[1] !== oldPoint[1]) {
        newPoints.push(newPoint)
      }
    } else {
      newPoints.push(newPoint)
    }
  })
  return newPoints
}

function DeCorner (points: Point[]): Point[] {
  const newPoints: Point[] = []
  newPoints.push(points[0])
  points.push(points[0])
  for (let i = 1; i < points.length - 1; i++) {
    const p1 = points[i - 1]
    const p2 = points[i]
    const p3 = points[i + 1]
    if ((p1[0] === p2[0] && p2[1] === p3[1]) || (p1[1] === p2[1] && p2[0] === p3[0])) {
      newPoints.push(p3)
      i += 1
    } else {
      newPoints.push(p2)
    }
  }
  return newPoints
}

function Distance (p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2))
}

export function Interpolation (points: Point[]): Point[] {
  let newPoints: Point[] = []
  SealLine(points)
  newPoints.push(points[0])
  for (let i = 1; i < points.length; i++) {
    if (Distance(points[i - 1], points[i]) > 1.43) {
      const line = BresenhamLine(points[i - 1], points[i])
      newPoints.push(...line)
    } else {
      newPoints.push(points[i])
    }
  }
  newPoints = Deduplication(newPoints)
  newPoints = DeCorner(newPoints)
  newPoints.push(newPoints[0])
  return newPoints
}
