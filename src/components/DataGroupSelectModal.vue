<template>
  <el-dialog
    title="请选择数据集"
    :visible="visible"
    width="30%"
  >
    <div v-if="loading">
      <div>加载中...<i class="el-icon-loading"></i></div>
    </div>
    <div v-else>
      <div>当前可访问的数据集</div>
      <el-select v-model="value" placeholder="请选择数据集">
        <el-option
          v-for="item in groups"
          :key="item.id"
          :label="item.name"
          :value="item.id">
        </el-option>
      </el-select>
    </div>
    <span slot="footer" class="dialog-footer">
      <el-button @click="$emit('cancel')">取 消</el-button>
      <el-button
        type="primary"
        @click="confirm"
        :disabled="loading"
        :loading="confirming"
      >
        确 定
      </el-button>
    </span>
  </el-dialog>
</template>

<script lang="ts">
import Vue from 'vue'
import store from '../store'
import { getGroups, DatasetGroupList, getGroup } from '../api/group'

type Data = {
  value: string;
  groups: DatasetGroupList;
  loading: boolean;
  confirming: boolean;
}

export default Vue.extend({
  name: 'data-group-select-modal',

  props: {
    visible: Boolean,
    onOk: Function
  },

  data (): Data {
    return {
      value: '',
      loading: false, // waiting for groups data
      confirming: false, // waiting for result
      groups: []
    }
  },

  methods: {
    getData () {
      this.loading = true
      getGroups(store.state.server).then(data => {
        this.groups = data
      }).catch((err) => {
        this.$message.error(err.message)
      }).finally(() => {
        this.loading = false
      })
    },

    confirm () {
      if (!this.value) {
        this.$message.error('请选择数据组')
        return
      }

      this.confirming = true
      getGroup(store.state.server, this.value).then(data => {
        this.onOk(data)
      }).catch(err => {
        this.$message.error(err.message)
      }).finally(() => {
        this.confirming = false
      })
    }
  },

  mounted () {
    this.getData()
  }
})
</script>

<style>

</style>
