import Vue from 'vue'
import Vuex from 'vuex'
import { Dataset, Label } from '@/api/dataset'
import {
  Annotation,
  applyGrabCut,
  applyLevelSet,
  getSliceAnnotations,
  GraphCutData,
  GraphCutOpMode,
  LevelSetAnnotations,
  PolygonAnnotation,
  RingType,
  setSliceAnnotations
} from '@/api/annotation'
import { DatasetGroup } from '@/api/group'
import Socket from '../api/socket'
import { GetBBox } from '@/api/utils/bbox'
import { Interpolation } from '@/api/utils/line'
import {
  CreateGraphCutAnnotation,
  MergeGraphCutAnnotations,
  MergeLevelSetAnnotations
} from '@/api/utils/polygonAnnotation'

Vue.use(Vuex)

export enum OpMode {
  None,
  Select,
  Delete,
  Drag,
  Eraser,
  Rect,
  Curve,
  IntelligentScissors,
  GraphCut,
  Redo,
  Undo,
}

export type CanvasState = {
  radius: number;
  lineWidth: number;
  eraserRadius: number;
}

export type StoreState = {
  server: string;
  socket: Socket;
  group: DatasetGroup | null;
  datasetIdx: number;
  labelIdx: number;
  deleteLabelId: string;
  axis: 'x' | 'y' | 'z';
  index: number;
  annotations: Array<Annotation>;
  mode: OpMode;

  graphCutData: GraphCutData;

  useLevelSet: boolean;
  levelSetAnnotations: LevelSetAnnotations;

  showMenuPanel: boolean;
  showScalePanel: boolean;
  resizeImageFlag: boolean;
  updateCanvas: boolean;
  initCanvasState: boolean;
  canvasState: CanvasState;
  loading: boolean;
}

let server = window.location.host
const saved = window.localStorage.getItem('settings')
if (saved) {
  try {
    const data = JSON.parse(saved)
    if (data.server) {
      server = data.server
    }
  } catch {
    console.log('no saved settings')
  }
}

