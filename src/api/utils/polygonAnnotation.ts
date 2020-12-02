import { GetBBox, GetBBoxIOU, IsInnerBBox, IsOuterBBox, MergeBBox, Point } from '@/api/utils/bbox'
import { Annotation, PolygonAnnotation, RingType } from '@/api/annotation'

// 填充不规则区域
function FillArea (ctx: CanvasRenderingContext2D, points: Array<Point>): void {
  if (points.length <= 0) return
  const pStart = points[0]
  ctx.beginPath()
  ctx.moveTo(pStart[0], pStart[1])
  for (let i = 1; i < points.length; i++) {
    const p = points[i]
    ctx.lineTo(p[0], p[1])
  }
  ctx.fill()
  ctx.closePath()
}

// 判断第一个标注是否被第二个标注包含
export function IsInnerAnnotation (
  annotation1: PolygonAnnotation,
  annotation2: PolygonAnnotation,
  bboxWindow: number[],
  ctx: CanvasRenderingContext2D): boolean {
  if (!ctx) return false
  ctx.clearRect(0, 0, bboxWindow[2], bboxWindow[3])
  ctx.lineWidth = 1
  ctx.fillStyle = `rgba(${annotation2.id},${0},${0}, 1)`
  FillArea(ctx, annotation2.coordinates[0])
  const bbox = annotation1.bbox
  const width = bbox[2] - bbox[0] + 1
  const height = bbox[3] - bbox[1] + 1
  const bboxArea = ctx.getImageData(bbox[0], bbox[1], width, height)
  let count = 0
  annotation1.coordinates[0].forEach(p => {
    const t = Math.floor(p[1] - bbox[1]) * width + Math.floor(p[0] - bbox[0])
    if (bboxArea.data[4 * t] > 0) {
      count += 1
    }
  })
  return (count / annotation1.coordinates[0].length) > 0.97
}

// 计算两个标注的重叠度 iou
export function GetAnnotationIOU (annotation1: PolygonAnnotation, annotation2: PolygonAnnotation, bboxWindow: number[], ctx: CanvasRenderingContext2D): number {
  let iou = 0
  if (!ctx) return iou
  const bbox = MergeBBox(annotation1.bbox, annotation2.bbox)
  const width = bbox[2] - bbox[0] + 1
  const height = bbox[3] - bbox[1] + 1
  let count1 = 0
  let count2 = 0

  ctx.clearRect(0, 0, bboxWindow[2], bboxWindow[3])
  ctx.lineWidth = 1
  ctx.fillStyle = `rgba(${1},${0},${0}, 0.5)`
  FillArea(ctx, annotation1.coordinates[0])
  ctx.fillStyle = `rgba(${2},${0},${0}, 0.5)`
  FillArea(ctx, annotation2.coordinates[0])
  const bboxArea = ctx.getImageData(bbox[0], bbox[1], width, height)

  for (let t = 0; t < bboxArea.data.length; t += 4) {
    const value = bboxArea.data[t]
    if (value === 1) {
      count1 += 1
    } else if (value === 2) {
      count2 += 1
    }
  }
  iou = count1 / (count1 + count2)
  console.log('iou', iou, count1, count2)
  return iou
}

// 判断第一个标注是否是第二个标注的父节点
function IsOuterRing (
  annotation1: PolygonAnnotation,
  annotation2: PolygonAnnotation,
  bbox: number[],
  ctx: CanvasRenderingContext2D): boolean {
  if (IsOuterBBox(annotation1.bbox, annotation2.bbox)) {
    if (IsInnerAnnotation(annotation2, annotation1, bbox, ctx)) {
      return true
    }
  }
  return false
}

// 找到父节点
function FindOuterRing (
  annotations: Annotation[],
  annotation1: PolygonAnnotation,
  annotation2: PolygonAnnotation,
  bbox: number[],
  ctx: CanvasRenderingContext2D): number {
  if (IsInnerBBox(annotation1.bbox, annotation2.bbox)) {
    if (annotation2.innerRingIDs.size === 0) {
      if (IsInnerAnnotation(annotation1, annotation2, bbox, ctx)) {
        return annotation2.id
      }
      return -1
    }
    let flag = false
    let idx = -1
    for (const id of annotation2.innerRingIDs) {
      const annotationT = annotations.find((item) => item.id === id) as PolygonAnnotation
      idx = FindOuterRing(annotations, annotation1, annotationT, bbox, ctx)
      if (idx !== -1) {
        flag = true
        break
      }
    }
    if (flag) return idx
    else {
      if (IsInnerAnnotation(annotation1, annotation2, bbox, ctx)) {
        return annotation2.id
      } else return -1
    }
  }
  return -1
}

