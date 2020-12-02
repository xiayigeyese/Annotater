<template>
  <div class="panel">
    <h2 class="section-title">标签设置</h2>

    <div style="display: flex">
      <span style="width: 50px; height: 32px; line-height:32px">标 签</span>
      <div class="label-select">
        <el-select
          :value="$store.state.labelIdx === -1 ? undefined : $store.state.labelIdx"
          @change="changeLabel"
          filterable
          size="small"
          :disabled="$store.state.group === null"
        >
          <el-option
            v-for="(label, idx) in labels"
            :key="label.id"
            :value="idx"
            :label="label.name"
          >
            <div class="label-option">
              <span>{{label.name}}</span>
              <div :style="{backgroundColor: label.color}"></div>
            </div>
          </el-option>
        </el-select>
        <div
          :style="{backgroundColor: label ? label.color : ''}"
          class="div-label-color"
        ></div>
<!--        <div v-if="label && label.type === 'Rect'" class="div-label-shape div-rect"></div>-->
<!--        <div-->
<!--          v-else-if="label && label.type === 'Polygon'"-->
<!--          class="div-label-shape div-polygon"-->
<!--        ></div>-->
        <div
          v-if="$store.state.group !== null"
          class="div-edit edit-icon"
          title="编 辑"
          @click="showEditModal = true"
        />
      </div>
    </div>

    <el-dialog title="标签编辑" :visible.sync="showEditModal" :before-close="checkLabel">
      <div class="label-edit">
        <el-table :data="labels" max-height="400" border hightlihgt-current-row>
          <el-table-column label="标签名称" min-width="12%">
            <template slot-scope="scope">
              <span v-if="editing === scope.row.id">
                <el-input
                  placeholder="请输入内容"
                  size="small"
                  v-model="scope.row.name"
                />
              </span>
              <span v-else>{{scope.row.name}}</span>
            </template>
          </el-table-column>

          <el-table-column label="标签颜色" min-width="12%">
            <template slot-scope="scope">
              <div style="display: flex; align-items: center;">
                <el-color-picker
                  v-if="editing === scope.row.id"
                  size="medium"
                  v-model="scope.row.color"
                ></el-color-picker>
                <div v-else :style="{backgroundColor: scope.row.color}" class="div-label-color"></div>
<!--                <span style="margin-left: 10px">{{scope.row.color}}</span>-->
              </div>
            </template>
          </el-table-column>

          <el-table-column label="标签形状" min-width="12%">
            <template slot-scope="scope">
              <div v-if="scope.row.type === ''" class="div-shape-select">
                <el-select v-model="scope.row.type" placeholder="请选择形状">
                  <el-option
                    v-for="shape in shapeOptions"
                    :key="shape.value"
                    :label="shape.value"
                    :value="shape.value"
                  >
                    <div style="display: flex; justify-content: space-between;">
                      <span style="width: 24px; height:24px;">{{shape.label}}</span>
                    </div>
                  </el-option>
                </el-select>
              </div>

              <div v-else style="display: flex; align-items: center;">
                <div v-if="scope.row.type === 'Rect'" class="div-label-shape div-rect"></div>
                <div v-else class="div-label-shape div-polygon"></div>
                <span style="margin-left: 10px">{{getLabel(scope.row.type)}}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="操作" min-width="12%">
            <template slot-scope="scope">
              <span
                v-if="editing !== scope.row.id"
                class="el-tag el-tag--info el-tag--medium"
                style="cursor: pointer;"
                @click="updateLabel(scope.row, scope.$index)"
              >修改</span>
              <span
                v-else
                class="el-tag el-tag--info el-tag--medium"
                style="cursor: pointer;"
                @click="saveLabel(scope.row, scope.$index)"
              >保存</span>
              <span
                v-if="editing !== scope.row.id"
                class="el-tag el-tag--danger el-tag--medium"
                style="cursor: pointer;"
                @click="deleteLabel(scope.row, scope.$index)"
              >删除</span>
              <span
                v-else
                class="el-tag el-tag--medium"
                style="cursor: pointer;"
                @click="cancelOp(scope.row, scope.$index)"
              >取消</span>
            </template>
          </el-table-column>
        </el-table>
        <el-button
          type="primary"
          size="medium"
          @click="addLabel"
        >
          + 添加
        </el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import store, { OpMode } from '../store'
