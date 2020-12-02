<template>
  <el-dialog
    title="请选择数据"
    :visible="visible"
    width="30%"
  >
    <div>
      <span>数据列表</span>
      <el-select v-model="value" placeholder="请选择数据">
        <el-option
          v-for="(item, idx) in group.datasets"
          :key="item.id"
          :label="item.name"
          :value="idx">
        </el-option>
      </el-select>
    </div>
    <span slot="footer" class="dialog-footer">
      <el-button @click="$emit('cancel')">取 消</el-button>
      <el-button
        type="primary"
        @click="confirm"
      >
        确 定
      </el-button>
    </span>
  </el-dialog>
</template>

<script lang="ts">
import Vue from 'vue'

export default Vue.extend({
  name: 'dataset-select-modal',

  props: {
    visible: Boolean,
    current: Number,
    group: Object
  },

  data () {
    return {
      value: this.$props.current
    }
  },

  methods: {
    confirm () {
      if (this.value === -1) {
        this.$message.error('请选择数据')
        return
      }

      this.$emit('change', this.value)
    }
  }
})
</script>

<style>

</style>
