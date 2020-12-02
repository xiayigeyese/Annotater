<template>
  <div class="panel annotation-list-panel">
    <h2 class="section-title">已标注列表</h2>
    <div v-if="data.length === 0">无标注</div>
    <div v-else class="annotation-list">
      <div
              style="display: flex; flex-direction: column"
              v-for="(record, label) in data"
              :key="label"
      >
        <div style="display: flex; flex-direction: row">
          <el-checkbox
                  :indeterminate="record.isIndeterminate"
                  v-model="record.isShow"
                  @change="handleLabelsShowChange(record.isShow, label)"
          >
            <div class="annotation-tag">
              <span :style="{backgroundColor: record.color}"></span>
              <div style="margin-right: 10px">{{getNameFromTag(label)}}</div>
            </div>
          </el-checkbox>
          <div
                  :style="{backgroundColor: record.isFill ? record.color : '', borderColor: record.color}"
                  class="div-fill-flag-as"
                  title="填 充"
                  @click="handleLabelsFillChange(record.isFill, label)"
          >
          </div>
        </div>

        <el-checkbox-group
                v-model="record.isShows"
                @change="handleAnnotationShowChange(record.isShows, label)"
                :value="record.annotations.map((_, idx) => idx) "
                class="annotation-geometries"
        >
          <div class="annotation-outer" v-for="(annotation, index) in record.annotations" :key="index" >
            <el-checkbox :label="index">
              <div class="annotation-geometry">
                <span class="name"> 标注{{annotation.id}} </span>
                <div v-if="annotation.type === 'Polygon' && (annotation.lines.length !== 0 || annotation.coordinates.length === 0)">
                  <span class="closing">未完成</span>
                </div>
                <div v-if="annotation.type === 'Polygon' && annotation.isLevelSet">
                  <span class="closing"> level set 预标注 </span>
                </div>
              </div>
            </el-checkbox>
            <div v-show="annotation.type === 'Polygon'" class="annotation-inner">
              <div v-for="(annotationCut, indexCut) in getAnnotationInnerCut(annotation)" :key="indexCut">
                <span class="name"> 标注{{annotationCut.id}} </span>
              </div>
            </div>
          </div>
        </el-checkbox-group>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { Annotation, PolygonAnnotation, RingType } from '../api/annotation'
import { Label } from '../api/dataset'
import store from '../store'

  type GroupRecord = Record<string,
        {color: string;
          isFill: boolean;
          isShow: boolean;
          isIndeterminate: boolean;
          isFills: number[];
          isShows: number[];
          annotations: Annotation[];
        }>

