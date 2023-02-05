/*
 * @Author: simon
 * @Description:
 * @LastEditors: simon
 */
import Vue from './instance/index'
import { initGlobalAPI } from './global-api/index'
import { isServerRendering } from 'core/util/env'
import { FunctionalRenderContext } from 'core/vdom/create-functional-component'

/**
 * new Vue({}) 的时候 options 指令式api
  */

// 初始化全局api
initGlobalAPI(Vue)

// 运行于服务器服务器, 替换 为服务器渲染
Object.defineProperty(Vue.prototype, '$isServer', {
  get: isServerRendering
})

// ssr渲染节点
Object.defineProperty(Vue.prototype, '$ssrContext', {
  get () {
    /* istanbul ignore next */
    return this.$vnode && this.$vnode.ssrContext
  }
})

// render 方式
// expose FunctionalRenderContext for ssr runtime helper installation
Object.defineProperty(Vue, 'FunctionalRenderContext', {
  value: FunctionalRenderContext
})

Vue.version = '__VERSION__'

export default Vue
