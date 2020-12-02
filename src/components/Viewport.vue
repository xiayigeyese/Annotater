<template>
  <div class="canvasContent">
    <div class="preloader" v-show="loading">
      <div class="loader">
        <i style="font-size: 50px" class="el-icon-loading"></i>
      </div>
    </div>
    <canvas ref="canvas" id="canvas"></canvas>
    <!--    <div class="graphCut-menu-panel" v-show="showGraphCutMenuPanel">-->
    <!--      <el-button size="medium" type="danger" @click="SelectGraphCutFront">前 景</el-button>-->
    <!--      <el-button size="medium" type="success" @click="SelectGraphCutBack">背 景</el-button>-->
    <!--      <el-button size="medium" type="primary" @click="GraphCutEx">确 定</el-button>-->
    <!--    </div>-->
    <div ref="scaleBox" class="scaleBox" v-show="this.showScalePanel">
      <canvas ref="scaleCanvas" class="scaleCanvas"></canvas>
      <div class="scalePanel">
        <span> 当前：{{ this.sliceIndex }} / {{ this.sliceCount }}</span>
        <span> {{ Math.floor(this.scale * 100) }} %</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import store, { OpMode } from '../store'
import { Annotation, PolygonAnnotation, RectAnnotation, RingType, GraphCutOpMode, GraphCutData } from '../api/annotation'
import { Label } from '@/api/dataset'
import { getGradientMap, getShortestPath } from '@/api/intelligentScissor'
import { Interpolation } from '@/api/utils/line'

function hexToRgb (hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    }
    : { r: 0, g: 0, b: 0 }
}

type Point = [number, number];
enum CanvasType {
  MAIN,
  BUFFER
}