import { Label } from '../api/dataset'
import { addGroupLabel, removeGroupLabel, updateGroupLabel } from '@/api/group'

type Data = {
  showEditModal: boolean;
  editing: null | Label['id'];
  save: null | Label;
  shapeOptions: Array<{
    value: string;
    label: string;
  }>;
};

export default Vue.extend({
  name: 'label-panel',
  data (): Data {
    return {
      showEditModal: false,
      editing: null,
      save: null,
      shapeOptions: [
        {
          value: 'Rect',
          label: '矩形框'
        },
        {
          value: 'Polygon',
          label: '自定义边界'
        }
      ]
    }
  },
  computed: {
    labels (): Label[] {
      if (!store.state.group) return []

      return store.state.group.labels
    },
    label (): Label {
      return store.getters.label
    }
  },
  methods: {
    getLabel (type: string): string {
      if (type === 'Rect') {
        return '矩形框'
      } else if (type === 'Polygon') {
        return '自定义边界'
      }
      return ''
    },
    addLabel (): void {
      if (store.state.group === null) return

      if (this.editing === null) {
        const label = {
          id: '',
          name: '',
          color: '',
          type: ''
        }
        this.editing = label.id
        store.commit('setLabels', [...store.state.group.labels, label])
      } else {
        this.$message.warning('请先保存当前编辑项')
      }
    },

    updateLabel (row: Label, $index: number): void {
      if (this.editing === null) {
        this.editing = row.id
        this.save = { ...row }
      } else {
        this.$message.warning('请先保存当前编辑项')
      }
    },

    deleteLabel (row: Label, index: number): void {
      if (this.editing === null) {
        // const cloned = [...store.getters.labels]
        const id = store.getters.labels[index].id
        // cloned.splice(index, 1)
        // store.commit('setLabels', cloned)
        store.commit('deleteLabelWithIndex', [index, id])
        if (store.state.group) {
          removeGroupLabel(store.state.server, store.state.group.id, id).catch(err => {
            this.$message.error(err.message)
          })
        }
      } else {
        this.$message.warning('请先保存当前编辑项')
      }
      this.editing = null
      this.save = null
    },

    saveLabel (row: Label, index: number): boolean {
      if (row.name === '') {
        this.$message.warning('标签名不能为空！')
        return false
      } else if (row.color === '') {
        this.$message.warning('标签颜色不能为空！')
        return false
      } else if (row.type === '') {
        this.$message.warning('标签形状不能为空！')
        return false
      }

      if (this.checkLabelInfo(row.name, row.color, index)) {
        if (store.state.group !== null) {
          const { server } = store.state
          if (this.save === null) {
            // 新增标签
            addGroupLabel(server, store.state.group.id, {
              id: '',
              name: row.name,
              color: row.color,
              type: row.type
            }).then((id) => {
              row.id = id
            }).catch((err) => {
              this.$message.error(err.message)
            })
          } else {
            // 更新标签
            const id = this.save.id
            updateGroupLabel(server, store.state.group.id, id, row).catch(err => {
              this.$message.error(err.message)
            })
          }
          this.editing = null
          this.save = null
          return true
        }
      }
      return false
    },

    cancelOp (row: Label, index: number): void {
      if (store.state.group === null) return

      if (this.save === null) {
        const cloned = [...store.state.group.labels]
        cloned.splice(index, 1)
        store.commit('setLabels', cloned)
      } else {
        const cloned = [...store.state.group.labels]
        cloned[index] = this.save
        store.commit('setLabels', cloned)
      }
      this.editing = null
      this.save = null
    },

    checkLabelInfo (name: string, color: string, index = -1): boolean {
      if (store.state.group === null) return false

      const { labels } = store.state.group

      for (let i = 0; i < labels.length; i++) {
        if (i !== index) {
          const label = labels[i]
          if (label.name === name) {
            this.$message.warning('该标签名已存在！')
            return false
          } else if (label.color === color) {
            this.$message.warning('该颜色已使用！')
            return false
          }
        }
      }
      return true
    },

    checkLabel (): void {
      if (this.editing) {
        this.$message.warning('请先保存当前编辑项')
      } else {
        this.showEditModal = false
      }
    },

    changeLabel (labelIdx: number): void {
      // store.commit('setMode', OpMode.None)
      store.commit('setLabelIdx', labelIdx)
    }
  }
  // watch: {
  //   '$store.state.labelIdx' () {
  //     this.label = store.getters.label
  //   }
  // }
})
</script>

