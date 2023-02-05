/* @flow */

import type Watcher from './watcher'
import config from '../config'
import { callHook, activateChildComponent } from '../instance/lifecycle'

import {
  warn,
  nextTick,
  devtools,
  inBrowser,
  isIE
} from '../util/index'

export const MAX_UPDATE_COUNT = 100

const queue: Array<Watcher> = [] // 当前队列(管理watcher)
const activatedChildren: Array<Component> = []
let has: { [key: number]: ?true } = {} // 保持单一watcher
let circular: { [key: number]: number } = {}
let waiting = false // 是否正在等待
let flushing = false
let index = 0

/**
 * Reset the scheduler's state.
 */
function resetSchedulerState () {
  index = queue.length = activatedChildren.length = 0
  has = {}
  if (process.env.NODE_ENV !== 'production') {
    circular = {}
  }
  waiting = flushing = false
}

// Async edge case #6566 requires saving the timestamp when event listeners are
// attached. However, calling performance.now() has a perf overhead especially
// if the page has thousands of event listeners. Instead, we take a timestamp
// every time the scheduler flushes and use that for all event listeners
// attached during that flush.
// 异步边缘案例#6566要求在事件监听器被连接时保存时间戳。
// 连接。然而，调用performance.now()有一个perf开销，特别是在页面有成千上万个事件监听器的情况下。
// 如果该页面有成千上万的事件监听器的话。取而代之的是，我们在调度器每次刷新时间戳时
// 我们在调度器每次刷新时获取一个时间戳，并将其用于所有事件监听器
// 在那次刷新过程中连接的所有事件监听器。
export let currentFlushTimestamp = 0

// Async edge case fix requires storing an event listener's attach timestamp.
let getNow: () => number = Date.now

// Determine what event timestamp the browser is using. Annoyingly, the
// timestamp can either be hi-res (relative to page load) or low-res
// (relative to UNIX epoch), so in order to compare time we have to use the
// same timestamp type when saving the flush timestamp.
// All IE versions use low-res event timestamps, and have problematic clock
// implementations (#9632)
// 确定浏览器正在使用的事件时间戳。恼人的是，这个
// 时间戳既可以是高像素的（相对于页面加载），也可以是低像素的
// (相对于UNIX纪元)，所以为了比较时间，我们必须在保存冲洗时间时使用
//在保存冲洗时间戳时使用相同的时间戳类型。
// 所有的IE版本都使用低分辨率的事件时间戳，并有问题的时钟
// 实现(#9632)
if (inBrowser && !isIE) {
  const performance = window.performance
  if (
    performance &&
    typeof performance.now === 'function' &&
    getNow() > document.createEvent('Event').timeStamp
  ) {
    // if the event timestamp, although evaluated AFTER the Date.now(), is
    // smaller than it, it means the event is using a hi-res timestamp,
    // and we need to use the hi-res version for event listener timestamps as
    // well.
    // 如果事件的时间戳虽然是在Date.now()之后评估的，但却比它小。
    // 小于它，这意味着该事件使用的是高像素的时间戳。
    // 我们需要对事件监听器的时间戳也使用高清晰版本。
    // 我们也需要对事件监听器的时间戳使用高像素版本。
    getNow = () => performance.now()
  }
}

/**
 * Flush both queues and run the watchers.
 */
function flushSchedulerQueue () {
  currentFlushTimestamp = getNow() // 当前执行时间戳
  flushing = true // 开始执行，修改为true
  let watcher, id

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher)
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.
  queue.sort((a, b) => a.id - b.id) // 当前任务队列升序执行

  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  // 按照队列执行策略，先入先出; 先更新子组件的beforeUpdate钩子再更新父组件的beforeUpdate钩子
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    if (watcher.before) {
      watcher.before() // vNode 的方法，执行beforeUpdate钩子函数
    }
    id = watcher.id
    has[id] = null
    watcher.run() // 执行观察者的调度器
    // in dev build, check and stop circular updates.
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' + (
            watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`
          ),
          watcher.vm
        )
        break
      }
    }
  }

  // keep copies of post queues before resetting state
  const activatedQueue = activatedChildren.slice()
  const updatedQueue = queue.slice() // 拷贝当前的队列，后面来的重新收集

  resetSchedulerState() // 重置当前的全局队列，收集下一次更新的任务

  // call component updated and activated hooks
  callActivatedHooks(activatedQueue)
  callUpdatedHooks(updatedQueue) // 执行更新

  // devtool hook
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }
}

function callUpdatedHooks (queue) {
  // 执行更新，执行栈策略，当前任务先入后出 先更新子组件后更新父组件
  let i = queue.length
  while (i--) {
    const watcher = queue[i]
    const vm = watcher.vm
    if (vm._watcher === watcher && vm._isMounted && !vm._isDestroyed) {
      callHook(vm, 'updated')
    }
  }
}

/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 * keep-alive 组件缓存更新策略
 */
export function queueActivatedComponent (vm: Component) {
  // setting _inactive to false here so that a render function can
  // rely on checking whether it's in an inactive tree (e.g. router-view)
  vm._inactive = false
  activatedChildren.push(vm)
}

function callActivatedHooks (queue) {
  // 队列的方式更新子组件
  for (let i = 0; i < queue.length; i++) {
    queue[i]._inactive = true
    activateChildComponent(queue[i], true /* true */)
  }
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 * 将一个观察者推入观察者队列。
 * 具有重复ID的工作将被跳过，除非它是在
 * 在队列被刷新时推送。
 * 观察者数据变化的时候会触发更新，更新是走微任务队列
 */
export function queueWatcher (watcher: Watcher) {
  const id = watcher.id
  if (has[id] == null) { // 当前has中不存在相同的watcherId
    has[id] = true
    if (!flushing) { // 没有还没执行，把当前watcher 推送到queue中
      queue.push(watcher)
    } else {
      // if already flushing, splice the watcher based on its id
      // if already past its id, it will be run next immediately.
      // 找到当前watcerId对应的位置，插入队列
      let i = queue.length - 1
      while (i > index && queue[i].id > watcher.id) {
        i--
      }
      queue.splice(i + 1, 0, watcher)
    }
    // 当前队列执行后，后来者插入当前执行栈中，保证只更新一次
    // queue the flush
    if (!waiting) {
      waiting = true

      // 不是正式版本&&不是异步更新(可以走同步更新？)
      if (process.env.NODE_ENV !== 'production' && !config.async) {
        flushSchedulerQueue()
        return
      }
      console.log('走微任务', '推送到微任务队列中', '更新走的是微任务队列')
      nextTick(flushSchedulerQueue)
    }
  }
}
