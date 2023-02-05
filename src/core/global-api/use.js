/*
 * @Author: simon
 * @Description:
 * @LastEditors: simon
 */
/* @flow */

import { toArray } from '../util/index'

export function initUse (Vue: GlobalAPI) {
  Vue.use = function (plugin: Function | Object) {
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    // 插件已经实例化一次
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    const args = toArray(arguments, 1)
    args.unshift(this) // 插入this
    if (typeof plugin.install === 'function') {
      plugin.install.apply(plugin, args) // 修改this指向plugin，执行插件中的install方法
    } else if (typeof plugin === 'function') {
      plugin.apply(null, args)
    }
    installedPlugins.push(plugin)
    return this
  }
}