export default Vue.extend({
  name: 'view-port',
  computed: {
    sliceIndex (): number {
      if (this.image && store.getters.index >= 0) {
        return store.getters.index + 1
      }
      return 0
    },
    sliceCount (): number {
      const dataset = store.getters.dataset
      if (!dataset) return 0
      const DimensionToIndex = {
        x: 0,
        y: 1,
        z: 2
      }
      return dataset.dimensions[DimensionToIndex[store.state.axis]]
    },
    showScalePanel (): boolean {
      return store.state.showScalePanel
    },
    showGraphCutMenuPanel (): boolean {
      return store.getters.mode === OpMode.GraphCut
    },
    loading (): boolean {
      return store.state.loading
    }
  },
  data () {
    return {
      // 画布对象
      canvas: null as null | HTMLCanvasElement,
      // 画布宽度
      canvasWidth: 0,
      // 画布高度
      canvasHeight: 0,
      // 画布上下文对象
      ctx: null as null | CanvasRenderingContext2D,

      // 缓冲画布
      bufferCanvas: null as null | HTMLCanvasElement,
      // 缓冲画布上下文对象
      bufferCtx: null as null | CanvasRenderingContext2D,

      // 橡皮檫画布
      eraserCanvas: null as null | HTMLCanvasElement,
      // 橡皮檫画布上下文对象
      eraserCtx: null as null | CanvasRenderingContext2D,

      // 显示填充区域的画布
      fillCanvas: null as null | HTMLCanvasElement,
      // 填充画布上下文
      fillCtx: null as null | CanvasRenderingContext2D,

      // 选择标注辅助画布
      selectMaskCanvas: null as null | HTMLCanvasElement,
      // 选择标注辅助画布上下文对象
      selectMaskCtx: null as null | CanvasRenderingContext2D,
      //  选择mask
      selectMask: null as null | ImageData,

      // 缩略图画布
      scaleCanvas: null as null | HTMLCanvasElement,
      // 缩略图画布对象
      scaleCtx: null as null | CanvasRenderingContext2D,
      // 缩略图宽度
      scaleWidth: 150,
      // 缩略图高度
      scaleHeight: 150,

      // 当前图片对象
      image: null as null | HTMLImageElement,
      // 前一张图片对象
      prevImage: null as null | HTMLImageElement,
      // 前一张图片是否预加载完毕
      prevImageFlag: 0,
      // 后一张图片对象
      nextImage: null as null | HTMLImageElement,
      // 后一张图片是否预加载完毕
      nextImageFlag: 0,

      // 图片宽度
      imgWidth: 0,
      // 图片高度
      imgHeight: 0,
      // 图片在画板中的横坐标
      imgX: 0,
      // 图片在画板中的纵坐标
      imgY: 0,

      // 拖动过程中，鼠标前一次移动的横坐标
      prevMouseX: 0,
      // 拖动过程中，鼠标前一次移动的纵坐标
      prevMouseY: 0,
      // 缩放倍数
      scale: 0,
      // 缩放步进
      scaleStep: 0.02,
      // 最小缩放倍数
      minScale: 0.2,
      // 最大缩放倍数
      maxScale: 8,
      // 图片拖拽至边缘最小显示
      imgAppearSize: 180,

      // 上一次的标注索引
      selectPrevIndex: -1,
      // 当前选择的标注索引
      selectIndex: -1,
      // 当前的标注索引
      annotationIndex: -1,

      // 鼠标滚轮事件的延迟执行代码块id
      mousewheelTimer: 0,
      // 鼠标滚轮开始滑动
      mousewheelStart: false,

      // 矩形框起点横坐标
      rectX: 0,
      // 矩形框起点纵坐标
      rectY: 0,

      // 圆点半径
      radius: 5,
      // 线宽
      lineWidth: 2,
      // 橡皮檫半径
      eraserRadius: 20,

      // 撤销重做
      revoke: {
        undo: {
          annotationsImage: [] as Array<Annotation>,
          levelSetAnnotations: [] as Array<Annotation>,
          annotationIndex: -1
        },
        redo: {
          annotationsImage: [] as Array<Annotation>,
          levelSetAnnotations: [] as Array<Annotation>,
          annotationIndex: -1
        },
        flag: false
      },

      // 图像梯度矩阵
      gradientMap: [] as Array<Array<number>>,
      // 智能剪刀临时曲线点集
      inSciCurvePoints: [] as Array<[number, number]>,
      // 智能剪刀起始点
      inSciStartPoint: [-1, -1] as Point,

      // graphCut
      graphCut: {
        frontPts: [] as Array<[number, number]>,
        backPts: [] as Array<[number, number]>,
        status: 0,
        lineWidth: 10,
        frontColor: '#FF0000',
        backColor: '#00FF00'
      }
    }
  },
  methods: {
    // ===================== 加载图片 ===================
    HandleImageChange (url: string): void {
      this.image = new Image()
      this.image.crossOrigin = 'anonymous'
      this.image.src = url
      this.image.onload = (): void => {
        this.SetCanvasImage()
        this.SetScaleImage()
      }
    },

    // ===================== canvas 事件回调  ===================

    // Canvas 窗口大小更新事件
    CanvasReSizeCallback (): void {
      if (!this.canvas) return
      this.canvas.width = this.canvas.clientWidth
      this.canvas.height = this.canvas.clientHeight
      this.canvasWidth = this.canvas.clientWidth
      this.canvasHeight = this.canvas.clientHeight
      if (this.image) {
        const offsetX =
          (this.canvasWidth - this.imgWidth * this.scale) / 2 - this.imgX
        const offsetY =
          (this.canvasHeight - this.imgHeight * this.scale) / 2 - this.imgY
        this.UpdateCanvasForTransform(offsetX, offsetY)
        this.UpdateCanvas()
      }
    },

    // 滚动鼠标缩放事件
    CanvasMouseWheelCallback (event: WheelEvent): void {
      if (!this.image || !this.canvas) return
      const wd = event.deltaY
      let newScale =
        this.scale * (1 + (wd > 0 ? this.scaleStep : -this.scaleStep))
      newScale = newScale < this.minScale ? this.minScale : newScale
      newScale = newScale > this.maxScale ? this.maxScale : newScale

      // 绘制缓冲画布
      if (!this.mousewheelStart) {
        this.mousewheelStart = true
        this.UpdateBufferCanvas()
      }

      // 获取鼠标在画布中的位置点
      const p = this.GetMouseInCanvasLocation(event, this.canvas, true)
      // 更新画布
      this.UpdateCanvasForRescale(p, newScale)
      // 事件结束
      clearTimeout(this.mousewheelTimer)
      this.mousewheelTimer = setTimeout(() => {
        this.mousewheelStart = false
        this.UpdateCanvas(1)
      }, 200)
    },

    // canvas 鼠标滑动事件
    CanvasMouseMoveCallback (event: MouseEvent): void {
      if (!this.canvas || !this.ctx) return
      const canvas = this.canvas
      const ctx = this.ctx
      const { mode } = store.state

      const FindCornerPointInRect = (p: Point, rect: Array<[number, number]>): number => {
        for (let i = 0; i < rect.length; i++) {
          if (this.Distance(p, rect[i]) * this.scale <= store.getters.radius) {
            return i
          }
        }
        return -1
      }

      const FindCornerPoint = (point: Point): [number, number] => {
        const p = this.ImagePositionPoint(point)
        for (let i = 0; i < store.state.annotations.length; i++) {
          let annotation = store.state.annotations[i]
          if (annotation.type === 'Rect') {
            annotation = annotation as RectAnnotation
            for (let j = 0; j < annotation.coordinates.length; j++) {
              if (
                this.Distance(p, annotation.coordinates[j]) * this.scale <=
                store.getters.radius
              ) {
                return [i, j]
              }
            }
          }
        }
        return [-1, -1]
      }

      const FindEndPoint = (
        annotation: PolygonAnnotation,
        point: Point
      ): number => {
        for (let i = 0; i < annotation.lines.length; i++) {
          const line = annotation.lines[i]
          if (
            this.Distance(point, line[0]) * this.scale <=
              store.getters.radius ||
            this.Distance(point, line[line.length - 1]) * this.scale <=
              store.getters.radius
          ) {
            return i
          }
        }
        return -1
      }

      const FindEndPointWithIndex = (
        annotations: Annotation[],
        annotationIndex: number,
        point: Point
      ): number => {
        const annotation = store.state.annotations[
          annotationIndex
        ] as PolygonAnnotation
        return FindEndPoint(annotation, point)
      }

      const FindAnnotationIndexWithPoint = (
        annotations: Annotation[],
        point: Point
      ): number => {
        let index = -1
        for (let i = 0; i < annotations.length; i++) {
          if (annotations[i].type === 'Polygon') {
            const annotation = annotations[i] as PolygonAnnotation
            index = FindEndPoint(annotation, point)
            if (index !== -1) return i
          }
        }
        return -1
      }

      const FindAnnotationIndex = (id: number): number => {
        for (let i = 0; i < store.state.annotations.length; i++) {
          if (store.state.annotations[i].id === id) return i
        }
        return -1
      }

      const RectModeMove = (p: Point): void => {
        canvas.style.cursor = 'crosshair'
        const [annotationIndex, index] = FindCornerPoint(p)
        this.selectIndex = annotationIndex
        if (this.selectIndex !== -1 && index !== -1) {
          this.LabelChangeWithAnnotationSelect(this.selectIndex)
          canvas.style.cursor = 'grabbing'
        }
      }

      const CurveModeMove = (p: Point): void => {
        canvas.style.cursor = 'crosshair'
        const annotations = store.state.annotations
        const point = this.ImagePositionPoint(p)
        this.selectIndex = FindAnnotationIndexWithPoint(annotations, point)
        if (this.selectIndex !== -1) {
          this.LabelChangeWithAnnotationSelect(this.selectIndex)
          canvas.style.cursor = "url('/static/cursor_target2.png'), pointer"
        }
      }

      const SelectModeMove = (p: Point): void => {
        if (!this.selectMask) return
        const pointInImage = this.ImagePositionPoint(p)
        const t =
          Math.floor(pointInImage[1]) * this.imgWidth +
          Math.floor(pointInImage[0])
        const id = this.selectMask.data[4 * t]
        this.selectIndex = FindAnnotationIndex(id)
        if (
          this.selectIndex === this.selectPrevIndex ||
          this.selectIndex > store.state.annotations.length
        ) {
          return
        }
        this.UpdateCanvas()
        this.selectPrevIndex = this.selectIndex
      }

      const translationPoint = (p: Point, radius: number): Point => {
        return [p[0] + radius / 2 + 0.5, p[1] + radius / 2 + 0.5]
      }

      const EraserSelectModeMove = (p: Point): void => {
        p = translationPoint(p, store.getters.eraserRadius)
        SelectModeMove(p)
      }

      const IntelligentScissorsModeMove = (p: Point): void => {
        canvas.style.cursor = 'crosshair'
        const annotations = store.state.annotations
        const point = this.ImagePositionPoint(p)
        if (
          this.annotationIndex !== -1 &&
          this.annotationIndex < annotations.length &&
          annotations[this.annotationIndex].type === 'Polygon'
        ) {
          if (
            FindEndPointWithIndex(annotations, this.annotationIndex, point) !==
            -1
          ) {
            canvas.style.cursor = "url('/static/cursor_target2.png'), pointer"
          }
        }
        if (this.inSciStartPoint[0] !== -1) {
          this.UpdateCanvas(0)
          this.inSciCurvePoints = getShortestPath(
            this.inSciStartPoint,
            point,
            this.gradientMap
          )
          if (this.inSciCurvePoints.length > 0) {
            const { label } = store.getters
            ctx.lineWidth = 1
            ctx.strokeStyle = label.color
            ctx.fillStyle = label.color
            this.DrawCurvePoints(ctx, this.inSciCurvePoints)
          }
        }
      }

      const GraphCutModeMove = (p: Point): void => {
        canvas.style.cursor = 'crosshair'
        const index = FindCornerPointInRect(this.ImagePositionPoint(p), store.getters.graphCutData.rect)
        if (index !== -1) {
          canvas.style.cursor = 'grabbing'
        }
      }

      const p = this.GetPointsPositionInCanvas(event, this.canvas)
      switch (mode) {
        case OpMode.None:
          this.canvas.style.cursor = 'default'
          break
        case OpMode.Drag:
          this.canvas.style.cursor = 'move'
          break
        case OpMode.Rect:
          RectModeMove(p)
          break
        case OpMode.Eraser:
          this.canvas.style.cursor =
            "url('/static/cursor_eraser2.png'), pointer"
          // EraserSelectModeMove(p)
          break
        case OpMode.Curve:
          CurveModeMove(p)
          break
        case OpMode.Select:
          canvas.style.cursor = 'default'
          SelectModeMove(p)
          break
        case OpMode.IntelligentScissors:
          IntelligentScissorsModeMove(p)
          break
        case OpMode.GraphCut:
          GraphCutModeMove(p)
          break
        default:
          break
      }
    },

    // Canvas 鼠标点击事件
    CanvasMouseDownCallback (event: MouseEvent): void {
      if (!this.image) return

      if (event.button === 0) {
        const { mode } = store.state
        if (mode === OpMode.Drag) {
          this.MouseDragImageCallback(event)
        } else if (mode === OpMode.Select) {
          this.MouseSelectAnnotationCallback()
        } else if (mode === OpMode.Eraser) {
          this.MouseErasePointsCallback(event)
        } else if (mode === OpMode.Rect) {
          this.MouseDrawRectCallback(event)
        } else if (mode === OpMode.Curve) {
          this.MouseDrawAreaCallback(event)
        } else if (mode === OpMode.IntelligentScissors) {
          this.MouseStartISCurveCallback(event)
        } else if (mode === OpMode.GraphCut) {
          this.MouseGraphCutCallback2(event)
        }
      } else if (event.button === 2) {
        const { mode } = store.state
        if (mode === OpMode.IntelligentScissors) {
          this.MouseEndISCurveCallback()
        }
        this.MouseDragImageCallback(event)
      }
    },

    // 鼠标点击画板拖拽图片事件
    MouseDragImageCallback (event: MouseEvent): void {
      if (!this.canvas) return

      this.UpdateBufferCanvas()
      const prevP = this.GetMouseInCanvasLocation(event, this.canvas)
      this.prevMouseX = prevP[0]
      this.prevMouseY = prevP[1]

      const ImageDragAction = (event: MouseEvent): void => {
        if (!this.canvas) return

        const p = this.GetMouseInCanvasLocation(event, this.canvas)
        const offsetX = p[0] - this.prevMouseX
        const offsetY = p[1] - this.prevMouseY
        this.UpdateCanvasForTransform(offsetX, offsetY)
        this.prevMouseX = p[0]
        this.prevMouseY = p[1]
      }

      const RemoveImageDragAction = (): void => {
        if (!this.canvas) return

        this.UpdateCanvas(1)
        this.canvas.removeEventListener('mousemove', ImageDragAction)
        this.canvas.removeEventListener('mouseup', RemoveImageDragAction)
      }

      this.canvas.addEventListener('mousemove', ImageDragAction)
      this.canvas.addEventListener('mouseup', RemoveImageDragAction)
    },

    // 鼠标左键选择某个标注
    MouseSelectAnnotationCallback (): void {
      // store.state.annotations = []
      // this.SaveAnnotations()

      this.LabelChangeWithAnnotationSelect(this.selectIndex)
      this.annotationIndex = this.selectIndex
      // level set 标注 确认保存
      if (store.getters.useLevelSet) {
        this.SelectLevelSetAnnotationAndSave(this.annotationIndex)
      }
      this.UpdateCanvas()
    },

    // 鼠标左键绘制矩形框事件
    MouseDrawRectCallback (event: MouseEvent): void {
      const label = store.getters.label
      if (!label) return
      const canvas: HTMLCanvasElement = this.canvas as HTMLCanvasElement

      const GetRectCorner = (
        p1: number[],
        p2: number[]
      ): Array<[number, number]> => {
        const points: Array<[number, number]> = []
        const xMin = Math.min(p1[0], p2[0])
        const yMin = Math.min(p1[1], p2[1])
        const xMax = Math.max(p1[0], p2[0])
        const yMax = Math.max(p1[1], p2[1])
        points.push([xMin, yMin])
        points.push([xMax, yMin])
        points.push([xMax, yMax])
        points.push([xMin, yMax])
        return points
      }

      const FindCornerPoint = (
        point: Point,
        annotation: RectAnnotation
      ): number => {
        const p = this.ImagePositionPoint(point)
        for (let i = 0; i < annotation.coordinates.length; i++) {
          const distance = Math.sqrt(
            Math.pow(annotation.coordinates[i][0] - p[0], 2) +
              Math.pow(annotation.coordinates[i][1] - p[1], 2)
          )
          if (distance * this.scale <= store.getters.radius * 1.5) {
            return i
          }
        }
        return -1
      }

      const CheckRect = (startP: Point, endP: Point): boolean => {
        const p1 = this.CanvasPositionPoint(startP)
        const p2 = this.CanvasPositionPoint(endP)
        return this.Distance(p1, p2) < store.getters.radius
      }

      const AddNewRect = (startP: Point, label: Label): void => {
        this.RevokeUndoContent()
        const annotationNew = {} as RectAnnotation
        annotationNew.tag = label.id
        annotationNew.type = 'Rect'
        const idx = store.state.annotations.findIndex(
          item => item.tag === label.id
        )
        annotationNew.isFill =
          idx !== -1 ? store.state.annotations[idx].isFill : false
        annotationNew.isShow = true
        startP = this.ImagePositionPoint(startP)
        annotationNew.coordinates = []
        this.annotationIndex = store.state.annotations.length
        annotationNew.id =
          this.annotationIndex === 0
            ? 1
            : store.state.annotations[this.annotationIndex - 1].id + 1
        store.state.annotations.push(annotationNew)
        const DrawRectAction = (event: MouseEvent): void => {
          let moveP = this.GetPointsPositionInCanvas(event, canvas)
          moveP = this.ImagePositionPoint(moveP)
          annotationNew.coordinates = GetRectCorner(startP, moveP)
          this.UpdateCanvas()
        }
        const RemoveDrawRectAction = (): void => {
          if (
            CheckRect(
              annotationNew.coordinates[0] as Point,
              annotationNew.coordinates[1] as Point
            )
          ) {
            store.state.annotations.splice(this.annotationIndex, 1)
            this.annotationIndex = -1
            this.UpdateCanvas()
          }
          this.RevokeRedoContent()
          this.SaveAnnotations()
          canvas.removeEventListener('mousemove', DrawRectAction)
          canvas.removeEventListener('mouseup', RemoveDrawRectAction)
        }
        canvas.addEventListener('mousemove', DrawRectAction)
        canvas.addEventListener('mouseup', RemoveDrawRectAction)
      }

      // 绘制前的准备
      this.SetLabelAndIndexBeforeDraw(label)
      this.UpdateCanvas()

      let startP = this.GetPointsPositionInCanvas(event, canvas)
      if (
        this.annotationIndex !== -1 &&
        store.state.annotations[this.annotationIndex].type === 'Rect'
      ) {
        const annotation = store.state.annotations[
          this.annotationIndex
        ] as RectAnnotation
        const index = FindCornerPoint(startP, annotation)
        if (index !== -1) {
          // 在已有的rect 上面修改
          this.RevokeUndoContent()
          startP = annotation.coordinates[(index + 2) % 4]
          const DrawRectAction = (event: MouseEvent): void => {
            let moveP = this.GetPointsPositionInCanvas(event, canvas)
            moveP = this.ImagePositionPoint(moveP)
            annotation.coordinates = GetRectCorner(startP, moveP)
            this.UpdateCanvas()
          }
          const RemoveDrawRectAction = (): void => {
            if (
              CheckRect(annotation.coordinates[0], annotation.coordinates[2])
            ) {
              store.state.annotations.splice(this.annotationIndex, 1)
              this.annotationIndex = -1
              this.UpdateCanvas()
            }
            this.RevokeRedoContent()
            this.SaveAnnotations()
            canvas.removeEventListener('mousemove', DrawRectAction)
            canvas.removeEventListener('mouseup', RemoveDrawRectAction)
          }
          canvas.addEventListener('mousemove', DrawRectAction)
          canvas.addEventListener('mouseup', RemoveDrawRectAction)
        } else {
          // 新增一个 rect 标注
          AddNewRect(startP, label)
        }
      } else {
        // 新增一个 rect 标注
        AddNewRect(startP, label)
      }
    },

    // 鼠标左键擦除路径点事件
    MouseErasePointsCallback (event: MouseEvent): void {
      if (!this.canvas || !this.ctx || !this.eraserCtx || !this.eraserCanvas) {
        return
      }

      this.UpdateCanvas()

      const ctx = this.ctx
      const eraserCtx = this.eraserCtx
      const canvas = this.canvas
      const eraserCanvas = this.eraserCanvas

      const translationPoint = (p: Point, radius: number): Point => {
        return [p[0] + radius / 2 + 0.5, p[1] + radius / 2 + 0.5]
      }
      const MergeBbox = (bbox: number[], p: Point): void => {
        bbox[0] = Math.min(bbox[0], p[0])
        bbox[1] = Math.min(bbox[1], p[1])
        bbox[2] = Math.max(bbox[2], p[0])
        bbox[3] = Math.max(bbox[3], p[1])
      }

      let p = this.GetPointsPositionInCanvas(event, this.canvas)
      p = translationPoint(p, store.getters.eraserRadius)
      let imgP = this.ImagePositionPoint(p)

      // canvas橡皮檫设置
      ctx.lineWidth = store.getters.eraserRadius
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.01)'
      // eraserCanvas橡皮檫设置
      eraserCtx.lineWidth = store.getters.eraserRadius / this.scale
      eraserCtx.lineCap = 'round'
      eraserCtx.lineJoin = 'round'
      eraserCtx.strokeStyle = 'rgba(255, 0, 0)'
      eraserCtx.clearRect(0, 0, this.imgWidth, this.imgHeight)

      const DrawEraserCircle = (
        ctxT: CanvasRenderingContext2D,
        p: Point,
        radius: number,
        color: string
      ): void => {
        ctxT.beginPath()
        ctxT.fillStyle = color
        ctxT.arc(p[0], p[1], radius / 2, 0, 2 * Math.PI)
        ctxT.fill()
      }

      // 主画布 canvas 绘制
      DrawEraserCircle(ctx, p, ctx.lineWidth, ctx.strokeStyle)
      ctx.beginPath()
      ctx.moveTo(p[0], p[1])
      ctx.stroke()
      // 橡皮檫画布 eraserCanvas 同步绘制
      DrawEraserCircle(
        eraserCtx,
        imgP,
        eraserCtx.lineWidth,
        eraserCtx.strokeStyle
      )
      eraserCtx.beginPath()
      eraserCtx.moveTo(imgP[0], imgP[1])
      eraserCtx.stroke()

      // bbox: xmin, ymin, xmax, ymax
      const bbox = [eraserCanvas.width + 1, eraserCanvas.height + 1, -1, -1]
      MergeBbox(bbox, imgP)

      const EraserAction = (event: MouseEvent): void => {
        p = this.GetPointsPositionInCanvas(event, canvas)
        p = translationPoint(p, store.getters.eraserRadius)
        ctx.lineTo(p[0], p[1])
        ctx.stroke()
        imgP = this.ImagePositionPoint(p)
        eraserCtx.lineTo(imgP[0], imgP[1])
        eraserCtx.stroke()
        MergeBbox(bbox, imgP)
      }

      const GetErasedPointFlagInLine = (
        eraseArea: ImageData,
        oldLine: Array<Point>,
        bboxXYWH: Array<number>
      ): Array<number> => {
        const [x, y, width, height] = bboxXYWH
        let eraseFlag: Array<number> = new Array(oldLine.length + 2).fill(1)
        eraseFlag[0] = 0
        eraseFlag[oldLine.length + 1] = 0
        let flag = true
        for (let i = 0; i < oldLine.length; i++) {
          const p = oldLine[i]
          if (
            p[0] >= x &&
            p[0] <= x + width - 1 &&
            p[1] >= y &&
            p[1] <= y + height - 1
          ) {
            const t = Math.floor(p[1] - y) * width + Math.floor(p[0] - x)
            if (eraseArea.data[4 * t] > 0) {
              eraseFlag[i + 1] = 0
              flag = false
            }
          }
        }
        if (flag) {
          eraseFlag = []
        }
        return eraseFlag
      }

      const GetNewLinesWidthEraseLine = (
        oldLine: Point[],
        eraseFlag: number[]
      ): Array<Point[]> => {
        const newLines: Array<Point[]> = []
        let newLine = []
        for (let i = 1; i < eraseFlag.length; i++) {
          if (eraseFlag[i] === 1) {
            if (eraseFlag[i - 1] === 0) {
              newLine = []
            }
            newLine.push(oldLine[i - 1])
          } else {
            if (eraseFlag[i - 1] === 1) {
              newLines.push(newLine)
            }
          }
        }
        return newLines
      }

      const ClearPointsInLine = (
        oldLine: Array<Point>,
        eraseArea: ImageData,
        bboxXYWH: Array<number>
      ): Array<Array<Point>> => {
        let newLines: Array<Array<Point>> = []
        const eraseLine: Array<number> = GetErasedPointFlagInLine(
          eraseArea,
          oldLine,
          bboxXYWH
        )
        if (eraseLine.length === 0) {
          newLines.push(oldLine)
        } else {
          newLines = GetNewLinesWidthEraseLine(oldLine, eraseLine)
        }
        return newLines
      }

      const ClearPointsInLines = (
        oldLines: Array<Array<Point>>,
        eraseArea: ImageData,
        bboxXYWH: Array<number>
      ): Array<Array<Point>> => {
        const newLines: Array<Array<Point>> = []
        oldLines.forEach(oldLine => {
          const lines = ClearPointsInLine(oldLine, eraseArea, bboxXYWH)
          newLines.push(...lines)
        })
        return newLines
      }

      const ClearPointsInCircleLine = (
        oldLine: Array<Point>,
        eraseArea: ImageData,
        bboxXYWH: Array<number>
      ): Array<Array<Point>> => {
        let newLines: Array<Array<Point>> = []
        const eraseLine: Array<number> = GetErasedPointFlagInLine(
          eraseArea,
          oldLine,
          bboxXYWH
        )
        if (eraseLine.length > 0) {
          newLines = GetNewLinesWidthEraseLine(oldLine, eraseLine)
          if (eraseLine[1] === 1) {
            // 起点没有被擦除
            const lastLine = newLines[newLines.length - 1]
            const firstLine = newLines[0]
            newLines.splice(0, 1)
            firstLine.splice(0, 1)
            lastLine.push(...firstLine)
          }
        } else {
          newLines.push(oldLine)
        }
        return newLines
      }

      const ClearPointsInAnnotation = (
        annotations: Annotation[],
        index: number,
        bboxXYXY: Array<number>,
        eraserCtx: CanvasRenderingContext2D
      ): number => {
        if (index === -1 || annotations[index].type !== 'Polygon') return index
        const x = Math.floor(bboxXYXY[0] - eraserCtx.lineWidth - 1)
        const y = Math.floor(bboxXYXY[1] - eraserCtx.lineWidth - 1)
        const width = Math.floor(
          bboxXYXY[2] - bboxXYXY[0] + 2 * eraserCtx.lineWidth + 2
        )
        const height = Math.floor(
          bboxXYXY[3] - bboxXYXY[1] + 2 * eraserCtx.lineWidth + 2
        )
        const eraseArea = eraserCtx.getImageData(x, y, width, height)
        const bboxXYWH = [x, y, width, height]
        const annotation = annotations[index] as PolygonAnnotation
        if (
          annotation.lines.length === 0 &&
          annotation.coordinates.length > 0
        ) {
          const newLines = ClearPointsInCircleLine(
            annotation.coordinates[0],
            eraseArea,
            bboxXYWH
          )
          if (
            newLines.length === 1 &&
            newLines[0].length === annotation.coordinates[0].length
          ) {
            console.log('erase no thing')
          } else if (newLines.length === 0) {
            this.DeleteAnnotationWidthIndex(annotations, index)
          } else {
            annotation.lines = newLines
            annotation.coordinates = []
            this.UpdateAnnotationsRingTypeWithDelete(annotations, index)
            annotation.ringType = RingType.NONE
            annotation.innerRingIDs = new Set<number>()
            annotation.outerRingId = -1
          }
        } else if (annotation.lines.length > 0) {
          annotation.lines = ClearPointsInLines(
            annotation.lines,
            eraseArea,
            bboxXYWH
          )
          if (annotation.lines.length === 0) {
            annotations.splice(index, 1)
            index = -1
          }
        }
        return index
      }

      const RemoveEraserAction = (): void => {
        eraserCtx.closePath()
        ctx.closePath()
        ctx.lineCap = 'butt'
        ctx.lineJoin = 'miter'
        ctx.lineWidth = store.getters.lineWidth
        this.RevokeUndoContent()
        this.annotationIndex = ClearPointsInAnnotation(
          store.state.annotations,
          this.annotationIndex,
          bbox,
          eraserCtx
        )
        this.RevokeRedoContent()
        this.UpdateCanvas()
        this.SaveAnnotations()
        canvas.removeEventListener('mousemove', EraserAction)
        canvas.removeEventListener('mouseup', RemoveEraserAction)
      }
      this.canvas.addEventListener('mousemove', EraserAction)
      this.canvas.addEventListener('mouseup', RemoveEraserAction)
    },

    // 鼠标左键绘制普通曲线事件
    MouseDrawAreaCallback (event: MouseEvent): void {
      const { label } = store.getters
      if (!label || !this.canvas || !this.ctx) return

      // 绘制前的准备
      this.SetLabelAndIndexBeforeDraw(label)
      this.UpdateCanvas()

      const ctx = this.ctx
      const canvas = this.canvas
      ctx.strokeStyle = label.color
      ctx.fillStyle = label.color
      const startP = this.GetPointsPositionInCanvas(event, this.canvas)
      let moveP: Point = [0, 0]
      const linePoints: Point[] = []
      this.DrawCircle(ctx, startP, store.getters.radius * 0.75)
      ctx.beginPath()
      ctx.moveTo(startP[0], startP[1])
      const DrawAreaAction = (event: MouseEvent): void => {
        moveP = this.GetPointsPositionInCanvas(event, canvas)
        ctx.lineTo(moveP[0], moveP[1])
        ctx.stroke()
        linePoints.push(this.ImagePositionPoint(moveP))
        if (this.Distance(startP, moveP) < store.getters.radius) {
          canvas.style.cursor = "url('/static/cursor_target2.png'), pointer"
        }
      }
      const RemoveDrawAreaAction = (): void => {
        ctx.closePath()
        this.RevokeUndoContent()
        this.annotationIndex = this.UpdateNewPolygon(
          store.state.annotations,
          this.annotationIndex,
          linePoints,
          label
        )
        this.RevokeRedoContent()
        this.UpdateCanvas()
        this.SaveAnnotations()
        canvas.removeEventListener('mousemove', DrawAreaAction)
        canvas.removeEventListener('mouseup', RemoveDrawAreaAction)
      }
      canvas.addEventListener('mousemove', DrawAreaAction)
      canvas.addEventListener('mouseup', RemoveDrawAreaAction)
    },

    // 鼠标左键绘制智能剪刀曲线事件
    MouseStartISCurveCallback (event: MouseEvent): void {
      if (!this.canvas) return
      const { label } = store.getters
      const startP = this.GetPointsPositionInCanvas(event, this.canvas)

      if (this.inSciStartPoint[0] !== -1 && this.inSciCurvePoints.length >= 0) {
        this.RevokeUndoContent()
        const annotations = store.state.annotations
        this.annotationIndex = this.UpdateNewPolygon(
          annotations,
          this.annotationIndex,
          this.inSciCurvePoints,
          label
        )
        this.inSciCurvePoints = []
        this.inSciStartPoint = [-1, -1]
        this.RevokeRedoContent()
        this.UpdateCanvas()
        this.SaveAnnotations()

        // 标注封闭，结束状态
        if (
          this.annotationIndex !== -1 &&
          this.annotationIndex < annotations.length &&
          annotations[this.annotationIndex].type === 'Polygon'
        ) {
          const annotation = annotations[
            this.annotationIndex
          ] as PolygonAnnotation
          if (
            annotation.lines.length === 0 &&
            annotation.coordinates.length > 0
          ) {
            this.MouseEndISCurveCallback()
            return
          }
        }
      }
      this.UpdateBufferCanvas()
      this.UpdateCanvas(0)
      // 绘制起始圆点
      this.inSciStartPoint = this.ImagePositionPoint(startP)
      // this.inSciCurvePoints.push(this.ImagePositionPoint(startP))
      if (!this.ctx) return
      this.ctx.lineWidth = store.getters.lineWidth
      this.ctx.strokeStyle = label.color
      this.ctx.fillStyle = label.color
      this.DrawCircle(this.ctx, startP, store.getters.radius * 0.75)
    },

    // 鼠标右键取消绘制智能剪刀曲线事件
    MouseEndISCurveCallback (): void {
      this.inSciCurvePoints = []
      this.inSciStartPoint = [-1, -1]
      this.UpdateCanvas()
    },

    // 鼠标左键使用graphCut事件
    MouseGraphCutCallback (event: MouseEvent): void {
      if (!this.canvas || !this.ctx) return
      if (this.graphCut.status === 0) return
      const ctx = this.ctx
      const canvas = this.canvas
      const oldStyle = {
        lineWidth: ctx.lineWidth,
        strokeStyle: ctx.strokeStyle,
        fillStyle: ctx.fillStyle
      }
      ctx.lineWidth = this.graphCut.lineWidth
      ctx.strokeStyle =
        this.graphCut.status === 1
          ? this.graphCut.frontColor
          : this.graphCut.backColor
      const startP = this.GetPointsPositionInCanvas(event, this.canvas)
      let moveP: Point = [0, 0]
      const linePoints: Point[] = []
      ctx.beginPath()
      ctx.moveTo(startP[0], startP[1])
      const DrawLineAction = (event: MouseEvent): void => {
        moveP = this.GetPointsPositionInCanvas(event, canvas)
        ctx.lineTo(moveP[0], moveP[1])
        ctx.stroke()
        linePoints.push(this.ImagePositionPoint(moveP))
      }
      const RemoveDrawLineAction = (): void => {
        ctx.closePath()
        ctx.lineWidth = oldStyle.lineWidth
        ctx.strokeStyle = oldStyle.strokeStyle
        ctx.fillStyle = oldStyle.fillStyle
        if (this.graphCut.status === 1) {
          this.graphCut.frontPts = this.Deduplication(linePoints)
        } else if (this.graphCut.status === 2) {
          this.graphCut.backPts = this.Deduplication(linePoints)
        }
        this.UpdateCanvas()
        canvas.removeEventListener('mousemove', DrawLineAction)
        canvas.removeEventListener('mouseup', RemoveDrawLineAction)
      }
      canvas.addEventListener('mousemove', DrawLineAction)
      canvas.addEventListener('mouseup', RemoveDrawLineAction)
    },

    MouseGraphCutCallback2 (event: MouseEvent): void {
      const graphCutMode = store.getters.graphCutMode
      if (graphCutMode === GraphCutOpMode.Rect) {
        this.MouseDrawGraphCutRect(event)
      }
    },

    // 键盘事件
    CanvasKeyDownCallback (event: KeyboardEvent): void {
      if (!this.image) return
      if (event.key === 'Backspace') {
        this.BackspaceKeyDownCallback()
      } else if (event.key === '') {
        console.log('event key')
      }
    },

    // 退格键用于删除某个标注
    BackspaceKeyDownCallback (): void {
      const { mode } = store.state
      if (mode === OpMode.Select) {
        if (
          this.annotationIndex >= 0 &&
          this.annotationIndex < store.state.annotations.length
        ) {
          this.RevokeUndoContent()
          this.DeleteAnnotation(this.annotationIndex)
          if (this.selectIndex === this.annotationIndex) {
            this.selectIndex = -1
          }
          this.annotationIndex = -1
          this.RevokeRedoContent()
          this.UpdateCanvas()
          this.UpdateSelectMask()
          this.SaveAnnotations()
        }
      }
    },

    // 画线绘制前准备label
    SetLabelAndIndexBeforeDraw (label: Label): void {
      if (this.selectIndex !== -1) {
        this.annotationIndex = this.selectIndex
      } else if (this.annotationIndex !== -1) {
        if (
          this.annotationIndex >= 0 &&
          this.annotationIndex < store.state.annotations.length
        ) {
          const annotation = store.state.annotations[this.annotationIndex]
          if (annotation.tag !== label.id) {
            this.annotationIndex = -1
          }
        }
      }
      this.LabelChangeWithAnnotationSelect(this.annotationIndex)
    },

    // ===================== canvas 更新  ===================

    // 创建辅助canvas
    BuildCanvas (
      canvasName: string,
      width: number,
      height: number
    ): HTMLCanvasElement {
      const canvas0 = document.querySelector(
        '.' + canvasName
      ) as HTMLCanvasElement
      if (canvas0) {
        document.body.removeChild(canvas0)
      }
      const canvas = document.createElement('canvas') as HTMLCanvasElement
      canvas.width = width
      canvas.height = height
      canvas.style.display = 'none'
      canvas.className = canvasName
      return canvas
    },

    // 设置canvas当前的图片
    SetCanvasImage (): void {
      if (!this.image || !this.canvas) {
        return
      }

      // 设置图片和画布的宽高
      this.imgWidth = this.image.width
      this.imgHeight = this.image.height
      this.canvasWidth = this.canvas.clientWidth
      this.canvasHeight = this.canvas.clientHeight

      // 加载缓冲画布
      this.bufferCanvas = this.BuildCanvas(
        'bufferCanvas',
        this.imgWidth,
        this.imgHeight
      )
      this.bufferCtx = this.bufferCanvas.getContext('2d')

      // 加载橡皮檫画布
      this.eraserCanvas = this.BuildCanvas(
        'eraseCanvas',
        this.imgWidth,
        this.imgHeight
      )
      this.eraserCtx = this.eraserCanvas.getContext('2d')

      // 加载填充画布
      this.fillCanvas = this.BuildCanvas(
        'fillCanvas',
        this.imgWidth,
        this.imgHeight
      )
      this.fillCtx = this.fillCanvas.getContext('2d')

      // 加载选择画布
      this.selectMaskCanvas = this.BuildCanvas(
        'selectMaskCanvas',
        this.imgWidth,
        this.imgHeight
      )
      this.selectMaskCtx = this.selectMaskCanvas.getContext('2d')

      // 根据图片尺寸调整图片缩放和位置
      if (this.scale <= 0) {
        this.AdaptiveCanvasSize()
        this.minScale = this.scale
        this.maxScale = this.scale * 10
      }
      this.UpdateCanvas()
    },

    // 缩放后更新画布中的元素
    UpdateCanvasForRescale (p: Point, newScale: number): void {
      const newX = ((this.imgX - p[0]) * newScale) / this.scale + p[0]
      const newY = ((this.imgY - p[1]) * newScale) / this.scale + p[1]
      this.scale = newScale
      this.SetImageXY(newX, newY)
      this.UpdateCanvas(0)
      this.UpdateScaleCanvas()
    },

    // 拖拽图片后更新画布
    UpdateCanvasForTransform (offsetX: number, offsetY: number): void {
      const newX = this.imgX + offsetX
      const newY = this.imgY + offsetY
      this.SetImageXY(newX, newY)
      this.UpdateCanvas(0)
      this.UpdateScaleCanvas()
    },

    // ------------------- Polygon annotation 处理 ------------

    // 修改polygon
    UpdateNewPolygon (
      annotations: Annotation[],
      annotationIndex: number,
      linePoints: Array<Point>,
      label: Label
    ): number {
      if (
        annotationIndex === -1 ||
        (annotationIndex !== -1 &&
          annotationIndex < annotations.length &&
          annotations[annotationIndex].type !== 'Polygon') ||
        (annotationIndex !== -1 &&
          annotations[annotationIndex].tag !== label.id)
      ) {
        annotationIndex = this.AddNewPolygon(annotations, label)
      }
      let annotation = annotations[annotationIndex] as PolygonAnnotation
      if (
        annotation.lines.length === 0 &&
        annotation.coordinates.length !== 0
      ) {
        annotationIndex = this.AddNewPolygon(annotations, label)
        annotation = annotations[annotationIndex] as PolygonAnnotation
      }
      const flag = this.AddNewLineToPolygon(annotation, linePoints)
      if (!flag) {
        annotations.splice(annotationIndex, 1)
        annotationIndex = -1
      }
      return annotationIndex
    },

    // 增加一个新的polygon
    AddNewPolygon (annotations: Annotation[], label: Label): number {
      const annotation = {} as PolygonAnnotation
      const index = annotations.length
      annotation.type = 'Polygon'
      const maxId = this.FindMaxIdInAnnotations(annotations)
      annotation.id = maxId === -1 ? 1 : maxId + 1
      annotation.tag = label.id
      const idx = annotations.findIndex(item => item.tag === label.id)
      annotation.isFill = idx !== -1 ? annotations[idx].isFill : false
      annotation.isShow = true
      annotation.coordinates = []
      annotation.lines = []
      annotation.bbox = [Number.MAX_VALUE, Number.MAX_VALUE, -1, -1]
      annotation.ringType = RingType.NONE
      annotation.innerRingIDs = new Set<number>()
      annotation.outerRingId = -1
      annotation.isLevelSet = false
      annotations.push(annotation)
      return index
    },

    // 在 annotations 查找到最大的 标注id
    FindMaxIdInAnnotations (annotations: Annotation[]): number {
      let maxId = -1
      annotations.forEach(annotation => {
        if (annotation.id > maxId) maxId = annotation.id
      })
      return maxId
    },

    // 往 polygon 中 增加一条曲线
    AddNewLineToPolygon (
      annotation: PolygonAnnotation,
      linePoints: Point[]
    ): boolean {
      let flag = true
      try {
        const lineBbox = this.GetBBox(linePoints)
        const bboxArea =
          Math.abs(lineBbox[2] - lineBbox[0]) *
          Math.abs(lineBbox[3] - lineBbox[1]) *
          this.scale
        const distance =
          this.Distance(linePoints[0], linePoints[linePoints.length - 1]) *
          this.scale
        if (
          distance > store.getters.radius ||
          bboxArea > store.getters.radius * 2
        ) {
          this.AddLineToPolygonAnnotation(annotation, linePoints)
        }
      } catch (e) {
        if (annotation.lines.length === 0) {
          flag = false
        }
      } finally {
        if (
          annotation.lines.length === 0 &&
          annotation.coordinates.length === 0
        ) {
          flag = false
        }
      }
      return flag
    },

    // 增加曲线到一个polygon annotation中
    AddLineToPolygonAnnotation (
      annotation: PolygonAnnotation,
      linePoints: Array<Point>
    ): void {
      const startP = linePoints[0]
      const endP = linePoints[linePoints.length - 1]
      const indexStart = this.FindEndPoint(startP, annotation)
      const indexEnd = this.FindEndPoint(endP, annotation)
      if (indexStart[0] !== -1 && indexEnd[0] !== -1) {
        if (indexStart[0] === indexEnd[0]) {
          const linePointsPre: Point[] = annotation.lines[indexStart[0]]
          if (linePointsPre.length > linePoints.length) {
            if (indexStart[1] === 0) {
              linePoints.reverse()
            }
            linePointsPre.push(...linePoints)
            annotation.lines[indexStart[0]] = linePointsPre
          } else {
            if (indexStart[1] === 0) {
              linePointsPre.reverse()
            }
            linePoints.push(...linePointsPre)
            annotation.lines[indexStart[0]] = linePoints
          }
          // 得到一个封闭的曲线集
          this.SetSealPolygonAnnotation(
            annotation,
            annotation.lines[indexStart[0]]
          )
          return
        } else {
          const linePointsPrev = annotation.lines[indexStart[0]]
          const linePointsNext = annotation.lines[indexEnd[0]]
          if (indexStart[1] === 0 && indexEnd[1] === 0) {
            linePointsPrev.reverse()
            linePointsPrev.push(...linePoints)
            linePointsPrev.push(...linePointsNext)
            annotation.lines.splice(indexEnd[0], 1)
          } else if (indexStart[1] === 0 && indexEnd[1] !== 0) {
            linePoints.reverse()
            linePointsNext.push(...linePoints)
            linePointsNext.push(...linePointsPrev)
            annotation.lines.splice(indexStart[0], 1)
          } else if (indexStart[1] !== 0 && indexEnd[1] === 0) {
            linePointsPrev.push(...linePoints)
            linePointsPrev.push(...linePointsNext)
            annotation.lines.splice(indexEnd[0], 1)
          } else {
            linePointsNext.reverse()
            linePointsPrev.push(...linePoints)
            linePointsPrev.push(...linePointsNext)
            annotation.lines.splice(indexEnd[0], 1)
          }
        }
      } else if (indexStart[0] !== -1) {
        const linePointsPre = annotation.lines[indexStart[0]]
        if (indexStart[1] === 0) {
          if (linePointsPre.length > linePoints.length) {
            linePointsPre.reverse()
            linePointsPre.push(...linePoints)
          } else {
            linePoints.reverse()
            linePoints.push(...linePointsPre)
            annotation.lines[indexStart[0]] = linePoints
          }
        } else {
          linePointsPre.push(...linePoints)
        }
      } else if (indexEnd[0] !== -1) {
        const linePointsPre = annotation.lines[indexEnd[0]]
        if (indexEnd[1] === 0) {
          linePoints.push(...linePointsPre)
          annotation.lines[indexEnd[0]] = linePoints
        } else {
          if (linePointsPre.length > linePoints.length) {
            linePoints.reverse()
            linePointsPre.push(...linePoints)
          } else {
            linePointsPre.reverse()
            linePoints.push(...linePointsPre)
            annotation.lines[indexEnd[0]] = linePoints
          }
        }
      } else {
        if (this.Distance(startP, endP) * this.scale <= store.getters.radius) {
          this.SetSealPolygonAnnotation(annotation, linePoints)
          return
        } else {
          annotation.lines.push(linePoints)
        }
      }
      annotation.bbox = this.GetNewBBoxWithLine(annotation.bbox, linePoints)
    },

    // 封闭曲线点集
    SetSealPolygonAnnotation (
      annotation: PolygonAnnotation,
      linePoints: Array<Point>
    ): void {
      annotation.coordinates = []
      annotation.coordinates.push(linePoints)
      annotation.coordinates[0] = this.Deduplication(annotation.coordinates[0])
      annotation.coordinates[0] = Interpolation(annotation.coordinates[0])
      annotation.bbox = this.GetBBox(annotation.coordinates[0])
      annotation.lines = []
      this.SetAnnotationRingType(store.state.annotations, annotation)
      if (store.getters.useLevelSet) {
        store.dispatch('useLevelSetForAnnotation', annotation)
      }
    },

    // 在annotation中查找端点
    FindEndPoint (point: Point, annotation: PolygonAnnotation): number[] {
      const p = point
      const index = [-1, -1]
      for (let i = 0; i < annotation.lines.length; i++) {
        const line = annotation.lines[i]
        if (this.Distance(p, line[0]) * this.scale <= store.getters.radius) {
          index[0] = i
          index[1] = 0
          return index
        } else if (
          this.Distance(p, line[line.length - 1]) * this.scale <=
          store.getters.radius
        ) {
          index[0] = i
          index[1] = line.length - 1
          return index
        }
      }
      return index
    },

    // 封闭曲线
    SealLine (points: Point[]): Point[] {
      const newPoints = [...points]
      const pStart = this.CanvasPositionPoint(points[0])
      const pEnd = this.CanvasPositionPoint(points[points.length - 1])
      if (this.Distance(pStart, pEnd) >= 1) {
        const endP: Point = [pStart[0], pStart[1]]
        newPoints.push(this.ImagePositionPoint(endP))
      }
      return newPoints
    },

    // 取整（四舍五入）和 去重
    Deduplication (points: Array<[number, number]>): Array<[number, number]> {
      const newPoints: Array<[number, number]> = []
      points.forEach(point => {
        let x = Math.round(point[0])
        let y = Math.round(point[1])
        x = x < this.imgWidth ? x : this.imgWidth
        y = y < this.imgHeight ? y : this.imgHeight
        const newPoint: [number, number] = [x, y]
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
    },

    // 设置标注的环类型
    SetAnnotationRingType (
      annotations: Annotation[],
      annotation: PolygonAnnotation
    ): void {
      if (annotation.ringType !== RingType.NONE) return
      // 作为子节点找到父亲
      let outerId = -1
      const innerIds = []
      const innerIndices = []
      for (let i = 0; i < annotations.length; i++) {
        if (
          annotations[i].type !== 'Polygon' ||
          annotations[i].id === annotation.id
        ) {
          continue
        }
        const annotationT = annotations[i] as PolygonAnnotation
        if (
          annotationT.ringType === RingType.NORMAL ||
          annotationT.ringType === RingType.OUTER
        ) {
          outerId = this.FindOuterRing(annotations, annotation, annotationT)
          if (outerId !== -1) {
            break
          } else {
            if (this.IsOuterRing(annotation, annotationT)) {
              innerIds.push(annotationT.id)
              innerIndices.push(i)
            }
          }
        }
      }
      if (outerId !== -1) {
        const annotationOuter = annotations.find(
          item => item.id === outerId
        ) as PolygonAnnotation
        if (annotationOuter.innerRingIDs.size === 0) {
          // 仅作为内环
          annotationOuter.innerRingIDs.add(annotation.id)
          annotation.outerRingId = annotationOuter.id
          let ringType = RingType.INNER
          if (
            annotation.tag === annotationOuter.tag &&
            annotationOuter.ringType !== RingType.CUT
          ) {
            ringType = RingType.CUT
          }
          annotation.ringType = ringType
          if (annotationOuter.ringType === RingType.NORMAL) {
            annotationOuter.ringType = RingType.OUTER
          }
        } else {
          // 考虑既作为内环又作为外环
          annotationOuter.innerRingIDs.add(annotation.id)
          annotation.outerRingId = annotationOuter.id
          annotation.ringType = RingType.INNER
          if (
            annotationOuter.tag === annotation.tag &&
            annotationOuter.ringType !== RingType.CUT
          ) {
            annotation.ringType = RingType.CUT
          }
          for (const id of annotationOuter.innerRingIDs) {
            const index = annotations.findIndex(item => item.id === id)
            const annotationT = annotations[index] as PolygonAnnotation
            if (this.IsOuterRing(annotation, annotationT)) {
              annotationT.outerRingId = annotation.id
              annotation.innerRingIDs.add(annotationT.id)
              annotationOuter.innerRingIDs.delete(annotationT.id)
              let ringType = RingType.INNER
              if (
                annotation.tag === annotationT.tag &&
                annotation.ringType !== RingType.CUT
              ) {
                ringType = RingType.CUT
              }
              this.UpdateAnnotationRingType(annotations, annotationT, ringType)
            }
          }
        }
      } else if (innerIndices.length > 0) {
        // 仅作为外环
        annotation.ringType = RingType.OUTER
        for (let i = 0; i < innerIndices.length; i++) {
          const annotationT = annotations[innerIndices[i]] as PolygonAnnotation
          annotation.innerRingIDs.add(annotationT.id)
          annotationT.outerRingId = annotation.id
          if (annotation.tag === annotationT.tag) {
            this.UpdateAnnotationRingType(
              annotations,
              annotationT,
              RingType.CUT
            )
          } else {
            this.UpdateAnnotationRingType(
              annotations,
              annotationT,
              RingType.INNER
            )
          }
        }
      } else {
        // 仅作为普通环
        annotation.ringType = RingType.NORMAL
      }
    },

    // 找到父节点
    FindOuterRing (
      annotations: Annotation[],
      annotation1: PolygonAnnotation,
      annotation2: PolygonAnnotation
    ): number {
      if (this.IsInnerBBox(annotation1.bbox, annotation2.bbox)) {
        if (annotation2.innerRingIDs.size === 0) {
          if (this.IsInnerAnnotation(annotation1, annotation2)) {
            return annotation2.id
          }
          return -1
        }
        let flag = false
        let idx = -1
        for (const id of annotation2.innerRingIDs) {
          const annotationT = annotations.find(
            item => item.id === id
          ) as PolygonAnnotation
          idx = this.FindOuterRing(annotations, annotation1, annotationT)
          if (idx !== -1) {
            flag = true
            break
          }
        }
        if (flag) return idx
        else {
          if (this.IsInnerAnnotation(annotation1, annotation2)) {
            return annotation2.id
          } else return -1
        }
      }
      return -1
    },

    // 判断第一个标注是否是第二个标注的父节点
    IsOuterRing (
      annotation1: PolygonAnnotation,
      annotation2: PolygonAnnotation
    ): boolean {
      if (this.IsOuterBBox(annotation1.bbox, annotation2.bbox)) {
        if (this.IsInnerAnnotation(annotation2, annotation1)) {
          return true
        }
      }
      return false
    },

    // 判断第一个标注是否被第二个标注包含
    IsInnerAnnotation (
      annotation1: PolygonAnnotation,
      annotation2: PolygonAnnotation
    ): boolean {
      if (!this.selectMaskCtx) return false
      const ctx = this.selectMaskCtx
      ctx.clearRect(0, 0, this.imgWidth, this.imgHeight)
      ctx.lineWidth = 1
      ctx.fillStyle = `rgba(${annotation2.id},${0},${0}, 1)`
      this.FillArea(ctx, annotation2.coordinates[0])
      const bbox = annotation1.bbox
      const width = bbox[2] - bbox[0] + 1
      const height = bbox[3] - bbox[1] + 1
      const bboxArea = ctx.getImageData(bbox[0], bbox[1], width, height)
      let count = 0
      annotation1.coordinates[0].forEach(p => {
        const t =
          Math.floor(p[1] - bbox[1]) * width + Math.floor(p[0] - bbox[0])
        if (bboxArea.data[4 * t] > 0) {
          count += 1
        }
      })
      return count / annotation1.coordinates[0].length > 0.97
    },

    // 标注的环类型更新
    UpdateAnnotationRingType (
      annotations: Annotation[],
      annotation: PolygonAnnotation,
      ringType: RingType
    ): void {
      if (annotation.ringType === ringType) return
      annotation.ringType = ringType
      if (annotation.innerRingIDs.size === 0 && annotation.outerRingId === -1) {
        annotation.ringType = RingType.NORMAL
        return
      }
      for (const id of annotation.innerRingIDs) {
        const annotationT = annotations.find(
          item => item.id === id
        ) as PolygonAnnotation
        if (annotationT.tag === annotation.tag) {
          if (ringType === RingType.CUT) {
            this.UpdateAnnotationRingType(
              annotations,
              annotationT,
              RingType.INNER
            )
          } else if (ringType === RingType.INNER) {
            this.UpdateAnnotationRingType(
              annotations,
              annotationT,
              RingType.CUT
            )
          } else if (ringType === RingType.OUTER) {
            this.UpdateAnnotationRingType(
              annotations,
              annotationT,
              RingType.CUT
            )
          }
        }
      }
    },

    // 当删除某个标注时， 标注集合中的的环类型更新
    UpdateAnnotationsRingTypeWithDelete (
      annotations: Annotation[],
      index: number
    ): void {
      if (annotations[index].type === 'Polygon') {
        const annotation = annotations[index] as PolygonAnnotation
        if (annotation.ringType !== RingType.NORMAL) {
          if (annotation.ringType === RingType.OUTER) {
            for (const id of annotation.innerRingIDs) {
              const annotationT = annotations.find(
                item => item.id === id
              ) as PolygonAnnotation
              annotationT.outerRingId = -1
              this.UpdateAnnotationRingType(
                annotations,
                annotationT,
                RingType.OUTER
              )
            }
          } else if (annotation.ringType === RingType.CUT) {
            const annotationOuter = annotations.find(
              item => item.id === annotation.outerRingId
            ) as PolygonAnnotation
            annotationOuter.innerRingIDs.delete(annotation.id)
            if (
              annotation.innerRingIDs.size === 0 &&
              annotationOuter.innerRingIDs.size === 0 &&
              annotationOuter.ringType === RingType.OUTER
            ) {
              annotationOuter.ringType = RingType.NORMAL
            }
            for (const id of annotation.innerRingIDs) {
              const annotationT = annotations.find(
                item => item.id === id
              ) as PolygonAnnotation
              if (annotation.tag === annotationT.tag) {
                this.UpdateAnnotationRingType(
                  annotations,
                  annotationT,
                  RingType.CUT
                )
              }
              annotationT.outerRingId = annotationOuter.id
              annotationOuter.innerRingIDs.add(annotationT.id)
            }
          } else if (annotation.ringType === RingType.INNER) {
            const annotationOuter = annotations.find(
              item => item.id === annotation.outerRingId
            ) as PolygonAnnotation
            annotationOuter.innerRingIDs.delete(annotation.id)
            if (
              annotation.innerRingIDs.size === 0 &&
              annotationOuter.innerRingIDs.size === 1 &&
              annotationOuter.ringType === RingType.OUTER
            ) {
              annotationOuter.ringType = RingType.NORMAL
            }
            for (const id of annotation.innerRingIDs) {
              const annotationT = annotations.find(
                item => item.id === id
              ) as PolygonAnnotation
              if (annotation.tag === annotationT.tag) {
                this.UpdateAnnotationRingType(
                  annotations,
                  annotationT,
                  RingType.INNER
                )
              } else if (annotationOuter.tag === annotationT.tag) {
                if (annotationOuter.ringType === RingType.INNER) {
                  this.UpdateAnnotationRingType(
                    annotations,
                    annotationT,
                    RingType.CUT
                  )
                } else if (annotationOuter.ringType === RingType.CUT) {
                  this.UpdateAnnotationRingType(
                    annotations,
                    annotationT,
                    RingType.INNER
                  )
                }
              }
              annotationT.outerRingId = annotationOuter.id
              annotationOuter.innerRingIDs.add(annotationT.id)
            }
          }
        }
      }
    },

    // 删除某个标注
    DeleteAnnotation (index: number): void {
      this.UpdateAnnotationsRingTypeWithDelete(store.state.annotations, index)
      if (store.state.useLevelSet) {
        this.DeleteLevelSetAnnotationWidthID(
          store.getters.levelSetAnnotations.annotations,
          store.state.annotations[index].id
        )
      }
      store.state.annotations.splice(index, 1)
    },

    // 根据索引删除某个标注
    DeleteAnnotationWidthIndex (annotations: Annotation[], index: number): void {
      // 修改环状标注间的关系
      this.UpdateAnnotationsRingTypeWithDelete(annotations, index)
      annotations.splice(index, 1)
    },

    // 根据标注id删除某个标注
    DeleteAnnotationWidthID (annotations: Annotation[], id: number): void {
      const index = annotations.findIndex(item => item.id === id)
      if (index !== -1) {
        this.UpdateAnnotationsRingTypeWithDelete(annotations, index)
        annotations.splice(index, 1)
      }
    },

    // 同步删除levelSet标注
    DeleteLevelSetAnnotationWidthID (
      annotations: PolygonAnnotation[],
      id: number
    ): void {
      const index = annotations.findIndex(item => item.id === id)
      if (index !== -1) {
        annotations.splice(index, 1)
      }
    },

    // ------------------- annotation 处理 -----------

    // PolygonAnnotation的深度拷贝
    DeepCopyPolygonAnnotation (
      annotation: PolygonAnnotation
    ): PolygonAnnotation {
      const annotationNew = { ...annotation }
      annotationNew.coordinates = annotation.coordinates.map(item => [...item])
      annotationNew.bbox = [...annotation.bbox]
      annotationNew.innerRingIDs = new Set([...annotation.innerRingIDs])
      annotationNew.lines = annotation.lines.map(item => [...item])
      return annotationNew
    },

    // 深度拷贝
    DeepCopyAnnotations (annotations: Array<Annotation>): Array<Annotation> {
      return annotations.map(annotation => {
        let annotationNew = {} as Annotation
        if (annotation.type === 'Rect') {
          annotationNew = { ...annotation }
        } else if (annotation.type === 'Polygon') {
          annotation = annotation as PolygonAnnotation
          annotationNew = this.DeepCopyPolygonAnnotation(annotation)
        }
        return annotationNew
      })
    },

    // 重置重做和撤销数据
    InitRevokeState (): void {
      this.RevokeUndoContent()
      this.RevokeRedoContent()
    },

    // 记录重做数据
    RevokeUndoContent (): void {
      this.revoke.undo.annotationsImage = this.DeepCopyAnnotations(
        store.state.annotations
      )
      this.revoke.undo.levelSetAnnotations = this.DeepCopyAnnotations(
        store.state.levelSetAnnotations.annotations
      )
      this.revoke.undo.annotationIndex = this.annotationIndex
      this.revoke.flag = true
    },

    // 记录撤销数据
    RevokeRedoContent (): void {
      this.revoke.redo.annotationsImage = this.DeepCopyAnnotations(
        store.state.annotations
      )
      this.revoke.redo.levelSetAnnotations = this.DeepCopyAnnotations(
        store.state.levelSetAnnotations.annotations
      )
      this.revoke.redo.annotationIndex = this.annotationIndex
      this.revoke.flag = true
    },

    // 撤销
    RevokeUndo (): void {
      if (this.revoke.flag) {
        store.state.annotations = this.DeepCopyAnnotations(
          this.revoke.undo.annotationsImage
        )
        store.state.levelSetAnnotations.annotations = this.DeepCopyAnnotations(
          this.revoke.undo.levelSetAnnotations
        ).map(item => {
          return item as PolygonAnnotation
        })
        this.annotationIndex = this.revoke.undo.annotationIndex
        this.revoke.flag = false
        this.UpdateCanvas()
        this.SaveAnnotations()
      }
    },

    // 重做
    RevokeRedo (): void {
      if (!this.revoke.flag) {
        store.state.annotations = this.DeepCopyAnnotations(
          this.revoke.redo.annotationsImage
        )
        store.state.levelSetAnnotations.annotations = this.DeepCopyAnnotations(
          this.revoke.redo.levelSetAnnotations
        ).map(item => {
          return item as PolygonAnnotation
        })
        this.annotationIndex = this.revoke.redo.annotationIndex
        this.revoke.flag = true
        this.UpdateCanvas()
        this.SaveAnnotations()
      }
    },

    // 保存图片标注
    SaveAnnotations (): void {
      store.dispatch('saveSliceAnnotations').catch(err => {
        this.$message.error(err.message)
      })
    },

    // 修改图片在canvas中的大小
    ResizeImageSize (): void {
      this.AdaptiveCanvasSize()
      this.UpdateCanvas()
      this.UpdateScaleCanvas()
    },

    // ===================== canvas 绘制  ===================

    // 绘制圆点
    DrawCircle (
      ctx: CanvasRenderingContext2D,
      point: Point,
      radius: number
    ): void {
      ctx.beginPath()
      ctx.arc(point[0], point[1], radius, 0, 2 * Math.PI)
      ctx.fill()
      ctx.closePath()
    },

    // 绘制环形圆点
    DrawCircleR (
      ctx: CanvasRenderingContext2D,
      point: Point,
      radius: number,
      color: string
    ): void {
      ctx.beginPath()
      ctx.fillStyle = '#000'
      ctx.arc(point[0], point[1], radius, 0, 2 * Math.PI)
      ctx.fill()
      ctx.beginPath()
      ctx.fillStyle = color
      ctx.arc(point[0], point[1], radius / 3, 0, 2 * Math.PI)
      ctx.fill()
    },

    // 绘制矩形角点
    DrawRectCorner (
      ctx: CanvasRenderingContext2D,
      points: Array<Point>,
      radius: number,
      color = '#20c3f9'
    ): void {
      for (let i = 0; i < points.length; i++) {
        const p = points[i]
        this.DrawCircleR(ctx, p, radius, color)
      }
    },

    // 绘制智能剪刀的曲线点
    DrawCurvePoints (ctx: CanvasRenderingContext2D, points: Array<Point>): void {
      const line = this.CanvasPositionPoints(
        points.map((item: number[]) => [item[0], item[1]])
      )
      this.DrawArea(ctx, line, false)
      const endP = line[line.length - 1]
      this.DrawCircle(ctx, endP, store.getters.radius * 0.75)
    },

    // 绘制不规则区域
    DrawArea (
      ctx: CanvasRenderingContext2D,
      points: Array<Point>,
      isFill: boolean
    ): void {
      if (points.length <= 0) return
      const pStart = points[0]
      ctx.beginPath()
      ctx.moveTo(pStart[0], pStart[1])
      for (let i = 1; i < points.length; i++) {
        const p = points[i]
        ctx.lineTo(p[0], p[1])
      }
      ctx.stroke()
      if (isFill) {
        ctx.fill()
      }
      ctx.closePath()
    },

    // 使用虚线绘制不规则区域
    DrawDottedLineArea (
      ctx: CanvasRenderingContext2D,
      points: Array<Point>
    ): void {
      if (points.length <= 0) return
      const len = points.length
      const s = Math.floor(len / 10)
      for (let i = 0; i <= s && i * 10 < points.length; i++) {
        const pStart = points[i * 10]
        ctx.beginPath()
        ctx.moveTo(pStart[0], pStart[1])
        for (let j = 1; j < 5 && i * 10 + j < points.length; j++) {
          const p = points[i * 10 + j]
          ctx.lineTo(p[0], p[1])
        }
        ctx.stroke()
        ctx.closePath()
      }
    },

    // 填充不规则区域
    FillArea (ctx: CanvasRenderingContext2D, points: Array<Point>): void {
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
    },

    // 仅绘制单个标注
    DrawAnnotation (
      ctx: CanvasRenderingContext2D,
      annotation: Annotation,
      canvasType: CanvasType = CanvasType.MAIN
    ): void {
      if (annotation.type === 'Rect' && annotation.isShow) {
        this.DrawRectAnnotation(ctx, annotation, canvasType)
      } else if (annotation.type === 'Polygon') {
        if (annotation.isShow) {
          this.DrawPolygonAnnotation(ctx, annotation, canvasType)
        } else {
          this.DrawPolygonAnnotationUnShow(ctx, annotation, canvasType)
        }
      }
    },

    // 绘制矩形框标注
    DrawRectAnnotation (
      ctx: CanvasRenderingContext2D,
      annotation: RectAnnotation,
      canvasType: CanvasType = CanvasType.MAIN
    ): void {
      const label = (store.getters.labels as Label[]).find(
        item => item.id === annotation.tag
      )
      ctx.strokeStyle = label ? label.color : '#ffffff'
      let p1 = []
      let p2 = []
      if (canvasType === CanvasType.MAIN) {
        p1 = this.CanvasPositionPoint([
          annotation.coordinates[0][0],
          annotation.coordinates[0][1]
        ])
        p2 = this.CanvasPositionPoint([
          annotation.coordinates[2][0],
          annotation.coordinates[2][1]
        ])
      } else {
        p1 = annotation.coordinates[0]
        p2 = annotation.coordinates[2]
      }
      ctx.strokeRect(p1[0], p1[1], p2[0] - p1[0], p2[1] - p1[1])
    },

    // 绘制多边形标注
    DrawPolygonAnnotation (
      ctx: CanvasRenderingContext2D,
      annotation: PolygonAnnotation,
      canvasType: CanvasType = CanvasType.MAIN
    ): void {
      const label = (store.getters.labels as Label[]).find(
        item => item.id === annotation.tag
      )
      ctx.strokeStyle = label ? label.color : '#ffffff'
      ctx.fillStyle = ctx.strokeStyle
      if (annotation.lines.length > 0) {
        if (!annotation.isShow) return
        annotation.lines.forEach(line => {
          let points: Point[] = []
          let radius = store.getters.radius * 0.75
          if (canvasType === CanvasType.MAIN) {
            points = this.CanvasPositionPoints(
              line.map((item: number[]) => [item[0], item[1]])
            )
          } else {
            points = line
            radius = radius / this.scale
          }
          this.DrawCircle(ctx, points[0], radius)
          this.DrawArea(ctx, points, false)
          this.DrawCircle(ctx, points[points.length - 1], radius)
        })
      } else if (annotation.coordinates.length > 0) {
        if (!annotation.isShow) return
        let points: Array<[number, number]> = []
        if (canvasType === CanvasType.MAIN) {
          points = this.CanvasPositionPoints(
            annotation.coordinates[0].map((item: number[]) => [
              item[0],
              item[1]
            ])
          )
        } else {
          points = annotation.coordinates[0]
        }
        if (annotation.isLevelSet) {
          this.DrawDottedLineArea(ctx, points)
        } else {
          this.DrawArea(ctx, points, false)
        }
      }
    },

    // 绘制isShow=false的子标注
    DrawPolygonAnnotationUnShow (
      ctx: CanvasRenderingContext2D,
      annotation: PolygonAnnotation,
      canvasType: CanvasType = CanvasType.MAIN
    ): void {
      if (annotation.outerRingId !== -1) {
        const annotationOuter = store.state.annotations.find(
          item => item.id === annotation.outerRingId
        ) as PolygonAnnotation
        if (
          annotationOuter.isShow &&
          annotationOuter.ringType !== RingType.CUT
        ) {
          const label = (store.getters.labels as Label[]).find(
            item => item.id === annotationOuter.tag
          )
          ctx.strokeStyle = label ? label.color : '#ffffff'
          ctx.fillStyle = ctx.strokeStyle
          let points: Array<[number, number]> = []
          if (canvasType === CanvasType.MAIN) {
            points = this.CanvasPositionPoints(
              annotation.coordinates[0].map((item: number[]) => [
                item[0],
                item[1]
              ])
            )
          } else {
            points = annotation.coordinates[0]
          }
          if (annotation.isLevelSet) {
            this.DrawDottedLineArea(ctx, points)
          } else {
            this.DrawArea(ctx, points, false)
          }
        }
      }
    },

    // 绘制annotation的包围盒
    DrawAnnotationBBox (
      ctx: CanvasRenderingContext2D,
      annotation: PolygonAnnotation,
      canvasType: CanvasType = CanvasType.MAIN
    ): void {
      const label = (store.getters.labels as Label[]).find(
        item => item.id === annotation.tag
      )
      ctx.strokeStyle = label ? label.color : '#ffffff'
      if (canvasType === CanvasType.MAIN) {
        const p1 = this.CanvasPositionPoint([
          annotation.bbox[0],
          annotation.bbox[1]
        ])
        const p2 = this.CanvasPositionPoint([
          annotation.bbox[2],
          annotation.bbox[3]
        ])
        ctx.strokeRect(p1[0], p1[1], p2[0] - p1[0], p2[1] - p1[1])
      } else {
        const p1 = [annotation.bbox[0], annotation.bbox[1]]
        const p2 = [annotation.bbox[2], annotation.bbox[3]]
        ctx.strokeRect(p1[0], p1[1], p2[0] - p1[0], p2[1] - p1[1])
      }
    },

    // 绘制rect 的四个角点
    DrawRectCornerBBox (
      ctx: CanvasRenderingContext2D,
      annotation: RectAnnotation,
      canvasType: CanvasType = CanvasType.MAIN
    ): void {
      let points: Array<Point> = []
      let radius = store.getters.radius
      if (canvasType === CanvasType.MAIN) {
        points = this.CanvasPositionPoints(annotation.coordinates)
      } else {
        points = annotation.coordinates
        radius = store.getters.radius / this.scale
      }
      this.DrawRectCorner(ctx, points, radius)
    },

    // 填充单个标注
    FillAnnotation (
      ctx: CanvasRenderingContext2D,
      annotation: Annotation
    ): void {
      if (annotation.type === 'Rect') {
        if (annotation.isShow && annotation.isFill) {
          this.FillRectAnnotation(ctx, annotation)
        }
      } else if (annotation.type === 'Polygon') {
        if (
          annotation.ringType === RingType.OUTER ||
          annotation.ringType === RingType.NORMAL
        ) {
          if (annotation.id === 15) console.log('fill 15')
          // this.FillPolygonAnnotation(ctx, annotation)
          this.FillPolygonAnnotation2(ctx, annotation)
        }
      }
    },

    // 填充Rect标注
    FillRectAnnotation (
      ctx: CanvasRenderingContext2D,
      annotation: RectAnnotation
    ): void {
      const label = (store.getters.labels as Label[]).find(
        item => item.id === annotation.tag
      )
      const color = label ? label.color : '#ffffff'
      const rgb = hexToRgb(color)
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b}, 0.25)`
      const p1 = annotation.coordinates[0]
      const p2 = annotation.coordinates[2]
      ctx.fillRect(p1[0], p1[1], p2[0] - p1[0], p2[1] - p1[1])
    },

    // 填充polygon标注
    FillPolygonAnnotation (
      ctx: CanvasRenderingContext2D,
      annotation: PolygonAnnotation
    ): void {
      const label = (store.getters.labels as Label[]).find(
        item => item.id === annotation.tag
      )
      const color = label ? label.color : '#ffffff'
      const rgb = hexToRgb(color)
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b}, 0.25)`
      if (annotation.lines.length === 0 && annotation.coordinates.length > 0) {
        const points = annotation.coordinates[0]
        this.FillArea(ctx, points)
        if (annotation.ringType !== RingType.NORMAL) {
          const defaultCompositeOp = ctx.globalCompositeOperation
          const defaultFillStyle = ctx.fillStyle
          ctx.fillStyle = 'rgba(255,255, 255, 1)'
          ctx.globalCompositeOperation = 'destination-out'
          for (const id of annotation.innerRingIDs) {
            const annotationT = store.state.annotations.find(
              item => item.id === id
            ) as PolygonAnnotation
            const pointsT = annotationT.coordinates[0]
            this.FillArea(ctx, pointsT)
          }
          ctx.globalCompositeOperation = defaultCompositeOp
          ctx.fillStyle = defaultFillStyle
        }
      }
    },

    FillPolygonAnnotation2 (
      ctx: CanvasRenderingContext2D,
      annotation: PolygonAnnotation
    ): void {
      const label = (store.getters.labels as Label[]).find(
        item => item.id === annotation.tag
      )
      const color = label ? label.color : '#ffffff'
      const rgb = hexToRgb(color)
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b}, 0.25)`
      if (annotation.lines.length === 0 && annotation.coordinates.length > 0) {
        if (annotation.isShow && annotation.isFill) {
          if (annotation.ringType !== RingType.CUT) {
            const points = annotation.coordinates[0]
            this.FillArea(ctx, points)
            if (annotation.ringType !== RingType.NORMAL) {
              const defaultCompositeOp = ctx.globalCompositeOperation
              const defaultFillStyle = ctx.fillStyle
              ctx.fillStyle = 'rgba(255,255, 255, 1)'
              ctx.globalCompositeOperation = 'destination-out'
              for (const id of annotation.innerRingIDs) {
                const annotationT = store.state.annotations.find(
                  item => item.id === id
                ) as PolygonAnnotation
                const pointsT = annotationT.coordinates[0]
                this.FillArea(ctx, pointsT)
              }
              ctx.globalCompositeOperation = defaultCompositeOp
              ctx.fillStyle = defaultFillStyle
            }
          }
        }
        for (const id of annotation.innerRingIDs) {
          const annotationT = store.state.annotations.find(
            item => item.id === id
          ) as PolygonAnnotation
          this.FillPolygonAnnotation2(ctx, annotationT)
        }
      }
    },

    // 填充所有标注
    FillAnnotations (
      ctx: CanvasRenderingContext2D,
      canvasType: CanvasType = CanvasType.MAIN
    ): void {
      // 填充画布
      if (!this.fillCanvas || !this.fillCtx) return
      const fillCanvas = this.fillCanvas
      const fillCtx = this.fillCtx
      fillCtx.clearRect(0, 0, this.imgWidth, this.imgHeight)

      for (let i = 0; i < store.state.annotations.length; i++) {
        this.FillAnnotation(fillCtx, store.state.annotations[i])
      }

      // 将填充画布绘制到主画布上
      if (canvasType === CanvasType.MAIN) {
        ctx.drawImage(
          fillCanvas,
          -this.imgX / this.scale,
          -this.imgY / this.scale,
          this.canvasWidth / this.scale,
          this.canvasHeight / this.scale,
          0,
          0,
          this.canvasWidth,
          this.canvasHeight
        )
      } else {
        ctx.drawImage(fillCanvas, 0, 0, this.imgWidth, this.imgHeight)
      }
    },

    // 绘制GraphCut 模式下的数据
    GraphCutModeDraw (ctx: CanvasRenderingContext2D, canvasType: CanvasType = CanvasType.MAIN) {
      // const oldStyle = {
      //   lineWidth: ctx.lineWidth,
      //   strokeStyle: ctx.strokeStyle,
      //   fillStyle: ctx.fillStyle
      // }
      // ctx.lineWidth = this.graphCut.lineWidth
      // if (this.graphCut.frontPts.length > 0) {
      //   ctx.strokeStyle = this.graphCut.frontColor
      //   if (canvasType === CanvasType.MAIN) {
      //     const pts = this.CanvasPositionPoints(
      //       this.graphCut.frontPts.map((item: number[]) => [item[0], item[1]])
      //     )
      //     this.DrawArea(ctx, pts, false)
      //   } else {
      //     this.DrawArea(ctx, this.graphCut.frontPts, false)
      //   }
      // }
      // if (this.graphCut.backPts.length > 0) {
      //   ctx.strokeStyle = this.graphCut.backColor
      //   if (canvasType === CanvasType.MAIN) {
      //     const pts = this.CanvasPositionPoints(
      //       this.graphCut.backPts.map((item: number[]) => [item[0], item[1]])
      //     )
      //     this.DrawArea(ctx, pts, false)
      //   } else {
      //     this.DrawArea(ctx, this.graphCut.backPts, false)
      //   }
      // }
      // ctx.lineWidth = oldStyle.lineWidth
      // ctx.strokeStyle = oldStyle.strokeStyle
      // ctx.fillStyle = oldStyle.fillStyle
      const graphCutData: GraphCutData = store.getters.graphCutData
      const label = (store.getters.labels as Label[]).find(
        item => item.id === graphCutData.labelTag
      )
      ctx.strokeStyle = label ? label.color : '#ffffff'
      let p1 = []
      let p2 = []
      const rect = graphCutData.rect
      if (rect.length > 0) {
        if (canvasType === CanvasType.MAIN) {
          p1 = this.CanvasPositionPoint([
            rect[0][0],
            rect[0][1]
          ])
          p2 = this.CanvasPositionPoint([
            rect[2][0],
            rect[2][1]
          ])
        } else {
          p1 = rect[0]
          p2 = rect[2]
        }
        ctx.strokeRect(p1[0], p1[1], p2[0] - p1[0], p2[1] - p1[1])
      }
      const coordinates: Array<Array<[number, number]>> = graphCutData.coordinates
      if (coordinates.length > 0) {
        let points: Array<[number, number]> = []
        if (canvasType === CanvasType.MAIN) {
          points = this.CanvasPositionPoints(
            coordinates[0].map((item: number[]) => [
              item[0],
              item[1]
            ])
          )
        } else {
          points = coordinates[0]
        }
        this.DrawArea(ctx, points, false)
      }
      // const annotations = this.graphCut2.annotations
    },

    // 绘制单张图片的所有标注
    DrawAnnotations (
      ctx: CanvasRenderingContext2D,
      canvasType: CanvasType = CanvasType.MAIN
    ): void {
      // 主画布
      ctx.lineWidth =
        canvasType === CanvasType.MAIN
          ? store.getters.lineWidth
          : store.getters.lineWidth / this.scale

      // 绘制标注
      for (let i = 0; i < store.state.annotations.length; i++) {
        this.DrawAnnotation(ctx, store.state.annotations[i], canvasType)
      }

      // 填充标注
      this.FillAnnotations(ctx, canvasType)

      const { mode } = store.state

      // 选择模式下 画出选中标注的边框
      if (mode === OpMode.Select) {
        if (
          this.annotationIndex >= 0 &&
          this.annotationIndex < store.state.annotations.length
        ) {
          if (store.state.annotations[this.annotationIndex].isShow) {
            const annotationType =
              store.state.annotations[this.annotationIndex].type
            if (annotationType === 'Polygon') {
              const annotation = store.state.annotations[
                this.annotationIndex
              ] as PolygonAnnotation
              this.DrawAnnotationBBox(ctx, annotation, canvasType)
            } else if (annotationType === 'Rect') {
              const annotation = store.state.annotations[
                this.annotationIndex
              ] as RectAnnotation
              this.DrawRectCornerBBox(ctx, annotation, canvasType)
            }
          }
        }
        if (
          this.annotationIndex !== this.selectIndex &&
          this.selectIndex >= 0 &&
          this.selectIndex < store.state.annotations.length
        ) {
          if (store.state.annotations[this.selectIndex].isShow) {
            const annotationType =
              store.state.annotations[this.selectIndex].type
            if (annotationType === 'Polygon') {
              const annotation = store.state.annotations[
                this.selectIndex
              ] as PolygonAnnotation
              this.DrawAnnotationBBox(ctx, annotation, canvasType)
            } else if (annotationType === 'Rect') {
              const annotation = store.state.annotations[
                this.selectIndex
              ] as RectAnnotation
              this.DrawRectCornerBBox(ctx, annotation, canvasType)
            }
          }
        }
      }

      // 橡皮檫模式下 画出要修改的标注的边框
      // if (mode === OpMode.Eraser) {
      //   if (this.selectIndex >= 0 && this.selectIndex < store.state.annotations.length) {
      //     if (store.state.annotations[this.selectIndex].isShow) {
      //       const annotationType = store.state.annotations[this.selectIndex].type
      //       if (annotationType === 'Polygon') {
      //         const annotation = store.state.annotations[this.selectIndex] as PolygonAnnotation
      //         this.DrawAnnotationBBox(ctx, annotation, canvasType)
      //       }
      //     }
      //   }
      // }

      // graphCut 模式下的前景和后景
      if (mode === OpMode.GraphCut) {
        this.GraphCutModeDraw(ctx, canvasType)
      }
    },

    // 画布绘制
    UpdateCanvas (flag = 1): void {
      if (!this.ctx) return
      this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
      if (flag) {
        if (!this.image) return
        this.ctx.drawImage(
          this.image,
          -this.imgX / this.scale,
          -this.imgY / this.scale,
          this.canvasWidth / this.scale,
          this.canvasHeight / this.scale,
          0,
          0,
          this.canvasWidth,
          this.canvasHeight
        )
        this.DrawAnnotations(this.ctx)
      } else {
        if (!this.bufferCanvas) return
        this.ctx.drawImage(
          this.bufferCanvas,
          -this.imgX / this.scale,
          -this.imgY / this.scale,
          this.canvasWidth / this.scale,
          this.canvasHeight / this.scale,
          0,
          0,
          this.canvasWidth,
          this.canvasHeight
        )
      }
    },

    // 缓冲画布绘制
    UpdateBufferCanvas (): void {
      if (!this.bufferCtx || !this.image) return
      this.bufferCtx.clearRect(0, 0, this.imgWidth, this.imgHeight)
      this.bufferCtx.drawImage(this.image, 0, 0, this.imgWidth, this.imgHeight)
      this.DrawAnnotations(this.bufferCtx, CanvasType.BUFFER)
    },

    // ===================== canvas 其它画布  ===================

    // 初始化缩略图画图
    SetScaleImage (): void {
      if (!this.image || !this.scaleCanvas) return
      store.state.showScalePanel = true
      this.scaleHeight = (this.scaleWidth * this.imgHeight) / this.imgWidth
      this.scaleCanvas.width = this.scaleWidth
      this.scaleCanvas.height = this.scaleHeight
      this.DrawScaleCanvas(1, 1, this.scaleWidth - 1, this.scaleHeight - 1)
    },

    // 更新缩略图画布
    UpdateScaleCanvas (): void {
      let left = this.imgX < 0 ? -this.imgX / this.scale : 0
      let right = this.imgWidth
      if (this.imgX + this.scale * this.imgWidth > this.canvasWidth) {
        right =
          right -
          (this.imgX + this.scale * this.imgWidth - this.canvasWidth) /
            this.scale
      }
      const width = ((right - left) * this.scaleWidth) / this.imgWidth
      left = (left * this.scaleWidth) / this.imgWidth
      let top = this.imgY < 0 ? -this.imgY / this.scale : 0
      let button = this.imgHeight
      if (this.imgY + this.scale * this.imgHeight > this.canvasHeight) {
        button =
          button -
          (this.imgY + this.scale * this.imgHeight - this.canvasHeight) /
            this.scale
      }
      const height = ((button - top) * this.scaleHeight) / this.imgHeight
      top = (top * this.scaleHeight) / this.imgHeight
      this.DrawScaleCanvas(left, top, width, height)
    },

    // 缩略图画布绘制矩形区域   // TODO 切换图片时 需要更新
    DrawScaleCanvas (
      left: number,
      top: number,
      width: number,
      height: number
    ): void {
      // console.log('draw scale canvas')
      if (!this.scaleCtx || !this.image) return
      this.scaleCtx.clearRect(0, 0, this.scaleWidth, this.scaleHeight)
      this.scaleCtx.drawImage(
        this.image,
        0,
        0,
        this.scaleWidth,
        this.scaleHeight
      )
      this.scaleCtx.strokeStyle = '#FF0000'
      this.scaleCtx.lineWidth = 1.5
      // console.log(left, top, width, height)
      this.scaleCtx.strokeRect(left, top, width, height)
    },

    // 缩略图画布鼠标点击事件
    ScaleCanvasMouseDownCallback (event: MouseEvent): void {
      if (!this.scaleCanvas) return
      const p: number[] = this.GetMouseInCanvasLocation(
        event,
        this.scaleCanvas
      )
      const newImgX: number =
        this.canvasWidth / 2 -
        (p[0] / this.scaleWidth) * this.imgWidth * this.scale
      const newImgY: number =
        this.canvasHeight / 2 -
        (p[1] / this.scaleHeight) * this.imgHeight * this.scale
      this.SetImageXY(newImgX, newImgY)
      this.UpdateCanvas()
      this.UpdateScaleCanvas()
    },

    // 创建选择画布
    BuildSelectMask (): void {
      this.UpdateSelectMask()
    },

    // 填充Rect区域mask
    FillRectMask (
      ctx: CanvasRenderingContext2D,
      annotation: RectAnnotation
    ): void {
      if (!annotation.isShow) return
      const p1 = [annotation.coordinates[0][0], annotation.coordinates[0][1]]
      const p2 = [annotation.coordinates[2][0], annotation.coordinates[2][1]]
      ctx.fillStyle = `rgba(${annotation.id},${0},${0}, 1)`
      ctx.clearRect(p1[0], p1[1], p2[0] - p1[0], p2[1] - p1[1])
      ctx.fillRect(p1[0], p1[1], p2[0] - p1[0], p2[1] - p1[1])
    },

    // 填充Polygon区域mask
    FillPolygonMask (
      ctx: CanvasRenderingContext2D,
      annotation: PolygonAnnotation
    ): void {
      if (annotation.coordinates.length > 0) {
        if (
          annotation.ringType === RingType.NORMAL ||
          annotation.ringType === RingType.OUTER
        ) {
          this.FillAreaMask(ctx, annotation)
        }
      }
    },

    // 填充不规则区域mask
    FillAreaMask (
      ctx: CanvasRenderingContext2D,
      annotation: PolygonAnnotation
    ): void {
      if (annotation.isShow) {
        ctx.fillStyle = 'rgba(255,255,255,1)'
        this.FillArea(ctx, annotation.coordinates[0])
        ctx.fillStyle = `rgba(${annotation.id},${0},${0}, 1)`
        this.FillArea(ctx, annotation.coordinates[0])
      }
      for (const id of annotation.innerRingIDs) {
        const annotationT = store.state.annotations.find(
          item => item.id === id
        ) as PolygonAnnotation
        this.FillAreaMask(ctx, annotationT)
      }
    },

    // 更新选择画布
    UpdateSelectMask (): void {
      // 单张图片的annotation的id不能要超过255
      if (
        !this.selectMaskCtx ||
        !this.image ||
        !this.ctx ||
        !this.selectMaskCanvas
      ) {
        return
      }
      this.selectMaskCtx.clearRect(0, 0, this.imgWidth, this.imgHeight)
      this.selectMaskCtx.lineWidth = 1
      const ctx = this.selectMaskCtx
      // 填充完整区域
      const annotations: PolygonAnnotation[] = []
      store.state.annotations.forEach(annotation => {
        if (annotation.type === 'Rect') {
          this.FillRectMask(ctx, annotation)
        } else if (annotation.type === 'Polygon') {
          if (annotation.lines.length === 0) {
            this.FillPolygonMask(ctx, annotation)
          } else {
            annotations.push(annotation)
          }
        }
      })

      // 冒泡排序 根据bbox的面积从大到小排列
      for (let i = 0; i < annotations.length - 1; i++) {
        for (let j = 0; j < annotations.length - 1 - i; j++) {
          const area1 = this.GetBBoxArea(annotations[j].bbox)
          const area2 = this.GetBBoxArea(annotations[j + 1].bbox)
          if (area1 < area2) {
            const annotation = annotations[j]
            annotations[j] = annotations[j + 1]
            annotations[j + 1] = annotation
          }
        }
      }
      // 填充不完整区域
      annotations.forEach(annotation => {
        if (annotation.type === 'Polygon') {
          annotation = annotation as PolygonAnnotation
          if (annotation.lines.length > 0) {
            annotation.lines.forEach(line => {
              ctx.fillStyle = 'rgba(255,255,255,1)'
              this.FillArea(ctx, line)
              ctx.fillStyle = `rgba(${annotation.id},${0},${0}, 1)`
              this.FillArea(ctx, line)
            })
          }
        }
      })
      this.selectMask = this.selectMaskCtx.getImageData(
        0,
        0,
        this.imgWidth,
        this.imgHeight
      )
      this.annotationIndex = -1
    },

    // ===================== graph cut 工具 ===================

    // grab cut 候选框 绘制
    MouseDrawGraphCutRect (event: MouseEvent): void {
      const canvas: HTMLCanvasElement = this.canvas as HTMLCanvasElement
      let startP = this.GetPointsPositionInCanvas(event, canvas)
      const graphCutData = store.getters.graphCutData
      if (store.getters.label) {
        const label: Label = store.getters.label
        if (label.type !== 'Polygon') {
          this.$message('非曲线边界无法使用 graph cut，请更换标签类型')
          return
        }
        graphCutData.labelTag = (label as Label).id
      }
      startP = this.ImagePositionPoint(startP)
      const FindCornerPointInRect = (p: Point, rect: Array<[number, number]>): number => {
        for (let i = 0; i < rect.length; i++) {
          if (this.Distance(p, rect[i]) * this.scale <= store.getters.radius) {
            return i
          }
        }
        return -1
      }

      const CheckRect = (p1: Point, p2: Point): boolean => {
        return this.Distance(p1, p2) * this.scale <= store.getters.radius
      }

      const GetRectCorner = (
        p1: number[],
        p2: number[]
      ): Array<[number, number]> => {
        const points: Array<[number, number]> = []
        const xMin = Math.min(p1[0], p2[0])
        const yMin = Math.min(p1[1], p2[1])
        const xMax = Math.max(p1[0], p2[0])
        const yMax = Math.max(p1[1], p2[1])
        points.push([xMin, yMin])
        points.push([xMax, yMin])
        points.push([xMax, yMax])
        points.push([xMin, yMax])
        return points
      }

      const DrawRectAction = (event: MouseEvent): void => {
        let moveP = this.GetPointsPositionInCanvas(event, canvas)
        moveP = this.ImagePositionPoint(moveP)
        graphCutData.rect = GetRectCorner(startP, moveP)
        this.UpdateCanvas()
      }

      const RemoveDrawRectAction = (event: MouseEvent): void => {
        let endP = this.GetPointsPositionInCanvas(event, canvas)
        endP = this.ImagePositionPoint(endP)
        if (CheckRect(startP, endP)) {
          graphCutData.rect = []
        }
        canvas.removeEventListener('mousemove', DrawRectAction)
        canvas.removeEventListener('mouseup', RemoveDrawRectAction)
      }

      const index = FindCornerPointInRect(startP, graphCutData.rect)
      if (index !== -1) {
        startP = graphCutData.rect[(index + 2) % 4]
      } else {
        store.commit('setGraphCutDataCoordinates', [])
      }

      canvas.addEventListener('mousemove', DrawRectAction)
      canvas.addEventListener('mouseup', RemoveDrawRectAction)
    },

    // 选择前景像素点
    SelectGraphCutFront (): void {
      this.graphCut.status = 1
      this.graphCut.frontPts = []
    },

    // 选择背景像素点
    SelectGraphCutBack (): void {
      this.graphCut.status = 2
      this.graphCut.backPts = []
    },

    // graphCut 分割  // TODO graph cut算法实现
    GraphCutEx (): void {
      if (
        this.graphCut.frontPts.length === 0 ||
        this.graphCut.backPts.length === 0
      ) {
        return
      }
      // 调用 graphCut 算法 获取 边界轮廓点
      this.graphCut.frontPts = []
      this.graphCut.backPts = []
      this.UpdateCanvas()
      console.log('graph cut')
    },

    // ===================== levelSet 标注数据管理 ===================

    // 选择levelSet标注并保存  将level set标注 转变成 普通标注
    SelectLevelSetAnnotationAndSave (annotationIndex: number): void {
      if (
        annotationIndex !== -1 &&
        annotationIndex < store.state.annotations.length &&
        store.state.annotations[annotationIndex].type === 'Polygon'
      ) {
        const annotation = store.state.annotations[
          annotationIndex
        ] as PolygonAnnotation
        if (annotation.isLevelSet) {
          this.RevokeUndoContent()
          annotation.isLevelSet = false
          this.RevokeRedoContent()
          this.SaveAnnotations()
          // 生成下一张切片的level set标注
          store.dispatch('useLevelSetForAnnotation', annotation)
        }
      }
    },

    // ===================== canvas utils ===================

    // 获取画线时鼠标在画布中的位置点 并作点约束
    GetPointsPositionInCanvas (
      event: MouseEvent,
      container: HTMLCanvasElement
    ): Point {
      const point = this.GetMouseInCanvasLocation(event, container)
      return [this.XPointReplace(point[0]), this.YPointReplace(point[1])]
    },

    // X坐标点更换， 防止绘制到图片外
    XPointReplace (x: number): number {
      if (x < this.imgX) {
        x = this.imgX
      } else if (x > this.imgWidth * this.scale + this.imgX) {
        x = this.imgWidth * this.scale + this.imgX - 1
      }
      return x
    },

    // Y坐标点更换， 防止绘制到图片外
    YPointReplace (y: number): number {
      if (y < this.imgY) {
        y = this.imgY
      } else if (y > this.imgHeight * this.scale + this.imgY) {
        y = this.imgHeight * this.scale + this.imgY
      }
      return y
    },

    // 计算两个点的距离
    Distance (p1: Point, p2: Point): number {
      return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2))
    },

    // 计算路径点的包围盒
    GetBBox (line: Array<Point>): number[] {
      const bbox = [Number.MAX_VALUE, Number.MAX_VALUE, -1, -1]
      line.forEach(p => {
        bbox[0] = Math.min(bbox[0], p[0])
        bbox[1] = Math.min(bbox[1], p[1])
        bbox[2] = Math.max(bbox[2], p[0])
        bbox[3] = Math.max(bbox[3], p[1])
      })
      return bbox
    },

    // 两个bbox合并
    GetNewBBoxWithLine (bbox: Array<number>, line: Array<Point>): number[] {
      line.forEach(p => {
        bbox[0] = Math.min(bbox[0], p[0])
        bbox[1] = Math.min(bbox[1], p[1])
        bbox[2] = Math.max(bbox[2], p[0])
        bbox[3] = Math.max(bbox[3], p[1])
      })
      return bbox
    },

    // 判断第一个包围盒是否包含包含第二个包围盒
    IsOuterBBox (bbox1: Array<number>, bbox2: Array<number>): boolean {
      return (
        bbox1[0] <= bbox2[0] &&
        bbox1[1] <= bbox2[1] &&
        bbox1[2] >= bbox2[2] &&
        bbox1[3] >= bbox2[3]
      )
    },

    // 判断第一个包围盒是否被第二个包围盒包含
    IsInnerBBox (bbox1: Array<number>, bbox2: Array<number>): boolean {
      return (
        bbox1[0] >= bbox2[0] &&
        bbox1[1] >= bbox2[1] &&
        bbox1[2] <= bbox2[2] &&
        bbox1[3] <= bbox2[3]
      )
    },

    // 计算包围盒面积
    GetBBoxArea (bboxXYXY: Array<number>): number {
      return Math.abs(
        (bboxXYXY[2] - bboxXYXY[0] + 1) * (bboxXYXY[3] - bboxXYXY[1] + 1)
      )
    },

    // canvas 坐标转化为 图片坐标
    ImagePositionPoint (point: Point): Point {
      return [
        (point[0] - this.imgX) / this.scale,
        (point[1] - this.imgY) / this.scale
      ]
    },

    // 图片单个点坐标转化为 canvas坐标
    CanvasPositionPoint (point: Point): Point {
      return [
        point[0] * this.scale + this.imgX,
        point[1] * this.scale + this.imgY
      ]
    },

    // 图片多个点坐标转化为 canvas坐标
    CanvasPositionPoints (points: Array<Point>): Point[] {
      const newPoints: Array<Point> = []
      points.forEach(point => {
        newPoints.push(this.CanvasPositionPoint(point))
      })
      return newPoints
    },

    // 图片自适应canvas大小
    AdaptiveCanvasSize (): void {
      this.scale = 1
      if (
        this.imgWidth > this.canvasWidth ||
        this.imgHeight > this.canvasHeight
      ) {
        this.scale =
          this.imgWidth - this.canvasWidth > this.imgHeight - this.canvasHeight
            ? this.canvasWidth / this.imgWidth
            : this.canvasHeight / this.imgHeight
      } else {
        const scaleX = this.canvasWidth / this.imgWidth
        const scaleY = this.canvasHeight / this.imgHeight
        this.scale = scaleX > scaleY ? scaleY : scaleX
      }
      const initImgX = (this.canvasWidth - this.imgWidth * this.scale) / 2
      const initImgY = (this.canvasHeight - this.imgHeight * this.scale) / 2
      this.SetImageXY(initImgX, initImgY)
    },

    // 计算鼠标相对容器的位置
    GetMouseInCanvasLocation (
      event: MouseEvent | TouchEvent,
      container: HTMLCanvasElement,
      skip = false
    ): Point {
      if (!skip) {
        event.preventDefault()
      }

      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight
      const x = (event as MouseEvent).pageX
      const y = (event as MouseEvent).pageY
      let left =
        x - (container.getBoundingClientRect().left + window.pageXOffset)
      let top =
        y - (container.getBoundingClientRect().top + window.pageYOffset)

      if (left < 0) {
        left = 0
      } else if (left > containerWidth) {
        left = containerWidth
      }

      if (top < 0) {
        top = 0
      } else if (top > containerHeight) {
        top = containerHeight
      }
      return [left, top]
    },

    // 设置图片位置，防止图片被拖出画布
    SetImageXY (vx: number, vy: number): void {
      if (vx < this.imgAppearSize - this.imgWidth * this.scale) {
        this.imgX = this.imgAppearSize - this.imgWidth * this.scale
      } else if (vx > this.canvasWidth - this.imgAppearSize) {
        this.imgX = this.canvasWidth - this.imgAppearSize
      } else {
        this.imgX = vx
      }

      if (vy < this.imgAppearSize - this.imgHeight * this.scale) {
        this.imgY = this.imgAppearSize - this.imgHeight * this.scale
      } else if (vy > this.canvasHeight - this.imgAppearSize) {
        this.imgY = this.canvasHeight - this.imgAppearSize
      } else {
        this.imgY = vy
      }
    },

    // ===================== canvas 状态变化 Label的响应  ===================

    // 改变 label 为 当前annotation的label
    LabelChangeWithAnnotationSelect (selectIndex: number): void {
      if (selectIndex !== -1) {
        const labels = store.getters.labels as Label[]
        for (let i = 0; i < labels.length; i++) {
          if (labels[i].id === store.state.annotations[selectIndex].tag) {
            store.commit('setLabelIdx', i)
            break
          }
        }
      }
    },

    // =====================store.state变量发生变化时canvas的响应  ===================

    // mode 橡皮檫
    EraseModelHandler (): void {
      // this.BuildSelectMask()
      // this.annotationIndex = -1
      // this.selectIndex = -1
    },

    // mode 选择模式
    SelectModeHandler (): void {
      this.BuildSelectMask()
    },

    // mode 删除某个标注
    DeleteModeHandler (): void {
      if (
        this.annotationIndex >= 0 &&
        this.annotationIndex < store.state.annotations.length
      ) {
        this.RevokeUndoContent()
        this.DeleteAnnotation(this.annotationIndex)
        if (this.selectIndex === this.annotationIndex) {
          this.selectIndex = -1
        }
        this.annotationIndex = -1
        this.RevokeRedoContent()
        this.UpdateCanvas()
        this.UpdateSelectMask()
        this.SaveAnnotations()
      }
    },

    // mode 修改时  annotation需要做的修改
    ModeChangeHandler (): void {
      console.log('mode change')
    },

    // label 修改时 annotation 需要做的修改
    LabelChangeHandler (labelIdx: number, oldLabelIdx: number): void {
      this.ModeChangeActionWithLabelChanged(labelIdx, oldLabelIdx)
    },

    // label 改变时， mode 需要做出的修改
    ModeChangeActionWithLabelChanged (
      labelIdx: number,
      oldLabelIdx: number
    ): void {
      const mode = store.getters.mode
      if (labelIdx === -1 || oldLabelIdx === -1) return
      if (mode === OpMode.Select) return
      const label: Label = store.getters.labels[labelIdx]
      const oldLabel: Label = store.getters.labels[oldLabelIdx]
      if (label.type !== oldLabel.type) {
        if (label.type === 'Rect') {
          store.commit('setMode', OpMode.Rect)
        } else if (label.type === 'Polygon') {
          if (mode === OpMode.Rect) {
            store.commit('setMode', OpMode.Curve)
          }
        }
      }
    },

    // labels 修改时 annotations 需要做的修改
    LabelDeleteHandler (): void {
      const labelId = store.state.deleteLabelId
      if (labelId !== '') {
        this.RevokeUndoContent()
        for (let i = store.state.annotations.length - 1; i >= 0; i--) {
          if (labelId === store.state.annotations[i].tag) {
            this.DeleteAnnotation(i)
            // store.state.annotations.splice(i, 1)
          }
        }
        this.RevokeRedoContent()
        this.UpdateCanvas()
        this.SaveAnnotations()
        store.state.deleteLabelId = ''
      }
    },

    // 图片自适应浏览器窗口大小
    ResizeImageSizeHandler (): void {
      if (this.image) {
        this.ResizeImageSize()
      }
    },

    // 选择 使用智能剪刀
    UseIntelligentScissors (): void {
      if (this.image) {
        if (this.gradientMap.length === 0) {
          // const canvas0 = document.querySelector('.imageCanvas') as HTMLCanvasElement
          // if (canvas0) {
          //   document.body.removeChild(canvas0)
          // }
          // const image = this.image
          // const canvas = document.createElement('canvas')
          // canvas.width = image.width
          // canvas.height = image.height
          // canvas.style.display = 'none'
          // canvas.className = 'imageCanvas'
          // const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
          // ctx.clearRect(0, 0, image.width, image.height)
          // ctx.drawImage(image, 0, 0, image.width, image.height)
          // const imageData = ctx.getImageData(0, 0, image.width, image.height).data
          // const row = image.height
          // const col = image.width
          // const pixelCount = row * col * 4
          // const grayImageData = new Uint8ClampedArray(pixelCount)
          // const ehlImageData = new Uint8ClampedArray(pixelCount)
          // const histogram = new Array<number>(256).fill(0)
          // const LUT = new Array<number>(256).fill(0)
          // let pixel = pixelCount
          // while (pixel) {
          //   pixel -= 4
          //   grayImageData[pixel] = (imageData[pixel] * 299 + imageData[pixel + 1] * 587 + imageData[pixel + 2] * 114) / 1000
          //   grayImageData[pixel + 1] = grayImageData[pixel]
          //   grayImageData[pixel + 2] = grayImageData[pixel]
          //   grayImageData[pixel + 3] = imageData[pixel + 3]
          // }
          // pixel = pixelCount
          // while (pixel) {
          //   pixel -= 4
          //   histogram[grayImageData[pixel]] += 1
          // }
          // LUT[0] = histogram[0] / pixelCount * 255
          // let sum = histogram[0]
          // for (let i = 1; i < 256; i++) {
          //   sum += histogram[i]
          //   LUT[i] = sum / pixelCount * 255
          // }
          // pixel = pixelCount
          // while (pixel) {
          //   pixel -= 4
          //   ehlImageData[pixel] = LUT[grayImageData[pixel]]
          //   ehlImageData[pixel + 1] = ehlImageData[pixel]
          //   ehlImageData[pixel + 2] = ehlImageData[pixel]
          //   ehlImageData[pixel + 3] = grayImageData[pixel + 3] / 3
          // }
          // const imageDataCtx = ctx.createImageData(image.width, image.height)
          // // imageDataCtx.data.set(grayImageData)
          // imageDataCtx.data.set(ehlImageData)
          // ctx.clearRect(0, 0, image.width, image.height)
          // ctx.putImageData(imageDataCtx, 0, 0)
          // if (!this.ctx) return
          // this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
          // this.ctx.drawImage(
          //   canvas,
          //   -this.imgX / this.scale,
          //   -this.imgY / this.scale,
          //   this.canvasWidth / this.scale,
          //   this.canvasHeight / this.scale,
          //   0,
          //   0,
          //   this.canvasWidth,
          //   this.canvasHeight
          // )
          this.gradientMap = getGradientMap(this.image)
          console.log('gradient')
        }
        this.inSciCurvePoints = []
      }
    },

    // 选择 使用graphCut
    UseGraphCutHandler (): void {
      this.graphCut.frontPts = []
      this.graphCut.backPts = []
      this.graphCut.status = 0
    },

    // 退出 graphcut 模式
    EndGraphCutHandler (): void {
      store.dispatch('saveGraphCutResults')
    },

    // 使用 level Set 提前获取下一张图片
    EnableLevelSetHandler (): void {
      // if (store.state.useLevelSet) {
      //   console.log('启用level set智能分割')
      // } else {
      //   console.log('关闭level set智能分割')
      // }
    },

    // imageSliceIndex 修改时， annotation 需要做的修改
    SliceIndexChangeHandler (): void {
      console.log('slice index changed')
      this.annotationIndex = -1
      // 智能剪刀初始化
      this.gradientMap = []
      this.inSciCurvePoints = []
      // graphCut 初始化
      this.graphCut.status = 0
      this.graphCut.frontPts = []
      this.graphCut.backPts = []
      // this.UpdateCanvas()
    },

    // 接收到更新canvas的指令
    UpdateCanvasHandler (): void {
      this.UpdateCanvas()
      this.UpdateSelectMask()
      this.UpdateScaleCanvas()
      console.log('update canvas')
    },

    // 初始化 canvas 内部状态
    InitCanvasStateHandler (): void {
      this.InitRevokeState()
    }
  },
  mounted () {
    // 调整 canvas 的尺寸
    this.canvas = this.$refs.canvas as HTMLCanvasElement
    this.canvas.width = this.canvas.clientWidth
    this.canvas.height = this.canvas.clientHeight
    // 获取 canvas context 对象
    this.ctx = this.canvas.getContext('2d')

    // 获取 scaleCanvas 对象
    this.scaleCanvas = this.$refs.scaleCanvas as HTMLCanvasElement
    this.scaleCanvas.width = this.scaleWidth
    this.scaleCanvas.height = this.scaleHeight
    this.scaleCtx = this.scaleCanvas.getContext('2d')
    // 初始化时不显示scaleBox
    store.state.showScalePanel = false

    // 设置窗口大小改变时的回调函数
    window.onresize = (): void => {
      this.CanvasReSizeCallback()
    }

    // 设置监听器
    this.canvas.addEventListener('wheel', this.CanvasMouseWheelCallback)
    this.canvas.addEventListener('mousedown', this.CanvasMouseDownCallback)
    this.canvas.addEventListener('mousemove', this.CanvasMouseMoveCallback)
    this.scaleCanvas.addEventListener(
      'mousedown',
      this.ScaleCanvasMouseDownCallback
    )

    // 键盘事件
    window.onkeydown = (event: KeyboardEvent): void => {
      this.CanvasKeyDownCallback(event)
    }

    // 禁用浏览器右键
    this.canvas.addEventListener('contextmenu', event => {
      event.preventDefault()
    })

    store.state.socket.on('image', this.HandleImageChange)
  },
  destroyed () {
    store.state.socket.off('image', this.HandleImageChange)
  },
  watch: {
    '$store.state.index' (): void {
      this.SliceIndexChangeHandler()
    },

    '$store.state.datasetIdx' (): void {
      this.UpdateCanvas()
    },

    '$store.state.labelIdx' (labelIdx: number, oldLabelIdx: number): void {
      this.LabelChangeHandler(labelIdx, oldLabelIdx)
    },

    '$store.state.deleteLabelId' (): void {
      this.LabelDeleteHandler()
    },

    '$store.state.showMenuPanel' (): void {
      this.CanvasReSizeCallback()
    },

    '$store.state.resizeImageFlag' (): void {
      this.ResizeImageSizeHandler()
    },

    '$store.state.useLevelSet' (): void {
      this.EnableLevelSetHandler()
    },

    '$store.state.updateCanvas' (): void {
      this.UpdateCanvasHandler()
    },

    '$store.state.initCanvasState' (): void {
      this.InitCanvasStateHandler()
    },

    '$store.state.mode' (mode: OpMode, oldMode: OpMode): void {
      switch (oldMode) {
        case OpMode.GraphCut:
          this.EndGraphCutHandler()
          break
        default:
          break
      }

      switch (mode) {
        case OpMode.Redo:
          this.RevokeRedo()
          store.state.mode = oldMode
          break
        case OpMode.Undo:
          this.RevokeUndo()
          store.state.mode = oldMode
          break
        case OpMode.Eraser:
          this.EraseModelHandler()
          break
        case OpMode.Select:
          this.SelectModeHandler()
          break
        case OpMode.Delete:
          this.DeleteModeHandler()
          store.state.mode = oldMode
          break
        case OpMode.IntelligentScissors:
          this.UseIntelligentScissors()
          break
        case OpMode.GraphCut:
          this.UseGraphCutHandler()
          break
        case OpMode.None:
          this.ModeChangeHandler()
          break
        default:
          break
      }
    }
  }
})
</script>

<style lang="less">
.canvasMain {
  // flex: auto;
  width: 100%;
  height: 100%;
  display: flex;
  background: #434343;
  position: relative;
  .canvasContent {
    flex: auto;
    width: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
    .preloader {
      .loader {
        position: absolute;
        top: 50%;
        left: 0;
        right: 0;
        width: 100px;
        height: 100px;
        display: block;
        text-align: center;
        margin: -50px auto 0;
      }
    }
    #canvas {
      flex: auto;
      width: 100%;
      height: 0;
      background: #8c919c;
      cursor: default;
    }
    .graphCut-menu-panel {
      position: absolute;
      top: 275px;
      left: 0;
      width: 75px;
      height: 108px;
      background: #8c919c;
      z-index: 999;
      -webkit-border-radius: 5px;
      -moz-border-radius: 5px;
      border-radius: 5px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      .el-button {
        margin-left: 0;
      }
    }
    .scaleBox {
      position: absolute;
      left: 0;
      bottom: 0;
      padding: 3px 3px 0 3px;
      background: #293245;
      border: 1px solid #3c5167;
      .scaleCanvas {
        position: relative;
        overflow: hidden;
        z-index: 999;
        cursor: pointer;
      }
      .scalePanel {
        height: 20px;
        width: 100%;
        font-size: 12px;
        text-align: center;
        color: #fff;
        display: flex;
        justify-content: space-between;
      }
    }
  }
}
</style>
