/* @flow */
/* globals MutationObserver */

import { noop } from 'shared/util'
import { handleError } from './error'
import { isIE, isIOS, isNative } from './env'

export let isUsingMicroTask = false // 正在进行微任务

const callbacks = [] // 回调收集，在下一个微任务/宏任务完成的时候执行
let pending = false // 是否正在处理（promise的pending状态）

// 处理nextTick的回调方法
function flushCallbacks () {
  pending = false
  const copies = callbacks.slice(0)
  callbacks.length = 0
  // 在当前执行栈中把所有callback执行，执行相应的回调函数
  for (let i = 0; i < copies.length; i++) {
    copies[i]()
  }
}

// Here we have async deferring wrappers using microtasks.
// In 2.5 we used (macro) tasks (in combination with microtasks).
// However, it has subtle problems when state is changed right before repaint
// (e.g. #6813, out-in transitions).
// Also, using (macro) tasks in event handler would cause some weird behaviors
// that cannot be circumvented (e.g. #7109, #7153, #7546, #7834, #8109).
// So we now use microtasks everywhere, again.
// A major drawback of this tradeoff is that there are some scenarios
// where microtasks have too high a priority and fire in between supposedly
// sequential events (e.g. #4521, #6690, which have workarounds)
// or even between bubbling of the same event (#6566).
// 这里我们有使用微任务的异步延迟包装器。
// 在2.5中，我们使用了（宏）任务（与微任务相结合）。
// 然而，当状态在重绘前发生变化时，它有一些微妙的问题
// (例如#6813, out-in transitions)。
// 另外，在事件处理程序中使用（宏）任务会导致一些奇怪的行为。
//无法规避（例如#7109, #7153, #7546, #7834, #8109）。
// 所以我们现在又到处使用微任务。
// 这种权衡的一个主要缺点是，在某些情况下
// 微任务的优先级太高，而且是在所谓的 "连续事件 "之间启动。
// 连续的事件（例如，#4521，#6690，它们有解决方法）。
//甚至在同一事件的冒泡之间（#6566）。
let timerFunc

// The nextTick behavior leverages the microtask queue, which can be accessed
// via either native Promise.then or MutationObserver.
// MutationObserver has wider support, however it is seriously bugged in
// UIWebView in iOS >= 9.3.3 when triggered in touch event handlers. It
// completely stops working after triggering a few times... so, if native
// Promise is available, we will use it:
/* istanbul ignore next, $flow-disable-line */
// nextTick行为利用了微任务队列，它可以通过本地的Promise.then或MutationObserver访问。
// 通过本地Promise.then或MutationObserver。
// MutationObserver有更广泛的支持，但是它在iOS >= 9.3.3版本的UIWebView中被严重破坏了。
// 在iOS >= 9.3.3的UIWebView中，当在触摸事件处理程序中被触发时，它被严重破坏。它
// 触发几次后就完全停止工作了......所以，如果本地的
// Promise是可用的，我们将使用它。
/* istanbul ignore next, $flow-disable-line */
if (typeof Promise !== 'undefined' && isNative(Promise)) {
  const p = Promise.resolve() // 走微任务更新
  timerFunc = () => {
    console.log('微任务队列执行')
    p.then(flushCallbacks)
    // In problematic UIWebViews, Promise.then doesn't completely break, but
    // it can get stuck in a weird state where callbacks are pushed into the
    // microtask queue but the queue isn't being flushed, until the browser
    // needs to do some other work, e.g. handle a timer. Therefore we can
    // "force" the microtask queue to be flushed by adding an empty timer.
    if (isIOS) setTimeout(noop)
  }
  isUsingMicroTask = true
} else if (!isIE && typeof MutationObserver !== 'undefined' && (
  isNative(MutationObserver) ||
  // PhantomJS and iOS 7.x
  MutationObserver.toString() === '[object MutationObserverConstructor]'
)) {

  // Use MutationObserver where native Promise is not available,
  // e.g. PhantomJS, iOS7, Android 4.4
  // (#6466 MutationObserver is unreliable in IE11)
  let counter = 1
  const observer = new MutationObserver(flushCallbacks)
  const textNode = document.createTextNode(String(counter))
  observer.observe(textNode, {
    characterData: true
  })
  timerFunc = () => {

    counter = (counter + 1) % 2
    textNode.data = String(counter)
  }
  isUsingMicroTask = true
} else if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
  // Fallback to setImmediate.
  // Techinically it leverages the (macro) task queue,
  // but it is still a better choice than setTimeout.

  timerFunc = () => {

    setImmediate(flushCallbacks)
  }
} else {
  // Fallback to setTimeout.
  timerFunc = () => {

    setTimeout(flushCallbacks, 0)
  }
}

// nextTick 接收一个回调函数 和一个对象
export function nextTick (cb?: Function, ctx?: Object) {
  let _resolve // 声明一个私有的resolve变量
  // callbacks 推进去一个回调函数
  callbacks.push(() => {
    if (cb) { // 如果是回调方法 则执行
      try {
        cb.call(ctx) // 执行并且修改回调函数，this指向当前实例
      } catch (e) {
        handleError(e, ctx, 'nextTick')
      }
    } else if (_resolve) { // 如果私有的resolve执行执行，则把
      _resolve(ctx)
    }
  })

  if (!pending) {
    pending = true
    timerFunc()
  }
  // $flow-disable-line 不传cb的时候 提供一个 Promise 化的调用 例如：nextTick().then(() => {})
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(resolve => {
      _resolve = resolve
    })
  }
}
