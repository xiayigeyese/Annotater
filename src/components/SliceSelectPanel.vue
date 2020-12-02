<template>
  <div class="panel">
    <h2 class="section-title">影像设置</h2>

    <div>
      <span>数据组</span>
      <div class="group-info">
        <span>{{ group ? group.name : '未选择'}} </span>
        <el-button
          type="info"
          size="mini"
          @click="showGroupModal = true"
        >
          更换
        </el-button>
      </div>
      <data-group-select-modal
        :visible="showGroupModal"
        :onOk="changeGroup"
        @cancel="showGroupModal = false"
      ></data-group-select-modal>
    </div>

    <div>
      <span>数据</span>
      <div>
        <div>{{ dataset ? dataset.name : '未选择' }}</div>
        <div>
          <el-button
            size="mini"
            :disabled="datasets.length === 0 || dataset.id === datasets[0].id"
            @click="prevDataset"
          >
            上一个
          </el-button>
          <el-button
            size="mini"
            :disabled="datasets.length === 0 || dataset.id === datasets[datasets.length - 1].id"
            @click="nextDataset"
          >
            下一个
          </el-button>
          <el-button
            type="info"
            size="mini"
            :disabled="!group"
            @click="showDatasetModal = true"
          >
            选择
          </el-button>
        </div>
      </div>
      <dataset-select-modal
        v-if="group !== null"
        :visible="showDatasetModal"
        :current="$store.state.datasetIdx"
        :group="group"
        @change="changeDatasetIdx"
        @cancel="showDatasetModal = false"
      ></dataset-select-modal>
    </div>

    <div>
      <span>切 片</span>
      <div>
        <div style="display: flex;">
          <el-select
            :value="axis"
            :disabled="!dataset"
            @change="changeAxis"
            size="mini"
            style="width: 80px; margin-right: 8px;"
          >
            <el-option value="x" label="X方向" />
            <el-option value="y" label="Y方向" />
            <el-option value="z" label="Z方向" />
          </el-select>
          <el-input-number
            :value="index"
            :min="0"
            :max="dimension"
            :step="1"
            :disabled="!dataset"
            label="切片索引"
            size="mini"
            @change="changeSliceIndex"
          />
        </div>
        <div>
          <el-slider
            v-model="index"
            :min="0"
            :max="dimension"
            :step="1"
            :disabled="!dataset"
            :debounce="500"
            @change="changeSliceIndex"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import store from '../store'
import DataGroupSelectModal from './DataGroupSelectModal.vue'
import DatasetSelectModal from './DatasetSelectModal.vue'
import { DatasetGroup } from '@/api/group'

const DimensionToIndex = {
  x: 0,
  y: 1,
  z: 2
}

export default Vue.extend({
  name: 'dataset-panel',
  components: {
    DataGroupSelectModal,
    DatasetSelectModal
  },

  data () {
    return {
      showGroupModal: false,
      showDatasetModal: false
    }
  },

  computed: {
    group () {
      return store.state.group
    },

    datasets () {
      return store.getters.datasets
    },

    dataset () {
      return store.getters.dataset
    },

    axis () {
      return store.state.axis
    },

    index: {
      get () {
        const dataset = store.getters.dataset
        if (!dataset) {
          return 0
        }
        return store.getters.index
      },
      set (newValue: number) {
        store.commit('setSliceIndex', newValue)
      }
    },

    // index () {
    //   const dataset = store.getters.dataset
    //   if (!dataset) {
    //     return 0
    //   }
    //   return store.getters.index
    // },

    dimension () {
      const dataset = store.getters.dataset

      if (!dataset) return 1

      return dataset.dimensions[DimensionToIndex[store.state.axis]] - 1
    }
  },
  methods: {
    changeAxis (axis: 'x' | 'y' | 'z') {
      store.dispatch('setAxisAndUpdate', axis)
    },

    changeDatasetIdx (datasetIdx: number) {
      store.dispatch('setDatasetIdxAndUpdate', datasetIdx)
      this.showDatasetModal = false
    },

    changeSliceIndex (index: number) {
      store.dispatch('setSliceIndexAndUpdate', index)
    },

    changeGroup (group: DatasetGroup) {
      store.dispatch('setGroupAndUpdate', group)
      this.showGroupModal = false
    },

    prevDataset () {
      const { datasetIdx, group } = store.state
      if (!group || datasetIdx === -1) return

      if (datasetIdx === 0) return

      store.dispatch('setDatasetIdxAndUpdate', datasetIdx - 1)
    },

    nextDataset () {
      const { datasetIdx, group } = store.state
      if (!group || datasetIdx === -1) return

      const num = group.datasets.length

      if (num === datasetIdx - 1) return

      store.dispatch('setDatasetIdxAndUpdate', datasetIdx + 1)
    }
  }
})
</script>

<style lang="less">
.panel {
  display: flex;
  flex-direction: column;
  color: #fff;
  padding-bottom: 8px;
  * {
    box-sizing: border-box;
  }
  > div {
    display: flex;
    padding: 0 8px;
    margin: 4px 0;
    width: 100%;
    + div {
      margin-top: 12px;
    }
    > span {
      display: block;
      width: 52px;
      height: 24px;
      line-height: 24px;
      font-size: 14px;
    }
  }
  .el-dialog {
    margin: auto;
    width: 50%;
  }
}

.section-title {
  margin: 0;
  height: 36px;
  padding: 4px 8px;
  font-size: 18px;
  color: #fff;
  background: #212d3f;
  box-shadow: 0 1px 3px 0 #3c5167;
  box-sizing: border-box;
}

.group-info {
  width: 100%;
  display: flex;
  justify-content: space-between;
  > span {
     margin-left: 8px;
  }
}
</style>