// 标注的环类型更新
function UpdateAnnotationRingType (annotations: Annotation[], annotation: PolygonAnnotation, ringType: RingType): void {
  if (annotation.ringType === ringType) return
  annotation.ringType = ringType
  if (annotation.innerRingIDs.size === 0 && annotation.outerRingId === -1) {
    annotation.ringType = RingType.NORMAL
    return
  }
  for (const id of annotation.innerRingIDs) {
    const annotationT = annotations.find((item) => item.id === id) as PolygonAnnotation
    if (annotationT.tag === annotation.tag) {
      if (ringType === RingType.CUT) {
        UpdateAnnotationRingType(annotations, annotationT, RingType.INNER)
      } else if (ringType === RingType.INNER) {
        UpdateAnnotationRingType(annotations, annotationT, RingType.CUT)
      } else if (ringType === RingType.OUTER) {
        UpdateAnnotationRingType(annotations, annotationT, RingType.CUT)
      }
    }
  }
}

// 设置标注的环类型
export function SetAnnotationRingType (
  annotations: Annotation[],
  annotation: PolygonAnnotation,
  bbox: number[],
  ctx: CanvasRenderingContext2D): void {
  if (annotation.ringType !== RingType.NONE) return
  // 作为子节点找到父亲
  let outerId = -1
  const innerIds = []
  const innerIndices = []
  for (let i = 0; i < annotations.length; i++) {
    if (annotations[i].type !== 'Polygon' || annotations[i].id === annotation.id) continue
    const annotationT = annotations[i] as PolygonAnnotation
    if (annotationT.ringType === RingType.NORMAL || annotationT.ringType === RingType.OUTER) {
      outerId = FindOuterRing(annotations, annotation, annotationT, bbox, ctx)
      if (outerId !== -1) {
        break
      } else {
        if (IsOuterRing(annotation, annotationT, bbox, ctx)) {
          innerIds.push(annotationT.id)
          innerIndices.push(i)
        }
      }
    }
  }
  if (outerId !== -1) {
    const annotationOuter = annotations.find((item) => item.id === outerId) as PolygonAnnotation
    if (annotationOuter.innerRingIDs.size === 0) { // 仅作为内环
      annotationOuter.innerRingIDs.add(annotation.id)
      annotation.outerRingId = annotationOuter.id
      let ringType = RingType.INNER
      if (annotation.tag === annotationOuter.tag && annotationOuter.ringType !== RingType.CUT) {
        ringType = RingType.CUT
      }
      annotation.ringType = ringType
      if (annotationOuter.ringType === RingType.NORMAL) {
        annotationOuter.ringType = RingType.OUTER
      }
    } else { // 考虑既作为内环又作为外环
      annotationOuter.innerRingIDs.add(annotation.id)
      annotation.outerRingId = annotationOuter.id
      annotation.ringType = RingType.INNER
      if (annotationOuter.tag === annotation.tag && annotationOuter.ringType !== RingType.CUT) {
        annotation.ringType = RingType.CUT
      }
      for (const id of annotationOuter.innerRingIDs) {
        const index = annotations.findIndex((item) => item.id === id)
        const annotationT = annotations[index] as PolygonAnnotation
        if (IsOuterRing(annotation, annotationT, bbox, ctx)) {
          annotationT.outerRingId = annotation.id
          annotation.innerRingIDs.add(annotationT.id)
          annotationOuter.innerRingIDs.delete(annotationT.id)
          let ringType = RingType.INNER
          if (annotation.tag === annotationT.tag && annotation.ringType !== RingType.CUT) {
            ringType = RingType.CUT
          }
          UpdateAnnotationRingType(annotations, annotationT, ringType)
        }
      }
    }
  } else if (innerIndices.length > 0) { // 仅作为外环
    annotation.ringType = RingType.OUTER
    for (let i = 0; i < innerIndices.length; i++) {
      const annotationT = annotations[innerIndices[i]] as PolygonAnnotation
      annotation.innerRingIDs.add(annotationT.id)
      annotationT.outerRingId = annotation.id
      if (annotation.tag === annotationT.tag) {
        UpdateAnnotationRingType(annotations, annotationT, RingType.CUT)
      } else {
        UpdateAnnotationRingType(annotations, annotationT, RingType.INNER)
      }
    }
  } else { // 仅作为普通环
    annotation.ringType = RingType.NORMAL
  }
}

