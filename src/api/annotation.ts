import { get, post } from './index'

export type AnnotationType = 'Rect' | 'Polygon';
// 标注类型 0：普通圈，1：内环， 2：外环,  3：剪切环
export enum RingType {
  NONE,
  NORMAL,
  INNER,
  OUTER,
  CUT
}

export interface AnnotationBase {
  id: number;
  tag: string;
  comment: string;
  type: AnnotationType;
  isFill: boolean;
  isShow: boolean;
  coordinates: any;
}

export interface RectAnnotation extends AnnotationBase {
  type: 'Rect';
  coordinates: Array<[number, number]>;
}

export interface PolygonAnnotation extends AnnotationBase {
  type: 'Polygon';
  // coordinates数组只有一个元素
  coordinates: Array<Array<[number, number]>>;
  // 在编辑状态时的多条曲线
  lines: Array<Array<[number, number]>>;
  // 编辑结束后的bbox  [xMin, yMin, xMax, yMax]
  bbox: Array<number>;
  // 圈类型
  ringType: RingType;
  // 包含的内环id
  innerRingIDs: Set<number>;
  // 所在区域的外环id
  outerRingId: number;
  // levelSet 预标注
  isLevelSet: boolean;
}

// levelSet算法 根据当前切片标注计算得到的下一张切片的数据
export interface LevelSetAnnotations {
  index: number;
  annotations: Array<PolygonAnnotation>;
}

export enum GraphCutOpMode {
  None,
  Rect,
  Front,
  Back,
}

// graphCut 算法存储的数据
export interface GraphCutData {
  mode: GraphCutOpMode;
  labelTag: string;
  rect: Array<[number, number]>;
  coordinates: Array<Array<[number, number]>>;
}

export type Annotation = RectAnnotation | PolygonAnnotation;

// 获取某切片已有的所有标注
export function getSliceAnnotations (
  server: string,
  group: string,
  dataset: string,
  axis: 'x' | 'y' | 'z',
  index: number
): Promise<Annotation[]> {
  return get(server, `/annotations/${group}/${dataset}/${axis}/${index}`)
}

// 设置某切片的标注
export function setSliceAnnotations (
  server: string,
  group: string,
  dataset: string,
  axis: 'x' | 'y' | 'z',
  index: number,
  annotations: Annotation[]
): Promise<null> {
  const sent = annotations.map(annotationN => {
    const annotation = { ...annotationN }
    delete annotation.isFill
    delete annotation.isShow
    if (annotation.type === 'Rect') {
      const { coordinates } = annotation as RectAnnotation
      return {
        ...annotation,
        coordinates: coordinates.map(
          point => point.map(Math.floor)
        )
      }
    } else if (annotation.type === 'Polygon') {
      const { coordinates, innerRingIDs } = annotation as PolygonAnnotation
      return {
        ...annotation,
        innerRingIDs: Array.from(innerRingIDs),
        coordinates: coordinates.map(
          item => item.map(point => point.map(Math.floor))
        )
      }
    }
  })

  return post(server, `/annotations/${group}/${dataset}/${axis}/${index}`, sent)
}

/**
 * 对当前影像标注使用Levelset算法,计算下一张影像对应的标注
 */
export function applyLevelSet (
  server: string,
  group: string,
  dataset: string,
  axis: 'x' | 'y' | 'z',
  index: number,
  annotations: Annotation[]
): Promise<Annotation[]> {
  const valid = annotations.filter(annotation => annotation.type === 'Polygon' && annotation.lines.length === 0 && annotation.coordinates.length > 0)

  return post(server, '/annotations/action', {
    operation: 'levelset',
    params: {
      group,
      dataset,
      axis,
      index,
      annotations: valid
    }
  })
}

/**
 * 对当前影像标注使用GrabCut算法,计算下一张影像对应的标注
 */
export function applyGrabCut (
  server: string,
  group: string,
  dataset: string,
  axis: 'x' | 'y' | 'z',
  index: number,
  annotation: Annotation
): Promise<Annotation[]> {
  return post(server, '/annotations/action', {
    operation: 'grabcut',
    params: {
      group,
      dataset,
      axis,
      index,
      annotations: [annotation]
    }
  })
}

// 更新某条标注
export function updateAnnotation (
  server: string,
  id: string,
  newAnnotation: string
): Promise<null> {
  return post(server, `/${id}`, newAnnotation)
}