export default Vue.extend({
  name: 'annotation-list',
  computed: {
    data: {
      get: function (): GroupRecord {
        const groups: GroupRecord = {}
        const labelMap: Record<string, Label> = {}
        store.getters.labels.forEach((label: Label) => {
          labelMap[label.id] = label
          store.state.annotations.forEach((annotation) => {
            if (annotation.tag !== label.id) return
            if (!labelMap[annotation.tag]) return
            if (!groups[label.id]) {
              groups[label.id] = {
                color: this.convertTagToColor(label.id),
                isFill: annotation.isFill,
                isShow: annotation.isShow,
                isIndeterminate: false,
                isFills: [],
                isShows: [],
                annotations: []
              }
            }
            // 剪切内环 不单独成一个选项
            if (annotation.type === 'Polygon') {
              annotation = annotation as PolygonAnnotation
              if (annotation.ringType === RingType.CUT) return
            }
            groups[label.id].isShow = groups[label.id].isShow && annotation.isShow
            groups[label.id].isFill = groups[label.id].isFill && annotation.isFill
            const index = groups[label.id].annotations.length
            if (annotation.isFill) {
              groups[label.id].isFills.push(index)
            }
            if (annotation.isShow) {
              groups[label.id].isShows.push(index)
            }
            groups[label.id].annotations.push(annotation)
            groups[label.id].isIndeterminate = groups[label.id].isShows.length > 0 && groups[label.id].annotations.length > groups[label.id].isShows.length
          })
        })
        return groups
      }
    }
  },
  methods: {
    convertTagToColor (labelId: string): string {
      const labels: Label[] = store.getters.labels
      for (let i = 0; i < labels.length; ++i) {
        if (labels[i].id === labelId) {
          return labels[i].color
        }
      }

      return '#ffffff'
    },

    getNameFromTag (tag: string): string {
      const labels: Label[] = store.getters.labels
      for (let i = 0; i < labels.length; ++i) {
        if (labels[i].id === tag) {
          return labels[i].name
        }
      }
      return '#'
    },

    getAnnotationInnerCut (annotation: Annotation): Annotation[] {
      const annotations: Annotation[] = []
      if (annotation.type === 'Polygon') {
        annotation = annotation as PolygonAnnotation
        for (const id of annotation.innerRingIDs) {
          const annotationT = store.state.annotations.find((item) => item.id === id) as PolygonAnnotation
          if (annotationT.ringType === RingType.CUT) {
            annotations.push(annotationT)
          }
        }
      }
      return annotations
    },

    handleLabelsShowChange (isShow: boolean, labelId: string): void {
      store.state.annotations = store.state.annotations.map(annotation => {
        if (annotation.tag === labelId) {
          annotation.isShow = isShow
        }
        return annotation
      })
      store.dispatch('updateCanvas')
    },

    handleAnnotationShowChange (isShows: number[], labelId: string): void {
      // console.log('annotation show change', isShows)
      let index = 0
      store.state.annotations = store.state.annotations.map(annotation => {
        if (annotation.tag === labelId) {
          if (annotation.type === 'Polygon') {
            annotation = annotation as PolygonAnnotation
            if (annotation.ringType === RingType.CUT) {
              return annotation
            }
            annotation.isShow = isShows.includes(index)
            index += 1
            for (const id of annotation.innerRingIDs) {
              const annotationT = store.state.annotations.find((item) => item.id === id) as PolygonAnnotation
              if (annotationT.ringType === RingType.CUT) {
                annotationT.isShow = annotation.isShow
              }
            }
          } else if (annotation.type === 'Rect') {
            annotation.isShow = isShows.includes(index)
            index += 1
          }
        }
        return annotation
      })
      store.dispatch('updateCanvas')
    },

    handleLabelsFillChange (isFill: boolean, labelId: string): void {
      isFill = !isFill
      store.state.annotations = store.state.annotations.map(annotation => {
        if (annotation.tag === labelId) {
          annotation.isFill = isFill
        }
        return annotation
      })
      store.dispatch('updateCanvas')
    }
  }
})
</script>

<style lang="less" scoped>
.annotation-list-panel {
  overflow: hidden;
}

.annotation-list {
  display: block;
  height: calc(100% - 36px);
  overflow-y: auto;
}

.div-fill-flag-as {
  width: 24px;
  height: 24px;
  margin-left: 10px;
  margin-top: 2px;
  border: 1px solid;
  -webkit-border-radius: 50%;
  -moz-border-radius: 50%;
  border-radius: 50%;
}

.annotation-tag {
  position: relative;
  display: flex;
  align-items: center;
  margin: 0;
  padding: 4px;
  font-size: 16px;
  color: #fff;
  > span {
    position: relative;
    top: 2px;
    width: 32px;
    height: 12px;
    margin-right: 8px;
  }
}

.annotation-geometries {
  .annotation-outer {
    display: flex;
    flex-direction: column;
    > .el-checkbox {
      margin: 4px 24px;
      border-bottom: 1px solid #aaa;
      &:hover {
        background: #666;
      }
    }
    .annotation-inner {
      display: flex;
      flex-direction: column;
      > div {
        margin: 4px 24px 4px 64px;
        border-bottom: 1px solid #aaa;
        > span {
          display: block;
          font-size: 14px;
          color: #ccc !important;;
        }
      }
    }
  }
}

.annotation-geometry {
  display: flex;
  justify-content: space-between;
  > span {
    display: block;
    font-size: 14px;
    margin-right: 20px;
  }
  .name {
    color: #ccc !important;;
  }
  .closing {
    color: rgba(255, 0, 0, 0.75) !important;
  }
  &:hover {
    background: #666;
  }
  .div-fill-flag-a {
    width: 15px;
    height: 15px;
    margin-left: 8px;
    border: 1px solid;
    -webkit-border-radius: 50%;
    -moz-border-radius: 50%;
    border-radius: 50%;
  }
  .div-levelSet {
    width: 18px;
    height: 18px;
    margin: 0 0 2px 10px;
    border: 2px dashed #888;
    text-align: center;
    color: #ccc
  }
}
</style>
