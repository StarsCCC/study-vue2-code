/*
 * @Author: simon
 * @Description:
 * @LastEditors: simon
 */
/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'
import config from '../config'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 * 管理订阅者和给订阅者发布订阅
 */
export default class Dep {
  static target: ?Watcher; //目标（观察者）
  id: number; // 唯一id
  subs: Array<Watcher>; // 订阅者列表

  constructor () {
    this.id = uid++
    this.subs = []
  }
  // 添加订阅者
  addSub (sub: Watcher) {
    this.subs.push(sub)
  }
  // 移除订阅者
  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }
  // 触发观察者的addDep方法
  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }
  // 发布订阅信息
  notify () {
    // stabilize the subscriber list first
    const subs = this.subs.slice() // 保证订阅发布的过程中，不出现新增的订阅用户
    if (process.env.NODE_ENV !== 'production' && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      subs.sort((a, b) => a.id - b.id) // 升序,保证先订阅的先接收信息
    }
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update() // 观察者中的更新方法,触发虚拟dom的更新
    }
  }
}

// 当前正在评估的目标观察者。
// 这是全局唯一的，因为一次只能有一个观察者
// 一次只能评估一个观察者。
// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
Dep.target = null
const targetStack = []

export function pushTarget (target: ?Watcher) {
  targetStack.push(target)
  Dep.target = target
}

export function popTarget () {
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}
