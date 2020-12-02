//  intelligentScissor.js
//  Created by DHR on 2020/09/21.
//  Copyright © 2020 DHR. All rights reserved.
//  Reference: https://medium.com/swlh/binary-heaps-priority-queues-in-javascript-44d20cf0cb6e
class Point {
    x: number
    y: number

    constructor (x: number, y: number) {
      this.x = x
      this.y = y
    }
}

class CandidatePoint {
    value: Point
    priority: number

    constructor (pos: Point, cost: number) {
      this.value = pos
      this.priority = cost
    }
}

class PriorityQueue {
    values: CandidatePoint[];

    constructor () {
      this.values = []
    }

    IsEmpty (): boolean {
      return this.values.length === 0
    }

    Size (): number {
      return this.values.length
    }

    // helper method that Swaps the values and two indexes of an array
    Swap (index1: number, index2: number): CandidatePoint[] {
      const temp = this.values[index1]
      this.values[index1] = this.values[index2]
      this.values[index2] = temp
      return this.values
    }

    // helper methods that bubbles up values from end
    BubbleUp (): number {
      // get index of inserted element
      let index = this.values.length - 1
      // loop while index is not 0 or element no loger needs to bubble
      while (index > 0) {
        // get parent index via formula
        const parentIndex = Math.floor((index - 1) / 2)
        // if values is greater than parent, Swap the two
        if (this.values[parentIndex].priority > this.values[index].priority) {
          // Swap with helper method
          this.Swap(index, parentIndex)
          // change current index to parent index
          index = parentIndex
        } else {
          break
        }
      }
      return 0
    }

    // method that pushes new value onto the end and calls the bubble helper
    Enqueue (value: CandidatePoint): CandidatePoint[] {
      this.values.push(value)
      // calculate parent, if parent is greater Swap
      // while loop or recurse
      this.BubbleUp()
      return this.values
    }

    BubbleDown (): void {
      let parentIndex = 0
      const length = this.values.length
      const elementPriority = this.values[0].priority
      // loop breaks if no Swaps are needed
      while (true) {
        // get indexes of child elements by following formula
        const leftChildIndex = (2 * parentIndex) + 1
        const rightChildIndex = (2 * parentIndex) + 2
        let leftChildPriority = 0
        let rightChildPriority = 0
        let indexToSwap = null
        // if left child exists, and is greater than the element, plan to Swap with the left child index
        if (leftChildIndex < length) {
          leftChildPriority = this.values[leftChildIndex].priority
          if (leftChildPriority < elementPriority) {
            indexToSwap = leftChildIndex
          }
        }
        // if right child exists
        if (rightChildIndex < length) {
          rightChildPriority = this.values[rightChildIndex].priority

          if (
          // if right child is greater than element and there are no plans to Swap
            (rightChildPriority < elementPriority && indexToSwap === null) ||
                    // OR if right child is greater than left child and there ARE plans to Swap
                    (rightChildPriority < leftChildPriority && indexToSwap !== null)) {
            // plan to Swap with the right child
            indexToSwap = rightChildIndex
          }
        }
        // if there are no plans to Swap, break out of the loop
        if (indexToSwap === null) {
          break
        }
        // Swap with planned element
        this.Swap(parentIndex, indexToSwap)
        // starting index is now index that we Swapped with
        parentIndex = indexToSwap
      }
    }

    dequeue (): CandidatePoint {
      // Swap first and last element
      this.Swap(0, this.values.length - 1)
      // pop max value off of values
      const poppedNode = this.values.pop() as CandidatePoint
      // re-adjust heap if length is greater than 1
      if (this.values.length > 1) {
        this.BubbleDown()
      }

      return poppedNode
    }
}

// 图像直方图均衡化
function equalizeHistogram (src: Array<Array<number>>): Array<Array<number>> {
  const dst = new Array<Array<number>>(src.length)
  const row = src.length
  const col = src[0].length
  const histogram = new Array<number>(256).fill(0)
  for (let i = 0; i < row; i++) {
    for (let j = 0; j < col; j++) {
      histogram[src[i][j]] += 1
    }
  }

  const numberOfPixel = row * col
  const LUT = new Array<number>(256).fill(0)
  LUT[0] = histogram[0] / numberOfPixel * 255
  let sum = histogram[0]
  for (let i = 1; i < 256; i++) {
    sum += histogram[i]
    LUT[i] = sum / numberOfPixel * 255
  }
  for (let i = 0; i < row; i++) {
    dst[i] = new Array<number>(col)
    for (let j = 0; j < col; j++) {
      dst[i][j] = LUT[src[i][j]]
    }
  }
  return dst
}

// 获取图像的灰度矩阵
function getGrayPixelData (image: HTMLImageElement): Array<Array<number>> {
  const canvas0 = document.querySelector('.imageCanvas') as HTMLCanvasElement
  if (canvas0) {
    document.body.removeChild(canvas0)
  }
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  canvas.style.display = 'none'
  canvas.className = 'imageCanvas'
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.clearRect(0, 0, image.width, image.height)
  ctx.drawImage(image, 0, 0, image.width, image.height)
  const imageData = ctx.getImageData(0, 0, image.width, image.height).data

  const row = image.height
  const col = image.width
  const grayImage = new Array<Array<number>>(row)
  for (let i = 0; i < row; i++) {
    grayImage[i] = new Array<number>(col)
    for (let j = 0; j < col; j++) {
      const index = (i * col + j) * 4
      grayImage[i][j] = (imageData[index] * 299 + imageData[index + 1] * 587 + imageData[index + 2] * 114) / 1000
    }
  }
  // return grayImage
  return equalizeHistogram(grayImage)
}