export default new Vuex.Store<StoreState>({
  state: {
    server,
    socket: new Socket(server),
    group: null,
    datasetIdx: -1,
    axis: 'z',
    index: 0,
    labelIdx: -1,
    deleteLabelId: '',
    annotations: [],
    mode: OpMode.None,

    graphCutData: { mode: GraphCutOpMode.None, labelTag: '', rect: [], coordinates: [] },

    useLevelSet: false,
    levelSetAnnotations: { index: -1, annotations: [] },

    showMenuPanel: true,
    showScalePanel: true,
    resizeImageFlag: false,
    updateCanvas: false,
    initCanvasState: false,

    canvasState: {
      radius: 5,
      lineWidth: 2,
      eraserRadius: 20
    },
    loading: false
  },
  getters: {
    datasets: state => {
      if (!state.group) return [] as Dataset[]

      return state.group.datasets
    },

    dataset: state => {
      if (!state.group) return null
      if (state.datasetIdx === -1) return null

      return state.group.datasets[state.datasetIdx] as Dataset
    },

    labels: state => {
      if (!state.group) return []

      return state.group.labels
    },

    label: state => {
      if (!state.group) return null
      if (state.labelIdx === -1) return null

      return state.group.labels[state.labelIdx] as Label
    },

    mode: state => {
      return state.mode
    },

    graphCutMode: state => {
      return state.graphCutData.mode
    },

    graphCutData: state => {
      return state.graphCutData
    },

    index: state => {
      return state.index
    },

    useLevelSet: state => {
      return state.useLevelSet
    },

    levelSetAnnotations: state => {
      return state.levelSetAnnotations
    },

    radius: state => {
      return state.canvasState.radius
    },
    lineWidth: state => {
      return state.canvasState.lineWidth
    },
    eraserRadius: state => {
      return state.canvasState.eraserRadius
    }
  },
  mutations: {
    setDatasetIdx (state, payload: number): void {
      state.datasetIdx = payload
      state.labelIdx = 0
    },

    setAxis (state, payload: StoreState['axis']): void {
      state.axis = payload
    },

    setSliceIndex (state, payload: number): void {
      state.index = payload
    },

    setLabelIdx (state, payload: number): void {
      state.labelIdx = payload
    },

    setAnnotations (state, payload: Annotation[]): void {
      state.annotations = payload
      state.annotations.forEach(annotation => {
        if (!annotation.isShow) {
          annotation.isShow = true
        }
        if (!annotation.isFill) {
          annotation.isFill = false
        }
        if (annotation.type === 'Polygon') {
          annotation = annotation as PolygonAnnotation
          if (!annotation.lines) {
            annotation.lines = []
          }
          if (!annotation.innerRingIDs) {
            annotation.innerRingIDs = new Set<number>()
          } else {
            annotation.innerRingIDs = new Set<number>(annotation.innerRingIDs)
          }
          if (!annotation.bbox) {
            annotation.bbox = []
          }
          if (!annotation.isLevelSet) {
            annotation.isLevelSet = false
          }
        }
      })
    },

    setMode (state, payload: OpMode): void {
      state.mode = payload
      if (payload === OpMode.GraphCut) {
        state.graphCutData.mode = GraphCutOpMode.Rect
      }
    },

    setGraphCutMode (state, payload: GraphCutOpMode): void {
      state.graphCutData.mode = payload
    },

    initGraphCutData (state): void {
      const graphCutData: GraphCutData = state.graphCutData
      graphCutData.labelTag = ''
      graphCutData.rect = []
      graphCutData.coordinates = []
      graphCutData.mode = GraphCutOpMode.Rect
    },

    setGraphCutDataCoordinates (state, payload: Array<Array<[number, number]>>): void {
      if (payload.length > 0) {
        payload[0] = Interpolation(payload[0])
      }
      state.graphCutData.coordinates = payload
    },

    setShowScalePanel (state, payload: boolean): void {
      state.showScalePanel = payload
    },

    setResizeImageFlag (state): void {
      state.resizeImageFlag = !state.resizeImageFlag
    },

    setUseLevelSet (state, payload: boolean): void {
      state.useLevelSet = payload
    },

    setLevelSetAnnotations (state, payload: LevelSetAnnotations): void {
      state.levelSetAnnotations = payload
      state.levelSetAnnotations.annotations.forEach(annotation => {
        annotation = annotation as PolygonAnnotation
        annotation.isLevelSet = true
      })
    },

    addLevelSetAnnotation (state, payload: PolygonAnnotation): void {
      const idx = state.levelSetAnnotations.annotations.findIndex(item => item.id === payload.id)
      payload.isLevelSet = true
      payload.coordinates[0] = Interpolation(payload.coordinates[0])
      payload.bbox = GetBBox(payload.coordinates[0])
      payload.lines = []
      payload.ringType = RingType.NONE
      payload.innerRingIDs = new Set<number>()
      payload.outerRingId = -1
      payload.isLevelSet = true
      payload.isFill = false
      payload.isShow = true
      if (idx !== -1) {
        state.levelSetAnnotations.annotations[idx] = payload
      } else {
        state.levelSetAnnotations.annotations.push(payload)
      }
    },

    mergeLevelSetAnnotations (state): void {
      MergeLevelSetAnnotations(state.annotations, state.levelSetAnnotations.annotations)
    },

    setLabels (state, payload: Label[]): void {
      if (!state.group) return

      state.group.labels = payload
    },

    deleteLabelWithIndex (state, payload: [number, string]): void {
      if (!state.group || payload[0] === -1) return
      state.group.labels.splice(payload[0], 1)
      if (payload[0] === state.labelIdx) {
        state.labelIdx = state.group.labels.length > 0 ? 0 : -1
      }
      state.deleteLabelId = payload[1]
    },

    setGroup (state, payload: DatasetGroup | null): void {
      state.group = payload
      state.labelIdx = -1

      if (!payload) {
        state.datasetIdx = -1
        return
      }

      const { datasets } = payload
      if (datasets.length > 0) {
        state.datasetIdx = 0
        state.index = 0
      }
      if (state.group && state.group.labels.length > 0) {
        state.labelIdx = 0
      }
    },

    setUpdateCanvas (state): void {
      state.updateCanvas = !state.updateCanvas
    },

    setInitCanvasState (state): void {
      state.initCanvasState = !state.initCanvasState
    },

    setServer (state, payload: string): void {
      state.server = payload
      state.socket = new Socket(payload)
      window.localStorage.setItem('settings', JSON.stringify({ server: payload }))
    }
  },
  actions: {
    updateCanvas (context): void {
      context.commit('setUpdateCanvas')
    },

    setGroupAndUpdate (context, payload: DatasetGroup): void {
      context.commit('setGroup', payload)

      if (payload && context.state.datasetIdx !== -1) {
        context.dispatch('requestImageAndAnnotations').then(() => {
          console.log('request image and annotations')
        })
      }
    },

    setDatasetIdxAndUpdate (context, payload: number): void {
      context.commit('setDatasetIdx', payload)
      context.dispatch('requestImageAndAnnotations').then(() => {
        console.log('request image and annotations')
      })
      context.commit('setLevelSetAnnotations', { index: context.getters.index + 1, annotations: [] } as LevelSetAnnotations)
    },

    setAxisAndUpdate (context, payload: StoreState['axis']): void {
      context.commit('setAxis', payload)
      context.dispatch('requestImageAndAnnotations').then(() => {
        console.log('request image and annotations')
      })
      context.commit('setLevelSetAnnotations', { index: context.getters.index + 1, annotations: [] } as LevelSetAnnotations)
    },

    async requestImage (context): Promise<void> {
      const { group, datasetIdx } = context.state
      if (datasetIdx === -1 || !group) {
        return new Promise<void>((resolve, reject) => {
          console.log('dataset error')
          return reject
        })
      }
      const dataset = group.datasets[datasetIdx]
      return context.state.socket.send({
        type: 'slice',
        dataset: dataset.id,
        axis: context.state.axis,
        index: context.state.index
      })
    },

    async requestAnnotations (context): Promise<Annotation[]> {
      const { server, group, datasetIdx, axis, index } = context.state
      if (datasetIdx === -1 || !group) {
        return new Promise<Promise<Annotation[]>>((resolve, reject) => {
          console.log('dataset error')
          return reject
        })
      }
      const dataset = group.datasets[datasetIdx]
      return getSliceAnnotations(
        server,
        group.id,
        dataset.id,
        axis,
        index
      )
    },

    async requestImageAndAnnotations (context): Promise<void> {
      let annotations: Annotation[] = []
      context.state.loading = true
      try {
        [, annotations] = await Promise.all([context.dispatch('requestImage'), context.dispatch('requestAnnotations')])
      } catch (e) {
        console.log(e)
      }
      context.commit('setAnnotations', annotations)
      context.commit('setUpdateCanvas')
      context.commit('setInitCanvasState')
      context.state.loading = false
    },

    async setSliceIndexAndUpdate (context, payload: number): Promise<void> {
      const { useLevelSet, levelSetAnnotations } = context.state
      if (useLevelSet && payload === levelSetAnnotations.index) {
        context.state.loading = true
        context.commit('setSliceIndex', payload)
        let annotations: Annotation[] = []
        try {
          [, annotations] = await Promise.all([context.dispatch('requestImage'), context.dispatch('requestAnnotations')])
        } catch (e) {
          console.log(e)
        }
        context.commit('setAnnotations', annotations)
        context.commit('mergeLevelSetAnnotations')
        context.commit('setLevelSetAnnotations', { index: payload + 1, annotations: [] } as LevelSetAnnotations)
        context.commit('setUpdateCanvas')
        context.commit('setInitCanvasState')
        context.state.loading = false
      } else {
        if (useLevelSet) {
          context.commit('setLevelSetAnnotations', { index: payload + 1, annotations: [] } as LevelSetAnnotations)
        }
        context.commit('setSliceIndex', payload)
        context.dispatch('requestImageAndAnnotations').then(() => {
          console.log('request image and annotations')
        })
      }
    },

    EnableUseLevelSet (context, payload: boolean): void {
      context.commit('setUseLevelSet', payload)
      if (payload) {
        context.commit('setLevelSetAnnotations', { index: context.getters.index + 1, annotations: [] } as LevelSetAnnotations)
        if (context.state.annotations.length > 0) {
          context.dispatch('requestLevelSetAnnotations', context.state.annotations).then(data => {
            const annotations = data as PolygonAnnotation[]
            annotations.forEach(annotation => {
              context.commit('addLevelSetAnnotation', annotation)
            })
          }).catch(() => {
            console.log('失败： requestLevelSetAnnotations')
          })
        }
        console.log('开启 level set')
      } else {
        context.commit('setLevelSetAnnotations', { index: -1, annotations: [] } as LevelSetAnnotations)
        console.log('关闭 level set')
      }
    },

    useLevelSetForAnnotation (context, payload: PolygonAnnotation): void {
      console.log('use level set for annotation', payload.id)
      context.dispatch('requestLevelSetAnnotation', payload).then(data => {
        if (data) {
          context.commit('addLevelSetAnnotation', data as PolygonAnnotation)
        } else {
          console.log('失败： requestLevelSetAnnotation')
        }
        console.log('成功： requestLevelSetAnnotation')
      }).catch(() => {
        console.log('失败： requestLevelSetAnnotation')
      })
    },

    async requestLevelSetAnnotation (context, payload: Annotation): Promise<Annotation | null> {
      const annotations: Annotation[] = []
      let annotationsNew: Annotation[] = []
      annotations.push(payload)
      try {
        annotationsNew = await context.dispatch('applyLevelSetResult', annotations)
      } catch (e) {
        console.log(e)
      }
      if (annotationsNew.length > 0) {
        return annotationsNew[0]
      }
      return null
    },

    async requestLevelSetAnnotations (context, payload: Annotation[]): Promise<Annotation[] | null> {
      let annotationsNew: Annotation[] = []
      console.log('requestLevelSetAnnotations')
      const annotations = payload.filter(annotation => {
        return annotation.type === 'Polygon' && annotation.coordinates.length > 0
      })
      try {
        annotationsNew = await context.dispatch('applyLevelSetResult', annotations)
      } catch (e) {
        console.log(e)
      }
      if (annotationsNew.length > 0) {
        return annotationsNew
      }
      return null
    },

    async applyLevelSetResult (context, payload: Annotation[]): Promise<Annotation[]> {
      console.log('apply level set')
      const { group, axis, index, server } = context.state as StoreState
      if (!group) {
        return new Promise<Promise<PolygonAnnotation[]>>((resolve, reject) => {
          console.log('dataset error')
          return reject
        })
      }
      const dataset = context.getters.dataset as Dataset
      return applyLevelSet(
        server,
        group.id,
        dataset.id,
        axis,
        index,
        payload
      )
    },

    async saveSliceAnnotations (context): Promise<null> {
      const { group, axis, index, annotations, server } = context.state as StoreState

      if (!group) {
        return new Promise<Promise<null>>((resolve, reject) => {
          console.log('dataset error')
          return reject
        })
      }
      const dataset = context.getters.dataset as Dataset
      return setSliceAnnotations(
        server,
        group.id,
        dataset.id,
        axis,
        index,
        annotations
      )
    },

    useGraphCutForCutting (context): void {
      console.log('use graph cut for cutting')
      context.state.loading = true
      const graphCutData = context.getters.graphCutData
      const coordinates = graphCutData.rect.map((item: number[]) => {
        return [Math.round(item[0]), Math.round(item[1])]
      })
      const annotation = {
        tag: graphCutData.labelTag,
        type: 'Rect',
        coordinates: [[coordinates[0], coordinates[2]]]
      } as Annotation
      context.dispatch('requestGrabCutResult', annotation).then(data => {
        context.commit('setGraphCutDataCoordinates', data)
        context.commit('setUpdateCanvas')
      }).catch(e => {
        console.log(e)
      }).finally(() => {
        context.state.loading = false
      })
    },

    saveGraphCutResults (context): void {
      const graphCutData = context.state.graphCutData
      const annotations = context.state.annotations
      if (graphCutData.coordinates.length > 0) {
        const annotation: PolygonAnnotation = CreateGraphCutAnnotation(graphCutData.labelTag, graphCutData.coordinates, annotations)
        MergeGraphCutAnnotations(annotation, annotations)
        if (context.getters.useLevelSet) {
          context.dispatch('useLevelSetForAnnotation', annotation).catch(e => {
            console.log(e)
          })
        }
        context.dispatch('saveSliceAnnotations').catch(e => {
          console.log(e)
        })
        context.commit('initGraphCutData')
        context.commit('setUpdateCanvas')
      }
    },

    async requestGrabCutResult (context, payload: Annotation): Promise<Array<Array<[number, number]>>> {
      let annotationsNew: Annotation[] = []
      try {
        annotationsNew = await context.dispatch('applyGrabCutResult', payload)
      } catch (e) {
        console.log(e)
      }
      if (annotationsNew.length > 0 && annotationsNew[0].coordinates) {
        return annotationsNew[0].coordinates as Array<Array<[number, number]>>
      }
      return []
    },

    async applyGrabCutResult (context, payload: Annotation): Promise<Annotation[]> {
      const { server, group, axis, index, graphCutData } = context.state as StoreState

      if (!group || graphCutData.rect.length === 0) {
        return new Promise<Promise<Annotation[]>>((resolve, reject) => {
          console.log('dataset error')
          return reject
        })
      }

      const dataset = context.getters.dataset as Dataset
      return applyGrabCut(
        server,
        group.id,
        dataset.id,
        axis,
        index,
        payload
      )
    }
  },
  modules: {}
})
