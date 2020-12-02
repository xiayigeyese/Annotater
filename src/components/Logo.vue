<template>
  <div class="logo-group">
    <div class="logo"></div>
    <div class="logoTitle">Annotater</div>
    <div class="setting-btn">
      <i class="el-icon-s-tools" @click="showSettingModal"></i>
    </div>
    <el-dialog
      title="设置"
      :visible.sync="settingModalVisible"
      width="30%"
      :before-close="handleClose"
    >
      <div>
        <span>服务端地址：</span>
        <el-input v-model="server"></el-input>
      </div>
      <span slot="footer" class="dialog-footer">
        <el-button @click="handleClose">取 消</el-button>
        <el-button type="primary" @click="updateServer">确 定</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script lang="tes">
import Vue from 'vue'
import store from '../store'

export default Vue.extend({
  name: 'logo',
  data () {
    return {
      server: store.state.server,
      settingModalVisible: false
    }
  },
  methods: {
    showSettingModal () {
      this.server = store.state.server
      this.settingModalVisible = true
    },
    handleClose () {
      this.settingModalVisible = false
    },
    updateServer () {
      store.commit('setServer', this.server)
      this.$message.success('更新设置成功')
      this.settingModalVisible = false
    }
  }
})
</script>

<style lang="less">
.logo-group {
  position: relative;
  margin-left: 5px;
  width: 100%;
  height: 45px;
  display: flex;
  .logo {
    margin: 2px;
    width: 42px;
    height: 42px;
    background: url("../assets/logo1.jpg") no-repeat 0 0;
    -webkit-background-size: 100%;
    background-size: 100%;
    -webkit-border-radius: 5px;
    -moz-border-radius: 5px;
    border-radius: 5px;
  }
  .logoTitle {
    text-indent: 10px;
    font-size: 25px;
    line-height: 40px;
    color: #ffffff;
  }
}

.setting-btn {
  position: absolute;
  right: 24px;
  top: 50%;
  transform: translate(0, -50%);
  cursor: pointer;
  > i {
    font-size: 32px;
    color: #efefef;
  }
  &:hover > i {
    transform: scale(1.05);
  }
}
</style>
