<template>
  <div class="toolFeatures">
    <div ref="toolsDiv" id="tools">
      <div
              :class="{toolSet: true, toolSelect: true, active: mode === OpMode.Select}"
              title="选 择"
              @click="changeMode(OpMode.Select)"
      ></div>
      <div
              :class="{toolSet: true, toolDelete: true}"
              title="删 除"
              @click="changeMode(OpMode.Delete)"
      ></div>
      <div
              v-if="label && label.type === 'Rect'"
              :class="{toolSet: true, toolRect: true, active: mode === OpMode.Rect}"
              title="矩 形"
              @click="changeMode(OpMode.Rect)"
      ></div>
      <div
              v-if="label && label.type === 'Polygon'"
              :class="{toolSet: true, toolEraser: true, active: mode === OpMode.Eraser}"
              title="橡皮檫"
              @click="changeMode(OpMode.Eraser)"
      ></div>
      <div
              v-if="label && label.type === 'Polygon'"
              :class="{toolSet: true, toolCurve: true, active: mode === OpMode.Curve}"
              title="曲 线"
              @click="changeMode(OpMode.Curve)"
      ></div>
      <div
              v-if="label && label.type === 'Polygon'"
              :class="{toolSet: true, toolIntelligentScissors: true, active: mode === OpMode.IntelligentScissors}"
              title="智能剪刀"
              @click="changeMode(OpMode.IntelligentScissors)"
      ></div>
      <div
              v-if="label && label.type === 'Polygon'"
              :class="{toolSet: true, active: mode === OpMode.GraphCut}"
              title="GraphCut智能分割"
              @click="useGraphCutMode"
      >G</div>
      <div v-if="label && label.type === 'Polygon' && mode === OpMode.GraphCut">
        <div class="separator"></div>
        <div
                :class="{toolSet: true, toolRect: true, active: graphCutMode === GraphCutOpMode.Rect}"
                title="候选框"
                @click="changeGraphCutMode(GraphCutOpMode.Rect)"
        ></div>
<!--        <div-->
<!--                :class="{toolSet: true}"-->
<!--                title="前 景"-->
<!--        >F</div>-->
<!--        <div-->
<!--                :class="{toolSet: true}"-->
<!--                title="背 景"-->
<!--        >B</div>-->
<!--        <div-->
<!--                :class="{toolSet: true}"-->
<!--                title="清 空"-->
<!--        >D</div>-->
        <div
                :class="{toolSet: true}"
                title="分 割"
                @click="useGraphCutForCutting"
        >C</div>
        <div
                :class="{toolSet: true}"
                title="完 成"
                @click="saveGraphCutResults"
        >S</div>
        <div class="separator"></div>
      </div>
      <div
              v-if="label && label.type === 'Polygon'"
              :class="{toolSet: true, active: useLevelSet}"
              title="LevelSet智能分割下一张图片"
              @click="useLevelSetCallback"
      >L</div>
    </div>
    <div class="separator"></div>
    <div
            :class="{toolSet: true, toolImageResize: true}"
            title="图片适应窗口"
            @click="resizeImageSize"
    >
    </div>
    <div
      :class="{toolSet: true, active: isShowScalePanel}"
      title = "缩略图窗口"
      @click="showScalePanel"
    >
        H
    </div>
    <div class="separator"></div>
    <div ref="revoke">
      <div class="toolSet revokeBack" title="撤 销" @click="changeMode(OpMode.Undo)"></div>
      <div class="toolSet revokeRedo" title="重 做" @click="changeMode(OpMode.Redo)"></div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import store, { OpMode } from '../store'
import { Label } from '@/api/dataset'
import { GraphCutOpMode } from '@/api/annotation'

export default Vue.extend({
  name: 'tool-panel',

  computed: {
    mode (): OpMode {
      return store.getters.mode
    },
    OpMode (): {} {
      return OpMode
    },
    graphCutMode (): GraphCutOpMode {
      return store.getters.graphCutMode
    },
    GraphCutOpMode (): {} {
      return GraphCutOpMode
    },
    label (): Label {
      return store.getters.label
    },
    isShowScalePanel (): boolean {
      return store.state.showScalePanel
    },
    useLevelSet (): boolean {
      return store.state.useLevelSet
    }
  },

  methods: {
    changeMode (mode: OpMode): void {
      store.commit('setMode', mode)
    },
    showScalePanel (): void {
      store.commit('setShowScalePanel', !store.state.showScalePanel)
    },
    resizeImageSize (): void {
      store.commit('setResizeImageFlag')
    },
    useLevelSetCallback (): void {
      store.dispatch('EnableUseLevelSet', !store.state.useLevelSet)
    },
    useGraphCutMode (): void {
      this.changeMode(OpMode.GraphCut)
      store.commit('initGraphCutData')
    },
    changeGraphCutMode (mode: GraphCutOpMode): void {
      console.log('change cut mode')
    },
    useGraphCutForCutting (): void {
      store.dispatch('useGraphCutForCutting')
    },
    saveGraphCutResults (): void {
      store.dispatch('saveGraphCutResults')
    }
  }
})
</script>