// 计算图像的梯度
export function getGradientMap (image: HTMLImageElement): Array<Array<number>> {
  const src = getGrayPixelData(image)

  const row = src.length
  const col = src[0].length

  const dx = new Array<Array<number>>(row)
  for (let i = 0; i < row; i++) {
    dx[i] = new Array<number>(col)
    dx[i][0] = 0
    dx[i][col - 1] = 0
    for (let j = 1; j < src[i].length - 1; j++) {
      dx[i][j] = src[i][j + 1] - src[i][j - 1]
    }
  }

  const dy = new Array<Array<number>>(row)
  dy[0] = new Array<number>(col).fill(0)
  dy[row - 1] = new Array<number>(col).fill(0)
  for (let i = 1; i < row - 1; i++) {
    dy[i] = new Array<number>(col)
    for (let j = 0; j < col - 1; j++) {
      dy[i][j] = src[i + 1][j] - src[i - 1][j]
    }
  }

  const grayMap = new Array<Array<number>>(row)
  let maxGrayValue = -1
  let minGrayValue = 1000
  for (let i = 0; i < row; i++) {
    grayMap[i] = new Array<number>(col)
    for (let j = 0; j < col; j++) {
      grayMap[i][j] = Math.sqrt(dx[i][j] * dx[i][j] + dy[i][j] * dy[i][j])
      if (j === 0 || j === col - 1 || i === 0 || i === row - 1) continue
      if (grayMap[i][j] > maxGrayValue) {
        maxGrayValue = grayMap[i][j]
      }
      if (grayMap[i][j] < minGrayValue) {
        minGrayValue = grayMap[i][j]
      }
    }
  }
  if (minGrayValue !== 1000 && maxGrayValue !== -1) {
    for (let i = 0; i < row; i++) {
      for (let j = 0; j < col; j++) {
        if (j === 0 || j === col - 1 || i === 0 || i === row - 1) {
          grayMap[i][j] = 255
        } else {
          grayMap[i][j] = 255 - (grayMap[i][j] - minGrayValue) / (maxGrayValue - minGrayValue) * 255
        }
      }
    }
  }
  return grayMap
}

export function getShortestPath (startP: [number, number], endP: [number, number], GradientMap: Array<Array<number>>): Array<[number, number]> {
  if (Math.abs(startP[0] - endP[0]) > 200 || Math.abs(startP[1] - endP[1]) > 200) {
    return []
  }

  const sPoint = new Point(Math.floor(startP[0]), Math.floor(startP[1]))
  const ePoint = new Point(Math.floor(endP[0]), Math.floor(endP[1]))

  const LQueue = new PriorityQueue()
  LQueue.Enqueue(new CandidatePoint(new Point(sPoint.x, sPoint.y), 0))
  const h = GradientMap.length
  const w = GradientMap[0].length

  const nodeState = new Array(h)
  const costMap = new Array(h)
  const prevNodeMap = new Array(h)
  for (let x = 0; x < h; x++) {
    nodeState[x] = new Array(w).fill(-1)
    costMap[x] = new Array(w).fill(10000)
    prevNodeMap[x] = new Array(w).fill(new Point(-1, -1))
  }

  costMap[sPoint.x][sPoint.y] = 0

  while (!LQueue.IsEmpty() && nodeState[ePoint.x][ePoint.y] !== 1) { // 如果ePoint已加入到集合中，则结束
    // console.log(LQueue)
    const temp = LQueue.dequeue()
    const q = new Point(temp.value.x, temp.value.y)
    nodeState[q.x][q.y] = 1
    // console.log(q)
    // for each q's neighborhood
    for (let i = -1; i < 2; i++) {
      for (let j = -1; j < 2; j++) {
        const r = new Point(q.x + i, q.y + j)
        // boarder checking
        if (r.x > w - 1 || r.y > h - 1 || r.x < 1 || r.y < 1) continue
        // console.log(r)
        if (nodeState[r.x][r.y] !== 1) { // if r is not expanded
          let scale = 1.0
          if (Math.abs(i) === 1 && Math.abs(j) === 1) {
            scale = 1.414
          } // if diagonal multiple sqrt(2)
          const tempCost = costMap[q.x][q.y] + scale * GradientMap[r.x][r.y] // G_temp = g(q)+l(q,r)
          if (nodeState[r.x][r.y] === -1) {
            // console.log(q)
            costMap[r.x][r.y] = tempCost
            nodeState[r.x][r.y] = 0
            prevNodeMap[r.x][r.y] = q
            LQueue.Enqueue(new CandidatePoint(new Point(r.x, r.y), tempCost))
            // console.log(LQueue.Size())
          }
          if (nodeState[r.x][r.y] === 0 && tempCost < costMap[r.x][r.y]) {
            // console.log(r)
            costMap[r.x][r.y] = tempCost
            prevNodeMap[r.x][r.y] = q
          }
        }
      }
    }
  }
  // 遍历prevNodeMap获取从ePoint到sPoint的最短路径
  // console.log(nodeState)

  const path = []
  path.push(ePoint)
  while (prevNodeMap[path.slice(-1)[0].x][path.slice(-1)[0].y].x !== -1 && prevNodeMap[path.slice(-1)[0].x][path.slice(-1)[0].y].y !== -1) {
    path.push(prevNodeMap[path.slice(-1)[0].x][path.slice(-1)[0].y])
  }
  const linePoints = [] as Array<[number, number]>
  path.forEach(p => {
    linePoints.push([p.x, p.y])
  })
  return linePoints
}
