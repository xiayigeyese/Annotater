<template>
  <div class="label">
    <div class="canvasMain">
      <tool-panel />
      <viewport />
    </div>
    <div :class="{menuPanel: true, hidden: !$store.state.showMenuPanel }">
      <div class="hideBar">
        <div class="hideButton" @click="$store.state.showMenuPanel = !$store.state.showMenuPanel">
          <div :class="['hideItem', $store.state.showMenuPanel ? 'show' : 'hide']"></div>
        </div>
      </div>
      <div class="toolPanel">
        <logo />
        <slice-select-panel />
        <label-panel />
        <annotation-list />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import Logo from '../components/Logo.vue'
import Viewport from '../components/Viewport.vue'
import SliceSelectPanel from '../components/SliceSelectPanel.vue'
import LabelPanel from '../components/LabelPanel.vue'
import AnnotationList from '../components/AnnotationList.vue'
import ToolPanel from '../components/ToolPanel.vue'

export default Vue.extend({
  name: 'Annotation',
  components: {
    Viewport,
    Logo,
    SliceSelectPanel,
    LabelPanel,
    AnnotationList,
    ToolPanel
  },

  methods: {
    // ===================== 工具面板部分  ===================
    // HideToolPanel () {
    //   this.CanvasReSizeCallback()
    // }

    // HandleAnnotationChange (annotations) {
    //   this.annotationsImage = annotations.map(
    //     ({ tag, comment, type, coordinates }) => {
    //       const data = []
    //       for (let i = 0; i < coordinates[0].length; i += 2) {
    //         data.push({ x: coordinates[0][i], y: coordinates[0][i + 1] })
    //       }
    //       return {
    //         tag,
    //         comment,
    //         type,
    //         coordinates: data
    //       }
    //     }
    //   )
    //   return this.annotationsImage
    // },

    // PackageAnnotations () {
    //   return this.annotationsImage.map(
    //     ({ tag, comment = '', type, coordinates }) => ({
    //       tag,
    //       comment,
    //       type,
    //       coordinates: [
    //         coordinates.reduce((prev, curr) => {
    //           return [...prev, Math.ceil(curr.x), Math.ceil(curr.y)]
    //         }, [])
    //       ]
    //     })
    //   )
    // },

    // ===================== label handle  ===================

    // 标签删除时触发
    // HandleLabelDeleted (labelTagDel, labelNew) {
    //   if (this.image) {
    //     for (let i = this.annotationsImage.length - 1; i >= 0; i--) {
    //       const annotation = this.annotationsImage[i]
    //       if (annotation.tag === labelTagDel) {
    //         this.annotationsImage.splice(i, 1)
    //       }
    //     }
    //   }
    //   if (this.label.name === labelTagDel) {
    //     this.label = labelNew
    //   }
    //   this.HandleLabelChanged()
    // },

    // 标签信息发生改变时触发
    // HandleLabelUpdated (oldLabel, newLabel) {
    //   if (this.image) {
    //     for (let i = this.annotationsImage.length - 1; i >= 0; i--) {
    //       const annotation = this.annotationsImage[i]
    //       if (annotation.tag === oldLabel.name) {
    //         annotation.tag = newLabel.id
    //         annotation.color = newLabel.color
    //       }
    //     }
    //     if (this.label.name === oldLabel.name) {
    //       this.label = newLabel
    //     }
    //     if (this.annotationsTemp.tag === oldLabel.name) {
    //       this.annotationsTemp.tag = newLabel.id
    //       this.annotationsTemp.color = newLabel.color
    //     }
    //     this.UpdateCanvas()
    //   }
    // },

    // HandleCancelUpdate (label) {
    //   if (this.image) {
    //     this.label = label
    //   }
    // },

    // 标签改变时触发
    // HandleLabelChanged () {
    //   for (let i = 0; i < this.toolsDiv.children.length; i++) {
    //     this.toolsDiv.children[i].classList.remove('focus')
    //   }
    //   // this.ResetToolStatus()
    //   if (this.image) {
    //     this.UpdateAnnotations()
    //     this.annotationsTemp = {} as Annotations
    //     // this.UpdateImgCanvas()
    //     this.UpdateCanvas()
    //   }
    // }
  }
})
</script>

<style lang="less" scoped>
p {
  margin: 0;
  padding: 0;
}
.label {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  overflow: hidden;
}

.menuPanel {
  width: 300px;
  height: 100%;
  background: #293245;
  border-left: 1px solid #293245;
  -webkit-box-sizing: border-box;
  -moz-box-sizing: border-box;
  box-sizing: border-box;
  border-top-left-radius: 5px;
  border-bottom-left-radius: 5px;
  display: flex;
  &.hidden {
    width: 18px;
    .toolPanel {
      display: none;
    }
  }
  .hideBar {
    width: 16px;
    height: 100%;
    background: #767a84;
    display: flex;
    align-items: center;
    .hideButton {
      height: 80px;
      width: 100%;
      cursor: pointer;
      background-color: #293245;
      .hideItem {
        height: 100%;
        width: 100%;
      }
      .hide {
        background: url("../assets/prev1.png") no-repeat;
        background-size: 100% 100%;
      }
      .hide.focus {
        background: url("../assets/prev2.png") no-repeat;
        background-size: 100% 100%;
      }
      .hide:hover {
        background: url("../assets/prev2.png") no-repeat;
        background-size: 100% 100%;
      }

      .show {
        background: url("../assets/next1.png") no-repeat;
        background-size: 100% 100%;
      }
      .show.focus {
        background: url("../assets/next2.png") no-repeat;
        background-size: 100% 100%;
      }
      .show:hover {
        background: url("../assets/next2.png") no-repeat;
        background-size: 100% 100%;
      }
    }
  }
}

.toolPanel {
  width: 282px;
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
