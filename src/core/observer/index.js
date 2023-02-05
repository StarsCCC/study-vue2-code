/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true // 应该有Observe观察者

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 * 观察者类，它被附加到每个被观察的
 * 对象。一旦附着，观察者就会将目标
 * 对象的属性键转换成getter/setters，以
 * 收集依赖关系并调度更新。
 */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data 以该对象为根 $data 的 vm数量

  constructor (value: any) {
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0
    def(value, '__ob__', this) // 给每一个value绑定一个__ob__属性
    if (Array.isArray(value)) {
      if (hasProto) {
        protoAugment(value, arrayMethods) // 给每一个value 都绑定数组的原型方法
      } else {
        copyAugment(value, arrayMethods, arrayKeys) // 给每一个value都绑定数组的原型方法，原型中每一个方法都是可观察劫取的
      }
      this.observeArray(value)
    } else {
      this.walk(value)
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   * 走过所有的属性，并将它们转换为
   * getter/setters。这个方法应该只在以下情况下被调用
   * 值类型是Object。
   * 对对象中每一个key进行观测
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   * 观察一个Array项目的列表. 相当于对数组中每一个元素的子集都添加上观察者
   */
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 * 试图为一个值创建一个观察者实例。
 * 如果观察成功，返回新的观察者。
 * 如果该值已经有一个观察者，则返回现有的观察者。
 * asRootData 初始化的时候为true
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  if (!isObject(value) || value instanceof VNode) {
    // value 不是对象 也不是 虚拟节点 则返回
    return
  }
  let ob: Observer | void
  // 原型中有__ob__ 同时 value.__ob__ 是 Observer 类型
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    // shouldObserve 需要观察 isServerRendering 是否是服务器渲染 isPlainObject 判断是否是对象 Object.isExtensible()方法确定对象是否可扩展 （是否可以向其添加新属性
    ob = new Observer(value)
  }
  // 初始化的时候 asRootData为true， 数组中每一个子项 false
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 * 在一个对象上定义一个反应性属性
 * 在什么阶段会给对象定义反应属性昵？
 * 1、初始化注入的时候
 * 2、组件初始化 render的时候（$attrs、$listeners)
 * 3、初始化props的时候
 * 4、初始化data的时候
 * 5、原型中$set的方法
 * 6、
 */
export function defineReactive (
  obj: Object, // 当前要观测的对象
  key: string, // 要观测的key
  val: any, // 要修改的value值
  customSetter?: ?Function, // 定制Setter方法 用于
  shallow?: boolean // initRender的时候用到 为true
) {
  const dep = new Dep() // 实例化 Dep 方法，内部会生成一个唯一id

  const property = Object.getOwnPropertyDescriptor(obj, key) // 返回对象的描述信息
  // 如果当前对象是不可修改的，结束当前的执行
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  const getter = property && property.get
  const setter = property && property.set
  // (不存在get 读的方法 或者 存在set的方法 写入/修改) 同时 当前只传了2个参数，当前的value 为旧值
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }
  // shallow initRender时会是true， observe(val) true 响应式的值，false(返回值是undefined) 不是响应式的值
  let childOb = !shallow && observe(val) // 子对象是否响应式
  Object.defineProperty(obj, key, {
    enumerable: true, // 可枚举
    configurable: true, // 是否可修改 false 不可修改 true 可修改
    get: function reactiveGetter () { // 响应者
      const value = getter ? getter.call(obj) : val // 存在原型中get方法，则执行get方法并返回最新的value值 否则取当前的value值
      // console.log('Dep.target', Dep.target)
      if (Dep.target) { // 如果存在watcher观察者
        dep.depend()  // 调用depend的方法，该方法是使观察者收集当前的依赖dep的id, 如果dep管理的订阅者不存在，则添加订阅者 watcher
        if (childOb) { // 如果需要监听子集的依赖变化
          childOb.dep.depend()
          // 如果当前的value是数组，则深度遍历数组收集依赖变化
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) { // 响应式设定器
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      if (getter && !setter) return
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      childOb = !shallow && observe(newVal)
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  defineReactive(ob.value, key, val)
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 * 当数组被触及时，收集对数组元素的依赖，因为
 * 我们不能像属性获取器那样拦截数组元素的访问。
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
