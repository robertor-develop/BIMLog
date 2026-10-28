'use strict'

function isMergeableObject(value) {
  return Boolean(value) && typeof value === 'object' && !isSpecial(value)
}

function isSpecial(value) {
  const stringValue = Object.prototype.toString.call(value)
  return stringValue === '[object RegExp]' || stringValue === '[object Date]' || isReactElement(value)
}

const canUseSymbol = typeof Symbol === 'function' && Symbol.for
const reactElementType = canUseSymbol ? Symbol.for('react.element') : 0xeac7

function isReactElement(value) {
  return value.$$typeof === reactElementType
}

function emptyTarget(value) {
  return Array.isArray(value) ? [] : {}
}

function cloneUnlessOtherwiseSpecified(value, options) {
  return options.clone !== false && options.isMergeableObject(value)
    ? deepmerge(emptyTarget(value), value, options)
    : value
}

function defaultArrayMerge(target, source, options) {
  return target.concat(source).map((element) => cloneUnlessOtherwiseSpecified(element, options))
}

function getMergeFunction(key, options) {
  if (!options.customMerge) return deepmerge
  const customMerge = options.customMerge(key)
  return typeof customMerge === 'function' ? customMerge : deepmerge
}

function getEnumerableOwnPropertySymbols(target) {
  return Object.getOwnPropertySymbols
    ? Object.getOwnPropertySymbols(target).filter((symbol) => Object.propertyIsEnumerable.call(target, symbol))
    : []
}

function getKeys(target) {
  return Object.keys(target).concat(getEnumerableOwnPropertySymbols(target))
}

function propertyIsOnObject(object, property) {
  try {
    return property in object
  } catch {
    return false
  }
}

function propertyIsUnsafe(target, key) {
  if (typeof key === 'string' && (key === '__proto__' || key === 'prototype' || key === 'constructor')) {
    return true
  }
  return propertyIsOnObject(target, key)
    && !(Object.prototype.hasOwnProperty.call(target, key) && Object.propertyIsEnumerable.call(target, key))
}

function mergeObject(target, source, options) {
  const destination = {}
  if (options.isMergeableObject(target)) {
    getKeys(target).forEach((key) => {
      if (!propertyIsUnsafe({}, key)) destination[key] = cloneUnlessOtherwiseSpecified(target[key], options)
    })
  }
  getKeys(source).forEach((key) => {
    if (propertyIsUnsafe(target, key)) return
    if (propertyIsOnObject(target, key) && options.isMergeableObject(source[key])) {
      destination[key] = getMergeFunction(key, options)(target[key], source[key], options)
    } else {
      destination[key] = cloneUnlessOtherwiseSpecified(source[key], options)
    }
  })
  return destination
}

function deepmerge(target, source, options) {
  options = options || {}
  options.arrayMerge = options.arrayMerge || defaultArrayMerge
  options.isMergeableObject = options.isMergeableObject || isMergeableObject
  options.cloneUnlessOtherwiseSpecified = cloneUnlessOtherwiseSpecified

  const sourceIsArray = Array.isArray(source)
  const targetIsArray = Array.isArray(target)
  if (sourceIsArray !== targetIsArray) return cloneUnlessOtherwiseSpecified(source, options)
  if (sourceIsArray) return options.arrayMerge(target, source, options)
  return mergeObject(target, source, options)
}

deepmerge.all = function deepmergeAll(array, options) {
  if (!Array.isArray(array)) throw new Error('first argument should be an array')
  return array.reduce((previous, next) => deepmerge(previous, next, options), {})
}

module.exports = deepmerge