function GetMergeRectArea (annotations1: Annotation[], annotations2: PolygonAnnotation[]): number[] {
  let xMax = -1
  let yMax = -1
  annotations1.forEach(annotation => {
    if (annotation.type === 'Polygon') {
      annotation = annotation as PolygonAnnotation
      if (annotation.ringType === RingType.NORMAL || annotation.ringType === RingType.OUTER) {
        xMax = Math.max(xMax, annotation.bbox[2])
        yMax = Math.max(yMax, annotation.bbox[3])
      }
    }
  })
  annotations2.forEach(annotation => {
    xMax = Math.max(xMax, annotation.bbox[2])
    yMax = Math.max(yMax, annotation.bbox[3])
  })

  xMax += 20
  yMax += 20

  return [0, 0, xMax, yMax]
}

function GetMergeCtx (bbox: number[]): CanvasRenderingContext2D {
  const canvas0 = document.querySelector('.MergeLevelSet') as HTMLCanvasElement
  if (canvas0) {
    document.body.removeChild(canvas0)
  }
  const canvas = document.createElement('canvas') as HTMLCanvasElement
  canvas.width = bbox[2]
  canvas.height = bbox[3]
  canvas.style.display = 'none'
  canvas.className = '.MergeLevelSet'
  return canvas.getContext('2d') as CanvasRenderingContext2D
}

// 将 level Set标注 合并到普通标注中
export function MergeLevelSetAnnotations (
  annotations: Annotation[],
  levelSetAnnotations: PolygonAnnotation[]): Annotation[] {
  const bbox = GetMergeRectArea(annotations, levelSetAnnotations)
  const ctx = GetMergeCtx(bbox)
  const polygonAnnotations: PolygonAnnotation[] = []
  let maxId = 0
  annotations.forEach(annotation => {
    if (annotation.type === 'Polygon') {
      polygonAnnotations.push(annotation as PolygonAnnotation)
    }
    if (annotation.id > maxId) maxId = annotation.id
  })
  levelSetAnnotations = levelSetAnnotations.filter(annotationL => {
    for (let i = 0; i < polygonAnnotations.length; i++) {
      if (GetBBoxIOU(polygonAnnotations[i].bbox, annotationL.bbox) > 0.1 &&
          GetAnnotationIOU(polygonAnnotations[i], annotationL, bbox, ctx) > 0.60) {
        return false
      }
    }
    return true
  })
  levelSetAnnotations.forEach(annotationL => {
    maxId += 1
    annotationL.id = maxId
    annotations.push(annotationL)
    SetAnnotationRingType(annotations, annotationL, bbox, ctx)
  })
  return annotations
}

function FindMaxIdInAnnotations (annotations: Annotation[]): number {
  let maxId = -1
  annotations.forEach(annotation => {
    if (annotation.id > maxId) maxId = annotation.id
  })
  return maxId
}

// 根据graph cut 坐标 生成一个 graph cut标注
export function CreateGraphCutAnnotation (labelTag: string, coordinates: Array<Array<[number, number]>>, annotations: Annotation[]): PolygonAnnotation {
  const annotation: PolygonAnnotation = {} as PolygonAnnotation
  annotation.type = 'Polygon'
  const maxId = FindMaxIdInAnnotations(annotations)
  annotation.id = maxId === -1 ? 1 : maxId + 1
  annotation.tag = labelTag

  annotation.coordinates = []
  annotation.coordinates.push([...coordinates[0]])
  annotation.bbox = GetBBox(annotation.coordinates[0])
  annotation.lines = []
  annotation.ringType = RingType.NONE
  annotation.innerRingIDs = new Set<number>()
  annotation.outerRingId = -1

  const idx = annotations.findIndex(item => item.tag === labelTag)
  annotation.isFill = idx !== -1 ? annotations[idx].isFill : false

  annotation.isShow = true
  annotation.isLevelSet = false
  return annotation
}

// 将 graph cut标注 合并到普通标注中
export function MergeGraphCutAnnotations (
  graphCutAnnotation: PolygonAnnotation,
  annotations: Annotation[]): Annotation[] {
  const bbox = GetMergeRectArea(annotations, [graphCutAnnotation])
  const ctx = GetMergeCtx(bbox)
  annotations.push(graphCutAnnotation)
  SetAnnotationRingType(annotations, graphCutAnnotation, bbox, ctx)
  return annotations
}

// PolygonAnnotation的深度拷贝
export function DeepCopyPolygonAnnotation (annotation: PolygonAnnotation): PolygonAnnotation {
  const annotationNew = { ...annotation }
  annotationNew.coordinates = annotation.coordinates.map(item => [...item])
  annotationNew.bbox = [...annotation.bbox]
  annotationNew.innerRingIDs = new Set([...annotation.innerRingIDs])
  annotationNew.lines = annotation.lines.map(item => [...item])
  return annotationNew
}