<style lang="less" scoped>
.label-select {
  display: flex;
  align-items: center;
  > div {
    display: inline-block;
  }
  .el-select {
    width: 100px;
    height: 30px;
  }
  .div-label-color {
    width: 27px;
    height: 27px;
    margin-left: 10px;
    border: 1px solid #fff;
  }
  .div-label-shape {
    width: 30px;
    height: 30px;
    margin-left: 10px;
    border: 0;
  }
  .div-rect {
    background: url("../assets/rectangle.png") no-repeat 50%;
    background-size: 100%;
  }
  .div-polygon {
    background: url("../assets/polygon.png") no-repeat 50%;
    background-size: 100%;
  }
  .div-edit {
    width: 27px;
    height: 27px;
    margin-left: 15px;
    cursor: pointer;
  }
  .edit-icon {
    background: url("../assets/edit.png") no-repeat 50%;
    background-size: 100%;
  }
  .edit-icon:hover {
    background: url("../assets/edit2.png") no-repeat 50%;
    background-size: 100%;
  }
  .edit-icon:focus {
    background: url("../assets/edit2.png") no-repeat 50%;
    background-size: 100%;
  }
}

.label-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  > div {
    width: 10px;
    height: 10px;
    background: #ff0000;
    display: inline-block;
    -webkit-border-radius: 50%;
    -moz-border-radius: 50%;
    border-radius: 50%;
    margin-left: 5px;
  }
  /*> span:last-child {*/
  /*  width: 24px;*/
  /*  height: 24px;*/
  /*}*/
  /*.div-color {*/
  /*  width: 24px;*/
  /*  height: 24px;*/
  /*}*/
  /*.div-shape {*/
  /*  width: 32px;*/
  /*  height: 32px;*/
  /*}*/
}

.label-edit {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;

  .div-label-color {
    width: 25px;
    height: 25px;
    margin: 0 6px;
    border: 1px solid #000;
  }

  .div-label-shape {
    width: 30px;
    height: 30px;
    margin-left: 10px;
    border: 0;
  }
  .div-rect {
    background: url("../assets/rectangle.png") no-repeat 50%;
    background-size: 100%;
  }
  .div-polygon {
    background: url("../assets/curve.png") no-repeat 50%;
    background-size: 90%;
  }
  .div-shape-select {
    .div-label-shape {
      width: 20px;
      height: 20px;
      // margin-left: 10px;
      border: 0;
    }
    .div-polygon {
      background: url("../assets/polygon.png") no-repeat 50%;
      background-size: 100%;
    }
  }
}

.el-table td,
.el-table th {
  text-align: center;
}

.label-infos {
  display: flex;
  flex-direction: column;
  .label-info {
    display: flex;
    > span {
      width: 80px;
      height: 40px;
      line-height: 40px;
      display: block;
      font-size: 14px;
    }
    > .el-input {
      width: 150px;
      height: 40px;
    }
    > .el-select {
      width: 150px;
      height: 40px;
    }
  }
}
</style>