<style lang="less" scoped>
.toolFeatures {
  background: #21293c;
  width: 50px;
  height: 100%;
  position: relative;
  .separator {
    width: 100%;
    height: 2px;
    background: #999999;
    margin: 0 auto;
    -webkit-border-radius: 5px;
    -moz-border-radius: 5px;
    border-radius: 5px;
  }
  .toolSet {
    width: 40px;
    height: 40px;
    margin: 5px;
    -webkit-border-radius: 5px;
    -moz-border-radius: 5px;
    border-radius: 5px;
    font-size: 16px;
    color: #999999;
    line-height: 40px;
    text-align: center;
    cursor: pointer;
  }
  .toolSet:hover {
    background: #767a84;
    color: #ffffff;
  }
  .toolSet.active {
    background: #767a84;
    color: #ffffff;
  }
  .openFolder {
    background: url("../assets/openfiles.png") no-repeat 50%;
    background-size: 70%;
  }
  .openFolder:hover {
    background: #757a84 url("../assets/openfiles2.png") no-repeat 50%;
    background-size: 70%;
  }
  .saveJson {
    background: url("../assets/download.png") no-repeat 50%;
    background-size: 70%;
  }
  .saveJson:hover {
    background: #757a84 url("../assets/download2.png") no-repeat 50%;
    background-size: 70%;
  }
  .uploadImages {
    background: url("../assets/upload.png") no-repeat 50%;
    background-size: 70%;
  }
  .uploadImages:hover {
    background: #757a84 url("../assets/upload2.png") no-repeat 50%;
    background-size: 70%;
  }
  .toolSelect {
    background: url("../assets/select1.png") no-repeat 50%;
    background-size: 60%;
  }
  .toolSelect.active {
    background: #757a84 url("../assets/select2.png") no-repeat 50%;
    background-size: 60%;
  }
  .toolSelect:hover {
    background: #757a84 url("../assets/select2.png") no-repeat 50%;
    background-size: 60%;
  }
  .toolDelete {
    background: url("../assets/delete1.png") no-repeat 50%;
    background-size: 60%;
  }
  .toolDelete.active {
    background: #757a84 url("../assets/delete2.png") no-repeat 50%;
    background-size: 60%;
  }
  .toolDelete:hover {
      background: #757a84 url("../assets/delete2.png") no-repeat 50%;
      background-size: 60%;
  }

  .toolDrag {
    background: url("../assets/drag1.png") no-repeat 50%;
    background-size: 70%;
  }
  .toolDrag.active {
    background: #757a84 url("../assets/drag2.png") no-repeat 50%;
    background-size: 70%;
  }
  .toolDrag:hover {
    background: #757a84 url("../assets/drag2.png") no-repeat 50%;
    background-size: 70%;
  }

  .toolEraser {
    background: url("../assets/eraser.png") no-repeat 50%;
    background-size: 70%;
  }
  .toolEraser.active {
    background: #757a84 url("../assets/eraser2.png") no-repeat 50%;
    background-size: 70%;
  }
  .toolEraser:hover {
    background: #757a84 url("../assets/eraser2.png") no-repeat 50%;
    background-size: 70%;
  }

  .toolFill {
    background: url("../assets/fill.png") no-repeat 50%;
    background-size: 70%;
  }
  .toolFill.active {
    background: #757a84 url("../assets/fill2.png") no-repeat 50%;
    background-size: 70%;
  }
  .toolFill:hover {
    background: #757a84 url("../assets/fill2.png") no-repeat 50%;
    background-size: 70%;
  }

  .toolRect {
    background: url("../assets/rectangle.png") no-repeat 50%;
    background-size: 70%;
  }
  .toolRect.active {
    background: #757a84 url("../assets/rectangle2.png") no-repeat 50%;
    background-size: 70%;
  }
  .toolRect:hover {
    background: #757a84 url("../assets/rectangle2.png") no-repeat 50%;
    background-size: 70%;
  }

  .toolCurve {
    background: url("../assets/curve.png") no-repeat 50%;
    background-size: 70%;
  }
  .toolCurve.active {
    background: #757a84 url("../assets/curve2.png") no-repeat 50%;
    background-size: 70%;
  }
  .toolCurve:hover {
    background: #757a84 url("../assets/curve2.png") no-repeat 50%;
    background-size: 70%;
  }

  .toolIntelligentScissors {
    background: url("../assets/lasso.png") no-repeat 50%;
    background-size: 70%;
  }
  .toolIntelligentScissors.active {
    background: #757a84 url("../assets/lasso2.png") no-repeat 50%;
    background-size: 70%;
  }
  .toolIntelligentScissors:hover {
    background: #757a84 url("../assets/lasso2.png") no-repeat 50%;
    background-size: 70%;
  }

  .toolImageResize {
    background: url("../assets/image_resize.png") no-repeat 50%;
    background-size: 70%;
  }
  .toolImageResize:hover {
    background: #757a84 url("../assets/image_resize2.png") no-repeat 50%;
    background-size: 70%;
  }

  .revokeBack {
    background: url("../assets/back1.png") no-repeat 50%;
    background-size: 70%;
  }
  .revokeBack:hover {
    background: #757a84 url("../assets/back2.png") no-repeat 50%;
    background-size: 70%;
  }
  .revokeRedo {
    background: url("../assets/redo1.png") no-repeat 50%;
    background-size: 70%;
  }
  .revokeRedo:hover {
    background: #757a84 url("../assets/redo2.png") no-repeat 50%;
    background-size: 70%;
  }
}
</style>
