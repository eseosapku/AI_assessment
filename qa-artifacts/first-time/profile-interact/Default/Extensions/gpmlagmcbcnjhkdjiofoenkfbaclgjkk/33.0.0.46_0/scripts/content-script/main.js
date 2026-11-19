/*! Copyright (c) 2025 HP Development Company, L.P. */
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 603:
/***/ ((module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Z": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(933);
/* harmony import */ var _node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(476);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
// Imports


var ___CSS_LOADER_EXPORT___ = _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
// Module
___CSS_LOADER_EXPORT___.push([module.id, "/* Firefox */\r\n@supports (-moz-appearance:none) {\r\n    @font-face {\r\n        font-family: \"HP Simplified Light\";\r\n        font-style: normal;\r\n        font-weight: 400;\r\n        src: url(\"moz-extension://__MSG_@@extension_id__/HPSimplified_Lt.ttf\") format(\"truetype\");\r\n    }\r\n}\r\n\r\n/* Chromium browsers */\r\n@supports not (-moz-appearance:none) {\r\n    @font-face {\r\n        font-family: \"HP Simplified Light\";\r\n        font-style: normal;\r\n        font-weight: 400;\r\n        src: url(\"chrome-extension://__MSG_@@extension_id__/HPSimplified_Lt.ttf\") format(\"truetype\");\r\n    }\r\n}", ""]);
// Exports
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);


/***/ }),

/***/ 326:
/***/ ((module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Z": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(933);
/* harmony import */ var _node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(476);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_branding_hp_sure_click_css_font_css__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(603);
// Imports



var ___CSS_LOADER_EXPORT___ = _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
___CSS_LOADER_EXPORT___.i(_node_modules_css_loader_dist_cjs_js_branding_hp_sure_click_css_font_css__WEBPACK_IMPORTED_MODULE_2__/* ["default"] */ .Z);
// Module
___CSS_LOADER_EXPORT___.push([module.id, "/* data- attribute improves the specificity of our CSS. We want it to apply to our overlay and only our overlay */\r\n/* All our CSS is to stop it being overridden by CSS in the site we are overlaying */\r\n:host {\r\n    --color-primary: 109, 208, 251;\r\n    --color-danger: 235, 94, 94;\r\n    --color-contrast: 22, 20, 29;\r\n\r\n    --color-lightbox-bg-unknown: rgba(var(--color-contrast), 0.5);\r\n    --color-lightbox-bg-blocked: rgba(190, 19, 19, 0.8);\r\n    --color-lightbox-bg-urlfiltering: rgba(190, 19, 19, 1.0);\r\n\r\n    --color-text-primary: 255, 255, 255;\r\n\r\n    --font-family: \"HP Simplified Light\", \"Helvetica\", Arial, sans-serif;\r\n    --font-family-url: Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace;\r\n    --font-base: 18px;\r\n}\r\n\r\n#br-fullpage-overlay {\r\n    all: initial;\r\n    position: fixed;\r\n    width: 100%;\r\n    height: 100%;\r\n    top: 0;\r\n    left: 0;\r\n    right: 0;\r\n    bottom: 0;\r\n    background-color: var(--color-lightbox-bg-unknown);\r\n    backdrop-filter: blur(2px);\r\n    z-index: 2147483647;\r\n    display: flex;\r\n    justify-content: center;\r\n    align-items: center;\r\n    font-size: var(--font-base);\r\n}\r\n\r\n/* Resetting all elements underneath */\r\n#br-fullpage-overlay * {\r\n    font-size: 1em;\r\n    font-family: var(--font-family);\r\n    margin: 0;\r\n    padding: 0;\r\n    display: block;\r\n    top: auto;\r\n    left: auto;\r\n    bottom: auto;\r\n    right: auto;\r\n    background: transparent;\r\n    border: none;\r\n    border-radius: 0;\r\n    box-shadow: none;\r\n    letter-spacing: normal;\r\n    line-height: 1.4em;\r\n}\r\n\r\n#br-fullpage-overlay.br-fullpage-overlay--Blocked {\r\n    background-color: var(--color-lightbox-bg-blocked);\r\n}\r\n\r\n#br-fullpage-overlay.br-fullpage-overlay--URLFiltering {\r\n    background-color: var(--color-lightbox-bg-urlfiltering);\r\n}\r\n\r\n#br-fullpage-overlay .br-fullpage-overlay-content {\r\n    flex-grow: 0;\r\n    font-size: 1em;\r\n    display: flex;\r\n    flex-wrap: wrap;\r\n    color: rgb(var(--color-text-primary));\r\n}\r\n\r\n#br-fullpage-overlay .br-fullpage-branding {\r\n    flex-grow: 0;\r\n    flex-shrink: 0;\r\n    background-color: rgba(22, 20, 29, 0.8);\r\n    align-content: flex-start;\r\n    align-items: center;\r\n    display: flex;\r\n    flex-wrap: wrap;\r\n    width: 100%;\r\n    height: 2.5em;\r\n    padding: 0.5em 1em;\r\n}\r\n\r\n#br-fullpage-overlay .logo-hp {\r\n    height: 100%;\r\n}\r\n\r\n#br-fullpage-overlay .logo-wolf {\r\n    position: relative;\r\n    top: 1px;\r\n    height: 90%;\r\n}\r\n\r\n#br-fullpage-overlay .logo-hp-ai {\r\n    position: relative;\r\n    top: 1px;\r\n    height: 90%;\r\n}\r\n\r\n#br-fullpage-overlay .br-fullpage-branding svg {\r\n    width: auto;\r\n    height: 100%;\r\n    margin: 0 1em 0 0;\r\n}\r\n\r\n#br-fullpage-overlay .br-fullpage-warning-box {\r\n    background-color: rgba(22, 20, 29);\r\n    padding: 1em;\r\n    height: auto;\r\n    flex-grow: 1;\r\n}\r\n\r\n#br-fullpage-overlay .br-warning-title {\r\n    font-size: 32px;\r\n    font-weight: 400;\r\n    margin-bottom: 1em;\r\n    display: inline-flex;\r\n    align-items: flex-start;\r\n}\r\n\r\n#br-fullpage-overlay .br-warning-title .logo-cp {\r\n    height: 1em;\r\n    width: auto;\r\n    fill: currentColor;\r\n    margin-right: 12px;\r\n    position: relative;\r\n    top: 8px;\r\n}\r\n\r\n#br-fullpage-overlay .br-warning-title .logo-cp svg {\r\n    width: auto;\r\n    height: 100%;\r\n}\r\n\r\n#br-fullpage-overlay .br-warning-description p {\r\n    margin-bottom: 1em;\r\n}\r\n\r\n#br-fullpage-overlay .br-warning-infobox {\r\n    background-color: rgb(var(--color-danger));\r\n    color: rgb(var(--color-contrast));\r\n    padding: 1em;\r\n    margin-bottom: 2em;\r\n}\r\n\r\n#br-fullpage-overlay .br-warning-actions {\r\n    margin-top: 2em;\r\n}\r\n\r\n#br-fullpage-overlay .button {\r\n    appearance: none;\r\n    margin: 0 1em 1em 0;\r\n    overflow: visible;\r\n    text-decoration: none;\r\n    text-transform: none;\r\n    user-select: none;\r\n    vertical-align: middle;\r\n    -webkit-tap-highlight-color: transparent;\r\n    white-space: nowrap;\r\n    outline: 0px;\r\n    box-shadow: none;\r\n    -webkit-box-align: center;\r\n    align-items: center;\r\n    background-color: transparent;\r\n    border-radius: 0;\r\n    border-style: solid;\r\n    border-width: 1px;\r\n    box-sizing: border-box;\r\n    cursor: pointer;\r\n    display: inline-flex;\r\n    font-size: 1em;\r\n    font-weight: 400;\r\n    -webkit-box-pack: center;\r\n    justify-content: center;\r\n    line-height: 20px;\r\n    min-width: 112px;\r\n    padding: 11px 23px 11px 15px;\r\n    position: relative;\r\n    transition: background-color 0.3s ease 0s, border-color 0.3s ease 0s, color 0.3s ease 0s;\r\n}\r\n\r\n#br-fullpage-overlay .button.button--with-icon {\r\n    padding: 7px 23px 8px 8px;\r\n}\r\n\r\n#br-fullpage-overlay .button svg {\r\n    fill: currentColor;\r\n    width: auto;\r\n    height: 1.5em;\r\n    margin-right: 6px;\r\n}\r\n\r\n#br-fullpage-overlay .button--safe {\r\n    border-color: rgba(var(--color-primary), 1);\r\n    color: rgba(var(--color-primary), 1);\r\n}\r\n\r\n#br-fullpage-overlay .button--safe:hover,\r\n#br-fullpage-overlay .button--safe:focus,\r\n#br-fullpage-overlay .button--safe:active {\r\n    background-color: rgba(var(--color-primary), 0.1);\r\n    border-color: rgba(var(--color-primary), 0.8);\r\n}\r\n\r\n#br-fullpage-overlay .button--neutral {\r\n    color: rgb(var(--color-text-primary));\r\n    border-color: rgba(var(--color-text-primary), 0.9);\r\n}\r\n\r\n#br-fullpage-overlay .button--neutral:hover,\r\n#br-fullpage-overlay .button--neutral:focus,\r\n#br-fullpage-overlay .button--neutral:active {\r\n    background-color: rgba(var(--color-text-primary), 0.1);\r\n    border-color: rgba(var(--color-text-primary), 1);\r\n}\r\n\r\n#br-fullpage-overlay .button--ghost {\r\n    color: rgb(255, 255, 255);\r\n    border-color: transparent;\r\n}\r\n\r\n#br-fullpage-overlay .button--ghost:hover,\r\n#br-fullpage-overlay .button--ghost:focus,\r\n#br-fullpage-overlay .button--ghost:active {\r\n    border-color: transparent;\r\n    background-color: rgba(var(--color-primary), 0.1);\r\n}\r\n\r\n\r\n@media (min-width: 460px) {\r\n    #br-fullpage-overlay .br-fullpage-warning-box {\r\n        padding: 2em;\r\n    }\r\n\r\n    #br-fullpage-overlay .br-fullpage-overlay-content {\r\n        flex-wrap: nowrap;\r\n    }\r\n\r\n    #br-fullpage-overlay .br-fullpage-branding {\r\n        padding: 2.2em 1em;\r\n        width: 4.5em;\r\n        height: auto;\r\n        justify-content: center;\r\n    }\r\n\r\n    #br-fullpage-overlay .logo-hp,\r\n    #br-fullpage-overlay .logo-wolf,\r\n    #br-fullpage-overlay .logo-hp-ai {\r\n        height: auto;\r\n        width: 100%;\r\n    }\r\n\r\n    #br-fullpage-overlay .logo-hp svg,\r\n    #br-fullpage-overlay .logo-wolf svg,\r\n    #br-fullpage-overlay .logo-hp-ai svg {\r\n        width: 100%;\r\n        height: auto;\r\n        margin: 0 0 1em 0;\r\n    }\r\n}\r\n\r\n@media (min-width: 660px) {\r\n    #br-fullpage-overlay .br-fullpage-overlay-content {\r\n        width: 90%;\r\n        max-width: 800px;\r\n    }\r\n    #br-fullpage-overlay .br-fullpage-branding {\r\n        padding: 1.4em;\r\n        width: 5.5em;\r\n    }\r\n}\r\n", ""]);
// Exports
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);


/***/ }),

/***/ 476:
/***/ ((module) => {



/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Tobias Koppers @sokra
*/
module.exports = function (cssWithMappingToString) {
  var list = []; // return the list of modules as css string

  list.toString = function toString() {
    return this.map(function (item) {
      var content = "";
      var needLayer = typeof item[5] !== "undefined";

      if (item[4]) {
        content += "@supports (".concat(item[4], ") {");
      }

      if (item[2]) {
        content += "@media ".concat(item[2], " {");
      }

      if (needLayer) {
        content += "@layer".concat(item[5].length > 0 ? " ".concat(item[5]) : "", " {");
      }

      content += cssWithMappingToString(item);

      if (needLayer) {
        content += "}";
      }

      if (item[2]) {
        content += "}";
      }

      if (item[4]) {
        content += "}";
      }

      return content;
    }).join("");
  }; // import a list of modules into the list


  list.i = function i(modules, media, dedupe, supports, layer) {
    if (typeof modules === "string") {
      modules = [[null, modules, undefined]];
    }

    var alreadyImportedModules = {};

    if (dedupe) {
      for (var k = 0; k < this.length; k++) {
        var id = this[k][0];

        if (id != null) {
          alreadyImportedModules[id] = true;
        }
      }
    }

    for (var _k = 0; _k < modules.length; _k++) {
      var item = [].concat(modules[_k]);

      if (dedupe && alreadyImportedModules[item[0]]) {
        continue;
      }

      if (typeof layer !== "undefined") {
        if (typeof item[5] === "undefined") {
          item[5] = layer;
        } else {
          item[1] = "@layer".concat(item[5].length > 0 ? " ".concat(item[5]) : "", " {").concat(item[1], "}");
          item[5] = layer;
        }
      }

      if (media) {
        if (!item[2]) {
          item[2] = media;
        } else {
          item[1] = "@media ".concat(item[2], " {").concat(item[1], "}");
          item[2] = media;
        }
      }

      if (supports) {
        if (!item[4]) {
          item[4] = "".concat(supports);
        } else {
          item[1] = "@supports (".concat(item[4], ") {").concat(item[1], "}");
          item[4] = supports;
        }
      }

      list.push(item);
    }
  };

  return list;
};

/***/ }),

/***/ 933:
/***/ ((module) => {



module.exports = function (i) {
  return i[1];
};

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			id: moduleId,
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {

;// CONCATENATED MODULE: ../lib/common/maybe.ts
function maybe_some(value) {
    return value !== undefined;
}
function maybe_none(value) {
    return value === undefined;
}
function serializeMaybe(value) {
    if (maybe_some(value)) {
        return value;
    }
    else {
        return null;
    }
}
function deserializeMaybe(value) {
    if (value === null) {
        return undefined;
    }
    else {
        return value;
    }
}
function maybe_isEqual(a, b) {
    return a === b;
}
var MaybeCompareOptions;
(function (MaybeCompareOptions) {
    MaybeCompareOptions[MaybeCompareOptions["none"] = 0] = "none";
    MaybeCompareOptions[MaybeCompareOptions["compareUndefined"] = 1] = "compareUndefined";
})(MaybeCompareOptions || (MaybeCompareOptions = {}));
function maybeCompare(a, b, compare = maybe_isEqual, options = MaybeCompareOptions.none) {
    if (maybe_some(a) && maybe_some(b)) {
        return compare(a, b);
    }
    if (options & MaybeCompareOptions.compareUndefined) {
        return maybe_none(a) && maybe_none(b);
    }
    return false;
}

;// CONCATENATED MODULE: ../lib/common/murmur-hash.ts
function murmurHashString(key, seed) {
    let len = key.length * 2;
    const m = 0xc6a4a793;
    const r = 16;
    let h = seed ^ (len * m);
    for (let i = 0; (i < key.length) && (len >= 4); i += 2) {
        const data = (key.charCodeAt(i) + (key.charCodeAt(i + 1) << 16));
        const k = data;
        h += k;
        h *= m;
        h ^= (h >> 16);
        len -= 4;
    }
    if (len === 2) {
        let data = key.charCodeAt(key.length - 1);
        h += data;
        h *= m;
        h ^= (h >> r);
    }
    h *= m;
    h ^= (h >> 10);
    h *= m;
    h ^= (h >> 17);
    return h;
}
function murmurHashNumber(key, seed) {
    let len = 4;
    const m = 0xc6a4a793;
    const r = 16;
    let h = seed ^ (len * m);
    const data = key & 0xffffffff;
    const k = data;
    h += k;
    h *= m;
    h ^= (h >> 16);
    h *= m;
    h ^= (h >> 10);
    h *= m;
    h ^= (h >> 17);
    return h;
}
function murmur_hash_murmurHash(key, seed) {
    if (typeof key === 'string') {
        return murmurHashString(key, seed);
    }
    else if (typeof key === 'boolean') {
        return murmurHashNumber(key ? 1 : 0, seed);
    }
    else {
        return murmurHashNumber(key, seed);
    }
}

;// CONCATENATED MODULE: ../lib/common/hash-map.ts
function isPowerOf2(value) {
    const mask = value - 1;
    return (value & mask) === 0;
}
function mod(n, d) {
    return n & (d - 1);
}
var TryPutStatus;
(function (TryPutStatus) {
    TryPutStatus[TryPutStatus["ValueInserted"] = 0] = "ValueInserted";
    TryPutStatus[TryPutStatus["ValueUpdated"] = 1] = "ValueUpdated";
    TryPutStatus[TryPutStatus["Failure"] = 2] = "Failure";
})(TryPutStatus || (TryPutStatus = {}));
function convertToArray(elements, selector) {
    const filteredElements = elements.filter((element) => {
        return element !== undefined && element !== null;
    });
    const mappedElements = filteredElements.map(selector);
    return mappedElements;
}
class hash_map_HashMap {
    constructor(hash, compare, initialCapacity = 0, fillFactor = 0.75) {
        this.hash = hash;
        this.compare = compare;
        this.fillFactor = fillFactor;
        this.size = 0;
        this.elements = [];
        if (initialCapacity !== 0) {
            this.resize(initialCapacity);
        }
    }
    shouldResize(size) {
        if (this.elements.length === 0) {
            return true;
        }
        return (size / this.elements.length) >= this.fillFactor;
    }
    findNextCapacity() {
        if (this.elements.length === 0) {
            return 2;
        }
        return this.elements.length * 2;
    }
    findIndex(hash, elements = this.elements) {
        const index = mod(hash, elements.length);
        if (index < 0) {
            throw new Error(`HashMap.findIndex: index < 0: ${index} < 0`);
        }
        if (index >= elements.length) {
            throw new Error(`HashMap.findIndex: index >= elements.length: ${index} >= ${elements.length}`);
        }
        return index;
    }
    compareKeys(ha, ka, hb, kb) {
        return (ha === hb) && this.compare(ka, kb);
    }
    tryPut(hash, key, value, start, end, elements = this.elements) {
        for (let i = start; i < end; i += 1) {
            const element = elements[i];
            if (element !== undefined && element !== null) {
                const [currentHash, currentKey, currentValue] = element;
                if (this.compareKeys(hash, key, currentHash, currentKey)) {
                    elements[i] = [hash, key, value];
                    return TryPutStatus.ValueUpdated;
                }
            }
            else {
                elements[i] = [hash, key, value];
                return TryPutStatus.ValueInserted;
            }
        }
        return TryPutStatus.Failure;
    }
    resize(capacity) {
        if (capacity <= this.elements.length) {
            throw new Error(`HashMap.resize: capacity <= this.elements.length: ${capacity} <= ${this.elements.length}`);
        }
        if (capacity <= this.size) {
            throw new Error(`HashMap.resize: capacity <= this.size: ${capacity} <= ${this.size}`);
        }
        if (!isPowerOf2(capacity)) {
            throw new Error(`HashMap.resize: !isPowerOf2(${capacity})`);
        }
        const elements = new Array(capacity);
        for (let element of this.elements) {
            if (element !== undefined && element !== null) {
                const [hash, key, value] = element;
                const index = this.findIndex(hash, elements);
                if (this.tryPut(hash, key, value, index, elements.length, elements) !== TryPutStatus.Failure) {
                    continue;
                }
                if (this.tryPut(hash, key, value, 0, index, elements) !== TryPutStatus.Failure) {
                    continue;
                }
                throw new Error(`HashMap.resize: !tryPut`);
            }
        }
        this.elements = elements;
    }
    has(key) {
        return this.get(key) !== undefined;
    }
    isHole(element) {
        return element === undefined;
    }
    tryGet(hash, key, start, end) {
        const foundHole = true;
        for (let i = start; i < end; i += 1) {
            const element = this.elements[i];
            if (element !== undefined && element !== null) {
                const [currentHash, currentKey, currentValue] = element;
                if (this.compareKeys(hash, key, currentHash, currentKey)) {
                    return [!foundHole, currentValue];
                }
            }
            else if (this.isHole(element)) {
                return [foundHole, undefined];
            }
        }
        return [!foundHole, undefined];
    }
    get(key) {
        if (this.size === 0) {
            return undefined;
        }
        const hash = this.hash(key);
        const index = this.findIndex(hash);
        let [foundHole, value] = this.tryGet(hash, key, index, this.elements.length);
        if (value) {
            return value;
        }
        if (foundHole) {
            return undefined;
        }
        [foundHole, value] = this.tryGet(hash, key, 0, index);
        return value;
    }
    put(key, value) {
        if (this.shouldResize(this.size + 1)) {
            this.resize(this.findNextCapacity());
        }
        const hash = this.hash(key);
        const index = this.findIndex(hash);
        switch (this.tryPut(hash, key, value, index, this.elements.length)) {
            case TryPutStatus.ValueInserted:
                this.size += 1;
                return;
            case TryPutStatus.ValueUpdated:
                return;
        }
        switch (this.tryPut(hash, key, value, 0, index)) {
            case TryPutStatus.ValueInserted:
                this.size += 1;
                return;
            case TryPutStatus.ValueUpdated:
                return;
        }
        throw new Error('HashMap.put: !tryPut');
    }
    putMany(keyValues) {
        for (const [key, value] of keyValues) {
            this.put(key, value);
        }
    }
    tryRemove(hash, key, start, end) {
        const foundHole = true;
        const removed = true;
        for (let i = start; i < end; i += 1) {
            const element = this.elements[i];
            if (element !== undefined && element !== null) {
                const [currentHash, currentKey, currentValue] = element;
                if (this.compareKeys(hash, key, currentHash, currentKey)) {
                    this.elements[i] = null;
                    return [!foundHole, removed];
                }
            }
            else if (this.isHole(element)) {
                return [foundHole, !removed];
            }
        }
        return [!foundHole, !removed];
    }
    remove(key) {
        if (this.isEmpty()) {
            return false;
        }
        const hash = this.hash(key);
        const index = this.findIndex(hash);
        let [foundHole, removed] = this.tryRemove(hash, key, index, this.elements.length);
        if (removed) {
            this.size -= 1;
            return true;
        }
        if (foundHole) {
            return false;
        }
        [foundHole, removed] = this.tryRemove(hash, key, 0, index);
        if (removed) {
            this.size -= 1;
        }
        return removed;
    }
    isEmpty() {
        return this.size === 0;
    }
    toArray() {
        const selectKeyValue = ([hash, key, value]) => {
            return [key, value];
        };
        return convertToArray(this.elements, selectKeyValue);
    }
    *[Symbol.iterator]() {
        for (const element of this.elements) {
            if (element !== undefined && element !== null) {
                const [hash, key, value] = element;
                yield [key, value];
            }
        }
    }
}
class hash_map_HashSet {
    constructor(hash, compare, initialCapacity = 0, fillFactor = 0.75) {
        this.map = new hash_map_HashMap(hash, compare, initialCapacity, fillFactor);
    }
    get size() {
        return this.map.size;
    }
    addMany(keys) {
        let nKeysAdded = 0;
        for (const key of keys) {
            if (this.add(key)) {
                nKeysAdded += 1;
            }
        }
        return nKeysAdded;
    }
    add(key) {
        const sizeBefore = this.map.size;
        this.map.put(key, key);
        const sizeAfter = this.map.size;
        return (sizeAfter - sizeBefore) === 1;
    }
    has(key) {
        return this.map.has(key);
    }
    remove(key) {
        return this.map.remove(key);
    }
    isEmpty() {
        return this.map.isEmpty();
    }
    toArray() {
        const selectKey = ([hash, key, value]) => {
            return key;
        };
        return convertToArray(this.map.elements, selectKey);
    }
    *[Symbol.iterator]() {
        for (const element of this.map.elements) {
            if (element !== undefined && element !== null) {
                const [hash, key, value] = element;
                yield key;
            }
        }
    }
}
function defaultHash(instance) {
    return instance.hash();
}
function defaultCompare(a, b) {
    return a.compare(b);
}
function makeDefaultHashMap() {
    return new hash_map_HashMap(defaultHash, defaultCompare);
}
function makeDefaultHashSet() {
    return new hash_map_HashSet(defaultHash, defaultCompare);
}

;// CONCATENATED MODULE: ../lib/common/string-utils.ts



var StringCompareOptions;
(function (StringCompareOptions) {
    StringCompareOptions[StringCompareOptions["CaseSensitive"] = 0] = "CaseSensitive";
    StringCompareOptions[StringCompareOptions["LowerCase"] = 1] = "LowerCase";
    StringCompareOptions[StringCompareOptions["LocaleLowerCase"] = 2] = "LocaleLowerCase";
})(StringCompareOptions || (StringCompareOptions = {}));
function string_utils_compareStrings(a, b, options = StringCompareOptions.CaseSensitive) {
    switch (options) {
        case StringCompareOptions.CaseSensitive:
            return a === b;
        case StringCompareOptions.LowerCase:
            return a.toLowerCase() === b.toLowerCase();
        case StringCompareOptions.LocaleLowerCase:
            return a.toLocaleLowerCase() === b.toLocaleLowerCase();
        default:
            throw new Error('stringCompare');
    }
}
function hashString(value) {
    let hash = 0;
    hash = murmur_hash_murmurHash(value, hash);
    return hash;
}
function makeStringHashSet() {
    return new HashSet(hashString, string_utils_compareStrings);
}
function makeStringHashMap() {
    return new hash_map_HashMap(hashString, string_utils_compareStrings);
}
function line(value) {
    return `${value}\n`;
}
function surround(value, typeName, openTag, closeTag, indentLevel) {
    const indent = makeIndent(indentLevel - 1);
    if (value) {
        return `${line(`${typeName}${openTag}`)}${value}${indent(closeTag)}`;
    }
    else {
        return `${typeName}${openTag}${closeTag}`;
    }
}
function makeKeyValuePrinter(toString, indent) {
    return (key, value) => {
        return line(indent(`${toString(key)}: ${toString(value)},`));
    };
}
function mapToString(map, seenObjects, indentLevel) {
    const indent = makeIndent(indentLevel);
    function toString(value) {
        return toStringRecursive(value, seenObjects, indentLevel);
    }
    const printKeyValue = makeKeyValuePrinter(toString, indent);
    let result = "";
    map.forEach((value, key) => {
        result += printKeyValue(key, value);
    });
    return surround(result, "Map", "{", "}", indentLevel);
}
function makeValuePrinter(toString, indent) {
    return (value) => {
        return line(indent(`${toString(value)},`));
    };
}
function setToString(set, seenObjects, indentLevel) {
    const indent = makeIndent(indentLevel);
    function toString(value) {
        return toStringRecursive(value, seenObjects, indentLevel);
    }
    const printValue = makeValuePrinter(toString, indent);
    let result = "";
    set.forEach((key) => {
        result += printValue(key);
    });
    return surround(result, "Set", "{", "}", indentLevel);
}
function arrayToString(array, seenObjects, indentLevel) {
    const indent = makeIndent(indentLevel);
    function toString(value) {
        return toStringRecursive(value, seenObjects, indentLevel);
    }
    const printValue = makeValuePrinter(toString, indent);
    let result = "";
    if (array.length > 250) {
        result = printValue("...");
    }
    else {
        array.forEach((value) => {
            result += printValue(value);
        });
    }
    return surround(result, "Array", "[", "]", indentLevel);
}
function objectToString(value, seenObjects, indentLevel) {
    const indent = makeIndent(indentLevel);
    function toString(value) {
        return toStringRecursive(value, seenObjects, indentLevel);
    }
    const printKeyValue = makeKeyValuePrinter(toString, indent);
    let result = "";
    for (const propertyName of Object.getOwnPropertyNames(value)) {
        const property = value[propertyName];
        if (!isFunction(property)) {
            result += printKeyValue(propertyName, property);
        }
    }
    return surround(result, typeName(value), "{", "}", indentLevel);
}
const defaultToStringFunction = (() => {
    const emptyObject = {};
    return emptyObject.toString;
})();
function defaultToString(value) {
    return defaultToStringFunction.call(value);
}
function hasCustomToString(value) {
    return value.toString !== defaultToStringFunction;
}
function isFunction(value) {
    return value instanceof Function;
}
function makeIndentation(indentLevel) {
    if (indentLevel <= 0) {
        return "";
    }
    const tab = "\t";
    let indentation = "";
    for (let level = 0; level < indentLevel; level += 1) {
        indentation += tab;
    }
    return indentation;
}
function makeIndent(indentLevel) {
    const indentation = makeIndentation(indentLevel);
    return (value) => {
        return `${indentation}${value}`;
    };
}
function typeOf(value) {
    return value.constructor;
}
function typeName(value) {
    return typeOf(value).name;
}
function toStringRecursive(value, seenObjects, indentLevel) {
    function didSee(value) {
        return seenObjects.has(value);
    }
    function seeObject(value) {
        seenObjects.add(value);
        return seenObjects;
    }
    const nextIndentLevel = indentLevel + 1;
    if (value === undefined) {
        return "undefined";
    }
    else if (value === null) {
        return "null";
    }
    else if (typeof value === "boolean") {
        return value.toString();
    }
    else if (typeof value === "number") {
        return value.toString();
    }
    else if (typeof value === "string") {
        return value;
    }
    else if (value instanceof Array) {
        return arrayToString(value, seeObject(value), nextIndentLevel);
    }
    else if (value instanceof Map) {
        return mapToString(value, seeObject(value), nextIndentLevel);
    }
    else if (value instanceof Set) {
        return setToString(value, seeObject(value), nextIndentLevel);
    }
    else if (value instanceof URL) {
        return url_utils_URLToString(value);
    }
    else if (isFunction(value)) {
        return typeName(value);
    }
    else if (didSee(value)) {
        return typeName(value);
    }
    else if (hasCustomToString(value)) {
        return value.toString();
    }
    else {
        return objectToString(value, seeObject(value), nextIndentLevel);
    }
}
function string_utils_toString(value, initialIndentLevel = 0) {
    const seenObjects = new Set();
    const indentLevel = initialIndentLevel;
    return toStringRecursive(value, seenObjects, indentLevel);
}
function safeToString(value) {
    if (value === undefined) {
        return "undefined";
    }
    else if (value === null) {
        return "null";
    }
    else {
        return value.toString();
    }
}
function isString(value) {
    return typeof value === 'string';
}
function isEmptyString(value) {
    return value.length === 0;
}
function toJSONString(value) {
    return JSON.stringify(value, undefined, 4);
}

;// CONCATENATED MODULE: ../lib/common/scheme.ts
var scheme_Scheme;
(function (Scheme) {
    Scheme["HTTP"] = "http:";
    Scheme["HTTPS"] = "https:";
    Scheme["FTP"] = "ftp:";
    Scheme["FTPS"] = "ftps:";
    Scheme["WS"] = "ws:";
    Scheme["WSS"] = "wss:";
    Scheme["FILE"] = "file:";
    Scheme["CHROME"] = "chrome:";
    Scheme["EDGE"] = "edge:";
    Scheme["ABOUT"] = "about:";
    Scheme["JAVASCRIPT"] = "javascript:";
    Scheme["CHROME_EXTENSION"] = "chrome-extension:";
    Scheme["FIREFOX_EXTENSION"] = "moz-extension:";
    Scheme["WILDCARD_ONE"] = "+:";
    Scheme["WILDCARD_SOME"] = "*:";
})(scheme_Scheme || (scheme_Scheme = {}));

;// CONCATENATED MODULE: ../lib/common/url-utils.ts




var UrlCompareOptions;
(function (UrlCompareOptions) {
    UrlCompareOptions[UrlCompareOptions["Default"] = 0] = "Default";
    UrlCompareOptions[UrlCompareOptions["IgnoreSearchParams"] = 1] = "IgnoreSearchParams";
})(UrlCompareOptions || (UrlCompareOptions = {}));
var UrlComponent;
(function (UrlComponent) {
    UrlComponent[UrlComponent["Protocol"] = 1] = "Protocol";
    UrlComponent[UrlComponent["Username"] = 2] = "Username";
    UrlComponent[UrlComponent["Password"] = 4] = "Password";
    UrlComponent[UrlComponent["Host"] = 8] = "Host";
    UrlComponent[UrlComponent["Port"] = 16] = "Port";
    UrlComponent[UrlComponent["Pathname"] = 32] = "Pathname";
    UrlComponent[UrlComponent["Search"] = 64] = "Search";
    UrlComponent[UrlComponent["All"] = 127] = "All";
})(UrlComponent || (UrlComponent = {}));
function compareUrlComponents(a, b, components) {
    function compare(component) {
        return (components & component) !== 0;
    }
    if (compare(UrlComponent.Protocol) && a.protocol !== b.protocol) {
        return false;
    }
    if (compare(UrlComponent.Username) && a.username !== b.username) {
        return false;
    }
    if (compare(UrlComponent.Password) && a.password !== b.password) {
        return false;
    }
    if (compare(UrlComponent.Host) && a.host !== b.host) {
        return false;
    }
    if (compare(UrlComponent.Port) && a.port !== b.port) {
        return false;
    }
    if (compare(UrlComponent.Pathname) && a.pathname !== b.pathname) {
        return false;
    }
    if (compare(UrlComponent.Search) && a.search !== b.search) {
        return false;
    }
    return true;
}
function removeComponent(components, component) {
    return components & (~component);
}
function isSameUrl(a, b, options = UrlCompareOptions.Default) {
    switch (options) {
        case UrlCompareOptions.Default:
            return compareUrlComponents(a, b, UrlComponent.All);
        case UrlCompareOptions.IgnoreSearchParams:
            return compareUrlComponents(a, b, removeComponent(UrlComponent.All, UrlComponent.Search));
        default:
            throw new Error(`isSameUrl: invalid options: ${options}`);
    }
}
function url_utils_isURL(value) {
    return value instanceof URL;
}
function url_utils_parseUrl(spec) {
    try {
        return new URL(spec);
    }
    catch (e) {
        return undefined;
    }
}
function maybeParseUrl(spec) {
    const url = url_utils_parseUrl(spec);
    if (url === undefined) {
        return spec;
    }
    else {
        return url;
    }
}
function parseURLIfNecessary(urlOrSpec) {
    if (url_utils_isURL(urlOrSpec)) {
        return urlOrSpec;
    }
    else {
        return url_utils_parseUrl(urlOrSpec);
    }
}
function isSameUrlOrSpec(a, b, options = UrlCompareOptions.Default) {
    if ((a instanceof URL) && (b instanceof URL)) {
        return isSameUrl(a, b);
    }
    else if ((typeof a === "string") && (typeof b === "string")) {
        return a === b;
    }
    else {
        return undefined;
    }
}
function url_utils_isFileUrl(url) {
    return compareStrings(url.protocol, Scheme.FILE);
}
function isExtensionUrl(url) {
    const extensionSchemes = [
        Scheme.CHROME_EXTENSION,
        Scheme.FIREFOX_EXTENSION
    ];
    return extensionSchemes.some((extensionScheme) => compareStrings(url.protocol, extensionScheme));
}
function isBrowserUrl(url) {
    const browserSchemes = [
        Scheme.CHROME,
        Scheme.ABOUT,
        Scheme.EDGE
    ];
    return browserSchemes.some((browserScheme) => compareStrings(url.protocol, browserScheme));
}
function url_utils_URLToString(url) {
    if (url === undefined) {
        return "";
    }
    if (url instanceof URL) {
        return url.toString();
    }
    else {
        return url;
    }
}
function safeEncodeURI(uri) {
    if (uri === undefined) {
        return "";
    }
    return encodeURI(uri);
}
function safeEncodeURIComponent(component) {
    if (component === undefined) {
        return "";
    }
    return encodeURIComponent(component);
}
function hashUrlComponents(url, components, seed) {
    function compare(component) {
        return (components & component) !== 0;
    }
    let hash = seed;
    if (compare(UrlComponent.Protocol)) {
        hash = murmurHash(url.protocol, hash);
    }
    if (compare(UrlComponent.Username)) {
        hash = murmurHash(url.username, hash);
    }
    if (compare(UrlComponent.Password)) {
        hash = murmurHash(url.password, hash);
    }
    if (compare(UrlComponent.Host)) {
        hash = murmurHash(url.host, hash);
    }
    if (compare(UrlComponent.Port)) {
        hash = murmurHash(url.port, hash);
    }
    if (compare(UrlComponent.Pathname)) {
        hash = murmurHash(url.pathname, hash);
    }
    if (compare(UrlComponent.Search)) {
        hash = murmurHash(url.search, hash);
    }
    return hash;
}
function hashUrl(url, options = UrlCompareOptions.Default, seed = 0) {
    switch (options) {
        case UrlCompareOptions.Default:
            return hashUrlComponents(url, UrlComponent.All, seed);
        case UrlCompareOptions.IgnoreSearchParams:
            return hashUrlComponents(url, removeComponent(UrlComponent.All, UrlComponent.Search), seed);
        default:
            throw new Error(`hashUrl: invalid options: ${options}`);
    }
}
function makeUrlHashMap(options = UrlCompareOptions.Default) {
    return new HashMap((url) => hashUrl(url, options), (a, b) => isSameUrl(a, b, options));
}
function makeUrlHashSet(options = UrlCompareOptions.Default) {
    return new HashSet((url) => hashUrl(url, options), (a, b) => isSameUrl(a, b, options));
}

;// CONCATENATED MODULE: ../lib/common/browser.ts



var browser_Browser;
(function (Browser) {
    Browser[Browser["chrome"] = 0] = "chrome";
    Browser[Browser["firefox"] = 1] = "firefox";
    Browser[Browser["edgeChromium"] = 2] = "edgeChromium";
})(browser_Browser || (browser_Browser = {}));
const browserSchemeMap = new Map([
    [scheme_Scheme.CHROME_EXTENSION, browser_Browser.chrome],
    [scheme_Scheme.FIREFOX_EXTENSION, browser_Browser.firefox],
]);
const currentBrowser = (() => {
    var _a;
    const manifestURL = url_utils_parseUrl(chrome.runtime.getURL("manifest.json"));
    if (maybe_none(manifestURL)) {
        return undefined;
    }
    let browser = browserSchemeMap.get(manifestURL.protocol);
    if (browser === browser_Browser.chrome) {
        if ((_a = navigator.userAgentData) === null || _a === void 0 ? void 0 : _a.brands.some(brandInfo => brandInfo.brand === "Microsoft Edge")) {
            browser = browser_Browser.edgeChromium;
        }
    }
    return browser;
})();
function getCurrentBrowserInfo() {
    const manifestURL = parseUrl(chrome.runtime.getURL("manifest.json"));
    if (none(manifestURL) || none(currentBrowser)) {
        return { browser: "unknown", urlHostname: "" };
    }
    return { browser: browser_Browser[currentBrowser], urlHostname: manifestURL.hostname };
}
function browserToDisplayString(browser) {
    switch (browser) {
        case browser_Browser.chrome:
            return "Google Chrome";
        case browser_Browser.firefox:
            return "Mozilla Firefox";
        case browser_Browser.edgeChromium:
            return "Microsoft Edge";
    }
}

;// CONCATENATED MODULE: ./scripts/content-script/page-suppressors.ts


class BasePageSuppressor {
    constructor(pageManager, config) {
        this.pageManager = pageManager;
        this.config = config;
    }
}
class PasswordFillerSuppressor extends BasePageSuppressor {
    constructor() {
        super(...arguments);
        this.currentIntervalId = 0;
        this.isFirefox = currentBrowser === browser_Browser.firefox;
        this.passwordMayBeInjected = false;
        this.trustedInputEventSeen = false;
        this.webkitAutofillSelector = this.pageManager.PASSWORD_QUERY_STRING.split(",").map(query => query + ":-webkit-autofill").join(",");
        this.onInputCB = (event) => this.onInput(event);
    }
    checkForSuppressionMarkers() {
        if (this.shouldRun()) {
            if (!this.isFirefox) {
                this.clearIntervals();
                if (this.checkChromiumAutofill()) {
                    return true;
                }
                this.setExponentialInterval(() => {
                    if (this.alreadySuppressed || this.pageManager.hasTripped) {
                        this.clearIntervals();
                    }
                    else {
                        this.checkChromiumAutofill();
                    }
                }, 50, 1.3);
            }
            if (!this.trustedInputEventSeen) {
                for (const passwordElement of this.pageManager.passwordElements) {
                    if (this.isPasswordPresent(passwordElement)) {
                        this.pageManager.suppressDetection("prefilled password");
                        return true;
                    }
                }
                this.addListeners();
            }
        }
        return false;
    }
    shouldRun() {
        return this.pageManager.passwordElements.length > 0
            && this.config.trustPagesWithAutofilledPasswords
            && !this.passwordMayBeInjected;
    }
    setExponentialInterval(callback, initial_interval, backoff_factor) {
        const id = this.currentIntervalId;
        this.setExponentialIntervalImpl(callback, initial_interval, backoff_factor, id);
    }
    setExponentialIntervalImpl(callback, interval, backoff_factor, id) {
        setTimeout(() => {
            if (id !== this.currentIntervalId) {
                return;
            }
            callback();
            const next_interval = interval * backoff_factor;
            this.setExponentialIntervalImpl(callback, next_interval, backoff_factor, id);
        }, interval);
    }
    clearIntervals() {
        this.currentIntervalId += 1;
    }
    checkChromiumAutofill() {
        if (document.querySelectorAll(this.webkitAutofillSelector).length > 0) {
            this.pageManager.suppressDetection("Chromium autofill");
            return true;
        }
        return false;
    }
    addListeners() {
        this.pageManager.passwordElements.forEach(pw => pw.addEventListener("input", this.onInputCB));
    }
    removeListeners() {
        this.pageManager.passwordElements.forEach(pw => pw.removeEventListener("input", this.onInputCB));
    }
    onInput(event) {
        this.removeListeners();
        if (this.alreadySuppressed) {
            return;
        }
        if (event.isTrusted) {
            this.trustedInputEventSeen = true;
            if (this.isFirefox && event.inputType === "insertReplacementText") {
                this.pageManager.suppressDetection("Firefox autofill");
            }
        }
        else {
            this.passwordMayBeInjected = true;
            this.pageManager.suppressDetection("password injection");
        }
    }
    isPasswordPresent(passwordElement) {
        let htmlValue = "";
        if (passwordElement.hasAttribute("value")) {
            htmlValue = passwordElement.getAttribute("value");
        }
        if (passwordElement.value.length > 0) {
            return passwordElement.value !== htmlValue;
        }
        return false;
    }
    get alreadySuppressed() {
        return this.pageManager.isSuppressed;
    }
}
class LinkAnalyserSuppressor extends BasePageSuppressor {
    checkForSuppressionMarkers() {
        if (this.shouldRun()) {
            const res = new LinkAnalyserSuppressor.Result();
            if (res.pageMightBeSafe()) {
                this.pageManager.suppressDetection("link analyser");
                return true;
            }
        }
        return false;
    }
    shouldRun() {
        return this.pageManager.interestingInputElements.length > 0 && this.config.useLinkAnalysisHeuristic;
    }
}
LinkAnalyserSuppressor.Result = class {
    constructor() {
        this.linkCount = 0;
        this.pageHost = "";
        this.nullLink = {
            total: 0,
            withOnClickHandler: 0
        };
        this.externalLink = {
            total: 0,
            countByDomain: new Map()
        };
        this.pageHost = this.buildBaseHostName(new URL(location.href));
        const allLinks = document.querySelectorAll("a");
        this.linkCount = allLinks.length;
        allLinks.forEach(link => {
            const linkUrl = this.checkforNullLink(link);
            if (linkUrl) {
                this.checkForExternalLink(linkUrl);
            }
        });
    }
    checkForExternalLink(url) {
        if (this.pageHost !== this.buildBaseHostName(url)) {
            ++this.externalLink.total;
            let count = this.externalLink.countByDomain.get(url.hostname);
            if (maybe_none(count)) {
                count = 1;
            }
            else {
                ++count;
            }
            this.externalLink.countByDomain.set(url.hostname, count);
        }
    }
    checkforNullLink(linkElement) {
        let url = null;
        try {
            url = new URL(linkElement.href);
        }
        catch (e) {
            ++this.nullLink.total;
            return null;
        }
        if ((url.protocol !== "http:" && url.protocol !== "https:")
            || (url.href.search("#") !== -1 && url.hash.length === 0)) {
            ++this.nullLink.total;
            if (linkElement.onclick) {
                ++this.nullLink.withOnClickHandler;
            }
            return null;
        }
        return url;
    }
    buildBaseHostName(url) {
        const originalTLDSuffix = new Set(["com", "org", "net", "int", "edu", "gov", "mil"]);
        const parts = url.hostname.split(".");
        switch (parts.length) {
            case 0:
            case 1:
                return null;
            case 2:
                return url.hostname;
            case 3:
                if (parts[0] === "www" || originalTLDSuffix.has(parts[2])) {
                    return parts.slice(1).join(".");
                }
                else {
                    return url.hostname;
                }
            default:
                return parts.slice(1).join(".");
        }
    }
    pageMightBeSafe() {
        if (this.linkCount < 4) {
            return false;
        }
        if (this.nullLink.total / this.linkCount > 0.4) {
            return false;
        }
        if (this.externalLink.total / this.linkCount > 0.6) {
            return false;
        }
        return true;
    }
};

;// CONCATENATED MODULE: ../lib/common/number-utils.ts
function number_utils_isInRange(value, min, max) {
    return (value >= min) && (value <= max);
}
function number_utils_isNumber(value) {
    return typeof value === "number";
}

;// CONCATENATED MODULE: ../lib/host/message-types.ts

var message_types_MessageType;
(function (MessageType) {
    MessageType[MessageType["handshakeV1"] = 0] = "handshakeV1";
    MessageType[MessageType["launchBrowserRequestV1"] = 1] = "launchBrowserRequestV1";
    MessageType[MessageType["launchBrowserResponseV1"] = 2] = "launchBrowserResponseV1";
    MessageType[MessageType["pageEventV1"] = 3] = "pageEventV1";
    MessageType[MessageType["configRequestV1"] = 4] = "configRequestV1";
    MessageType[MessageType["configChangedV1"] = 5] = "configChangedV1";
    MessageType[MessageType["trustUrlV1"] = 6] = "trustUrlV1";
    MessageType[MessageType["downloadCompleteV1"] = 7] = "downloadCompleteV1";
    MessageType[MessageType["logMessageV1"] = 8] = "logMessageV1";
    MessageType[MessageType["addUserTrustedOriginV1"] = 9] = "addUserTrustedOriginV1";
    MessageType[MessageType["addUserUntrustedOriginV1"] = 10] = "addUserUntrustedOriginV1";
    MessageType[MessageType["helperErrorV1"] = 11] = "helperErrorV1";
    MessageType[MessageType["dormantStateChangedV1"] = 12] = "dormantStateChangedV1";
    MessageType[MessageType["extensionReadyV1"] = 13] = "extensionReadyV1";
    MessageType[MessageType["externalAppLinkRequestV1"] = 14] = "externalAppLinkRequestV1";
    MessageType[MessageType["externalAppLinkResponseV1"] = 15] = "externalAppLinkResponseV1";
    MessageType[MessageType["isFileURLTrustedRequestV1"] = 16] = "isFileURLTrustedRequestV1";
    MessageType[MessageType["isFileURLTrustedResponseV1"] = 17] = "isFileURLTrustedResponseV1";
    MessageType[MessageType["blockedFileRequestV1"] = 18] = "blockedFileRequestV1";
    MessageType[MessageType["blockedFileResponseV1"] = 19] = "blockedFileResponseV1";
    MessageType[MessageType["popupDataRequestV1"] = 20] = "popupDataRequestV1";
    MessageType[MessageType["popupDataResponseV1"] = 21] = "popupDataResponseV1";
    MessageType[MessageType["clearRememberedDecisionsV1"] = 22] = "clearRememberedDecisionsV1";
    MessageType[MessageType["blockedPageStringsRequestV1"] = 23] = "blockedPageStringsRequestV1";
    MessageType[MessageType["blockedPageStringsResponseV1"] = 24] = "blockedPageStringsResponseV1";
    MessageType[MessageType["heartbeatV1"] = 25] = "heartbeatV1";
    MessageType[MessageType["enabledFeaturesRequestV2"] = 26] = "enabledFeaturesRequestV2";
    MessageType[MessageType["enabledFeaturesResponseV2"] = 27] = "enabledFeaturesResponseV2";
    MessageType[MessageType["clearRememberedOriginV3"] = 28] = "clearRememberedOriginV3";
    MessageType[MessageType["optionsDataRequestV3"] = 29] = "optionsDataRequestV3";
    MessageType[MessageType["optionsDataResponseV3"] = 30] = "optionsDataResponseV3";
    MessageType[MessageType["configChangedV3"] = 31] = "configChangedV3";
    MessageType[MessageType["reputationChangedV3"] = 32] = "reputationChangedV3";
    MessageType[MessageType["configChangedV4"] = 33] = "configChangedV4";
    MessageType[MessageType["blockedPageDataRequestV4"] = 34] = "blockedPageDataRequestV4";
    MessageType[MessageType["blockedPageDataResponseV4"] = 35] = "blockedPageDataResponseV4";
    MessageType[MessageType["configChangedV5"] = 36] = "configChangedV5";
    MessageType[MessageType["popupDataResponseV5"] = 37] = "popupDataResponseV5";
    MessageType[MessageType["blockedPageDataResponseV6"] = 38] = "blockedPageDataResponseV6";
    MessageType[MessageType["trustUrlV6"] = 39] = "trustUrlV6";
    MessageType[MessageType["configChangedV7"] = 40] = "configChangedV7";
    MessageType[MessageType["trustUrlV8"] = 41] = "trustUrlV8";
    MessageType[MessageType["dontAskAgainV8"] = 42] = "dontAskAgainV8";
    MessageType[MessageType["configChangedV8"] = 43] = "configChangedV8";
    MessageType[MessageType["popupDataResponseV9"] = 44] = "popupDataResponseV9";
    MessageType[MessageType["dontAskAgainV9"] = 45] = "dontAskAgainV9";
    MessageType[MessageType["configChangedV9"] = 46] = "configChangedV9";
    MessageType[MessageType["stopHelperV10"] = 47] = "stopHelperV10";
    MessageType[MessageType["edgeAckV10"] = 48] = "edgeAckV10";
    MessageType[MessageType["endOfStreamV10"] = 49] = "endOfStreamV10";
    MessageType[MessageType["heartbeatV10"] = 50] = "heartbeatV10";
    MessageType[MessageType["popupDataResponseV11"] = 51] = "popupDataResponseV11";
    MessageType[MessageType["configChangedV11"] = 52] = "configChangedV11";
    MessageType[MessageType["configChangedV12"] = 53] = "configChangedV12";
    MessageType[MessageType["configChangedV13"] = 54] = "configChangedV13";
    MessageType[MessageType["configChangedV14"] = 55] = "configChangedV14";
    MessageType[MessageType["configChangedV15"] = 56] = "configChangedV15";
    MessageType[MessageType["externalAppLinkRequestV16"] = 57] = "externalAppLinkRequestV16";
    MessageType[MessageType["configChangedV17"] = 58] = "configChangedV17";
    MessageType[MessageType["popupDataResponseV18"] = 59] = "popupDataResponseV18";
    MessageType[MessageType["popupDataResponseV19"] = 60] = "popupDataResponseV19";
    MessageType[MessageType["configChangedV19"] = 61] = "configChangedV19";
    MessageType[MessageType["configChangedV20"] = 62] = "configChangedV20";
    MessageType[MessageType["popupDataResponseV21"] = 63] = "popupDataResponseV21";
    MessageType[MessageType["configChangedV21"] = 64] = "configChangedV21";
    MessageType[MessageType["phishingDetectionTrippedV22"] = 65] = "phishingDetectionTrippedV22";
    MessageType[MessageType["phishingDetectionSuppressedV22"] = 66] = "phishingDetectionSuppressedV22";
    MessageType[MessageType["phishingInformationSubmittedV22"] = 67] = "phishingInformationSubmittedV22";
    MessageType[MessageType["frameLoadResponseV22"] = 68] = "frameLoadResponseV22";
    MessageType[MessageType["contentScriptDataV22"] = 69] = "contentScriptDataV22";
    MessageType[MessageType["onFrameDomUpdateV22"] = 70] = "onFrameDomUpdateV22";
    MessageType[MessageType["freezeScreenshotV22"] = 71] = "freezeScreenshotV22";
    MessageType[MessageType["onOverlayClickV22"] = 72] = "onOverlayClickV22";
    MessageType[MessageType["onPhishingCategoryChangedV22"] = 73] = "onPhishingCategoryChangedV22";
    MessageType[MessageType["phishingCategoryRequestV22"] = 74] = "phishingCategoryRequestV22";
    MessageType[MessageType["phishingCategoryResponseV22"] = 75] = "phishingCategoryResponseV22";
    MessageType[MessageType["phishingHostStatusChangeV22"] = 76] = "phishingHostStatusChangeV22";
    MessageType[MessageType["preparePhishingReportV22"] = 77] = "preparePhishingReportV22";
    MessageType[MessageType["addPhishingReportActionV22"] = 78] = "addPhishingReportActionV22";
    MessageType[MessageType["sendPhishingReportV22"] = 79] = "sendPhishingReportV22";
    MessageType[MessageType["helperRunningV22"] = 80] = "helperRunningV22";
    MessageType[MessageType["helperExitedV22"] = 81] = "helperExitedV22";
    MessageType[MessageType["optionsDataResponseV22"] = 82] = "optionsDataResponseV22";
    MessageType[MessageType["configChangedV22"] = 83] = "configChangedV22";
    MessageType[MessageType["configChangedV23"] = 84] = "configChangedV23";
    MessageType[MessageType["popupDataResponseV24"] = 85] = "popupDataResponseV24";
    MessageType[MessageType["identityProtectionRunningV24"] = 86] = "identityProtectionRunningV24";
    MessageType[MessageType["configChangedV24"] = 87] = "configChangedV24";
    MessageType[MessageType["popupDataResponseV25"] = 88] = "popupDataResponseV25";
    MessageType[MessageType["showUrlFilteringOverlayV26"] = 89] = "showUrlFilteringOverlayV26";
    MessageType[MessageType["makeUrlFilteringAlertV26"] = 90] = "makeUrlFilteringAlertV26";
    MessageType[MessageType["configChangedV26"] = 91] = "configChangedV26";
    MessageType[MessageType["makeUrlFilteringAlertV27"] = 92] = "makeUrlFilteringAlertV27";
    MessageType[MessageType["preparePhishingReportV28"] = 93] = "preparePhishingReportV28";
    MessageType[MessageType["configChangedV28"] = 94] = "configChangedV28";
    MessageType[MessageType["showDomainAgeUrlFilteringOverlayV28"] = 95] = "showDomainAgeUrlFilteringOverlayV28";
    MessageType[MessageType["makeUrlFilteringAlertV28"] = 96] = "makeUrlFilteringAlertV28";
    MessageType[MessageType["configChangedV29"] = 97] = "configChangedV29";
    MessageType[MessageType["showStatusMsgUrlFilteringOverlayV29"] = 98] = "showStatusMsgUrlFilteringOverlayV29";
    MessageType[MessageType["downloadCreatedV30"] = 99] = "downloadCreatedV30";
    MessageType[MessageType["analyseWebsiteScreenshotOpportunityEventV31"] = 100] = "analyseWebsiteScreenshotOpportunityEventV31";
    MessageType[MessageType["analyseWebsiteScreenshotRequestV31"] = 101] = "analyseWebsiteScreenshotRequestV31";
    MessageType[MessageType["analyseWebsiteScreenshotResponseV31"] = 102] = "analyseWebsiteScreenshotResponseV31";
    MessageType[MessageType["onLogoAnalysisCompleteV31"] = 103] = "onLogoAnalysisCompleteV31";
    MessageType[MessageType["preparePhishingReportV32"] = 104] = "preparePhishingReportV32";
    MessageType[MessageType["configChangedV33"] = 105] = "configChangedV33";
    MessageType[MessageType["minMessageType"] = 0] = "minMessageType";
    MessageType[MessageType["maxMessageType"] = 105] = "maxMessageType";
})(message_types_MessageType || (message_types_MessageType = {}));
function isMessageType(type) {
    return number_utils_isInRange(type, message_types_MessageType.minMessageType, message_types_MessageType.maxMessageType);
}
const frequentlySentMessageTypes = new Set([
    message_types_MessageType.logMessageV1,
    message_types_MessageType.pageEventV1,
    message_types_MessageType.heartbeatV1,
    message_types_MessageType.extensionReadyV1,
    message_types_MessageType.heartbeatV10,
    message_types_MessageType.phishingDetectionTrippedV22,
    message_types_MessageType.phishingDetectionSuppressedV22,
    message_types_MessageType.phishingInformationSubmittedV22,
    message_types_MessageType.frameLoadResponseV22,
    message_types_MessageType.contentScriptDataV22,
    message_types_MessageType.onFrameDomUpdateV22,
    message_types_MessageType.freezeScreenshotV22,
    message_types_MessageType.onOverlayClickV22,
    message_types_MessageType.onPhishingCategoryChangedV22,
    message_types_MessageType.blockedFileRequestV1,
    message_types_MessageType.blockedFileResponseV1,
    message_types_MessageType.externalAppLinkRequestV16,
    message_types_MessageType.externalAppLinkResponseV1,
    message_types_MessageType.showUrlFilteringOverlayV26,
    message_types_MessageType.showDomainAgeUrlFilteringOverlayV28,
    message_types_MessageType.showStatusMsgUrlFilteringOverlayV29,
    message_types_MessageType.analyseWebsiteScreenshotOpportunityEventV31,
    message_types_MessageType.analyseWebsiteScreenshotRequestV31,
    message_types_MessageType.analyseWebsiteScreenshotResponseV31,
    message_types_MessageType.onLogoAnalysisCompleteV31,
    message_types_MessageType.preparePhishingReportV22,
    message_types_MessageType.preparePhishingReportV28,
    message_types_MessageType.preparePhishingReportV32,
]);
function message_types_isFrequentlySentMessageType(type) {
    return frequentlySentMessageTypes.has(type);
}

;// CONCATENATED MODULE: ../lib/common/array-utils.ts

function isEmpty(array) {
    return array.length === 0;
}
function first(array) {
    return array[0];
}
function second(array) {
    return array[1];
}
function last(array) {
    return array[array.length - 1];
}
function rest(array) {
    return array.slice(1);
}
function copyArray(array) {
    const identity = (value) => {
        return value;
    };
    return array.map(identity);
}
function array_utils_isArray(value) {
    return Array.isArray(value);
}
function isWellDefinedArray(array) {
    return !array.some(none);
}
function newArray(length, value) {
    const array = new Array();
    for (let index = 0; index < length; index += 1) {
        array.push(value);
    }
    return array;
}
function findIndex(array, value) {
    const notFound = -1;
    const index = array.indexOf(value);
    if (index === notFound) {
        return undefined;
    }
    return index;
}
function findAllIndices(array, predicate) {
    const results = new Array();
    array.forEach((element, index) => {
        if (predicate(element)) {
            results.push(index);
        }
    });
    return results;
}
function compareArrays(a, b, compare = isEqual) {
    if (a.length !== b.length) {
        return false;
    }
    const length = a.length;
    for (let i = 0; i < length; i += 1) {
        if (!compare(a[i], b[i])) {
            return false;
        }
    }
    return true;
}
function has(array, value) {
    return some(findIndex(array, value));
}
function findUnique(array, predicate) {
    const matchingElements = array.filter(predicate);
    if (matchingElements.length !== 1) {
        return undefined;
    }
    return first(matchingElements);
}
function maybeFirst(array) {
    if (none(array)) {
        return undefined;
    }
    return first(array);
}
function deduplicateAndSort(array) {
    return Array.from(new Set(array)).sort();
}

;// CONCATENATED MODULE: ../lib/host/messages.ts





function isSerializedPhishingNavSeqData(value) {
    return isObject(value) &&
        isNumber(value.version) &&
        isNumber(value.builtinRulesPrecedence) &&
        isArray(value.seqs);
}
function isSerializedNewTabPageUrlsV7(value) {
    return isObject(value) &&
        isArray(value.chrome) &&
        isArray(value.firefox) &&
        isArray(value.edge);
}
function isSerializedNewTabPageUrlsV12(value) {
    return isObject(value) &&
        isArray(value.chrome) &&
        isArray(value.firefox) &&
        isArray(value.edge) &&
        isArray(value.edgeChromium);
}
function isSerializedLPSConsumersV13(value) {
    return isArray(value);
}
function isSerializedLPSConsumersV15(value) {
    return isObject(value) &&
        isArray(value.chrome) &&
        isArray(value.firefox) &&
        isArray(value.edgeChromium) &&
        isArray(value.secureBrowser) &&
        isBoolean(value.sbxSecureBrowserMode);
}
;
function isTabMessage(message) {
    return message.tabId !== undefined;
}
function IsIdMessage(message) {
    return message.id !== undefined;
}
class LaunchBrowserRequestV1 {
    constructor(urlSpec, id) {
        this.urlSpec = urlSpec;
        this.id = id;
    }
}
class LaunchBrowserResponseV1 {
    constructor(urlSpec, id, didLaunch) {
        this.urlSpec = urlSpec;
        this.id = id;
        this.didLaunch = didLaunch;
    }
}
class HandshakeV1 {
    constructor(versions) {
        this.versions = versions;
    }
}
class ConfigRequestV1 {
    constructor(phishingSourceSitesVersion, phishingNavigationSequencesVersion, browserInfo) {
        this.phishingSourceSitesVersion = phishingSourceSitesVersion;
        this.phishingNavigationSequencesVersion = phishingNavigationSequencesVersion;
        this.browserInfo = browserInfo;
    }
}
class ExtensibleConfigChangedV1 {
    constructor(isEnabled, blockedPageStrings, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser) {
        this.isEnabled = isEnabled;
        this.blockedPageStrings = blockedPageStrings;
        this.phishingSourceSites = phishingSourceSites;
        this.phishingNavigationSequences = phishingNavigationSequences;
        this.trustedSites = trustedSites;
        this.untrustedSites = untrustedSites;
        this.userTrustedOrigins = userTrustedOrigins;
        this.userUntrustedOrigins = userUntrustedOrigins;
        this.openPhishingLinksInSecureBrowser = openPhishingLinksInSecureBrowser;
    }
}
class ReputationChangedV3 {
    constructor(index, total, reputableSites) {
        this.index = index;
        this.total = total;
        this.reputableSites = reputableSites;
    }
}
class DownloadCreatedV30 {
    constructor(urlSpec, fileSpec) {
        this.urlSpec = urlSpec;
        this.fileSpec = fileSpec;
    }
}
class DownloadCompleteV1 {
    constructor(urlSpec, fileSpec) {
        this.urlSpec = urlSpec;
        this.fileSpec = fileSpec;
    }
}
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["Info"] = 0] = "Info";
    LogLevel[LogLevel["Error"] = 1] = "Error";
})(LogLevel || (LogLevel = {}));
class LogMessageV1 {
    constructor(level, message) {
        this.level = level;
        this.message = message;
    }
}
class HelperErrorV1 {
    constructor(errorType, errorMessage) {
        this.errorType = errorType;
        this.errorMessage = errorMessage;
    }
}
class DormantStateChangedV1 {
    constructor(isDormant) {
        this.isDormant = isDormant;
    }
}
class ExtensionReadyV1 {
    constructor(tabId) {
        this.tabId = tabId;
    }
}
class ExternalAppLinkResponseV1 {
    constructor(navigateToSpec) {
        this.navigateToSpec = navigateToSpec;
    }
}
class AddUserTrustedOriginV1 {
    constructor(origin) {
        this.origin = origin;
    }
}
class AddUserUntrustedOriginV1 {
    constructor(origin) {
        this.origin = origin;
    }
}
class IsFileURLTrustedRequestV1 {
    constructor(id, fileUrlSpec) {
        this.id = id;
        this.fileUrlSpec = fileUrlSpec;
    }
}
class IsFileURLTrustedResponseV1 {
    constructor(id, fileUrlSpec, isTrusted) {
        this.id = id;
        this.fileUrlSpec = fileUrlSpec;
        this.isTrusted = isTrusted;
    }
}
class BlockedFileRequestV1 {
    constructor(fileUrlSpec) {
        this.fileUrlSpec = fileUrlSpec;
    }
}
class BlockedFileResponseV1 {
    constructor(fileUrlSpec, isTrusted) {
        this.fileUrlSpec = fileUrlSpec;
        this.isTrusted = isTrusted;
    }
}
class PopupDataRequestV1 {
    constructor() { }
}
class ClearRememberedDecisionsV1 {
    constructor() { }
}
class EnabledFeaturesRequestV2 {
    constructor(id, respondImmediately) {
        this.id = id;
        this.respondImmediately = respondImmediately;
    }
}
class EnabledFeaturesResponseV2 {
    constructor(id, linkProtection, fileURLProtection, pdfProtection, downloadProtection) {
        this.id = id;
        this.linkProtection = linkProtection;
        this.fileURLProtection = fileURLProtection;
        this.pdfProtection = pdfProtection;
        this.downloadProtection = downloadProtection;
    }
}
var RememberedOriginTypes;
(function (RememberedOriginTypes) {
    RememberedOriginTypes[RememberedOriginTypes["Trusted"] = 0] = "Trusted";
    RememberedOriginTypes[RememberedOriginTypes["Untrusted"] = 1] = "Untrusted";
})(RememberedOriginTypes || (RememberedOriginTypes = {}));
class ClearRememberedOriginV3 {
    constructor(origin, type) {
        this.origin = origin;
        this.type = type;
    }
}
class ExtensibleConfigChangedV3 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV1)) {
    constructor(isEnabled, blockedPageStrings, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites) {
        super(isEnabled, blockedPageStrings, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser);
        this.prioritiseTrustedSites = prioritiseTrustedSites;
    }
}
class ExtensibleConfigChangedV4 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV3)) {
    constructor(isEnabled, blockedPageStrings, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized) {
        super(isEnabled, blockedPageStrings, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites);
        this.promptForUncategorized = promptForUncategorized;
    }
}
class ExtensibleConfigChangedV5 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV4)) {
    constructor(isEnabled, blockedPageStrings, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, isEnterpriseProduct) {
        super(isEnabled, blockedPageStrings, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized);
        this.isEnterpriseProduct = isEnterpriseProduct;
    }
}
class ExtensibleConfigChangedV7 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV5)) {
    constructor(isEnabled, blockedPageStrings, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, isEnterpriseProduct, newTabPageUrls) {
        super(isEnabled, blockedPageStrings, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, isEnterpriseProduct);
        this.newTabPageUrls = newTabPageUrls;
    }
}
class TrustUrlV8 {
    constructor(navigateToUrlSpec, blockedUrlSpec, trustUrl, rememberDecision, contentType) {
        this.navigateToUrlSpec = navigateToUrlSpec;
        this.blockedUrlSpec = blockedUrlSpec;
        this.trustUrl = trustUrl;
        this.rememberDecision = rememberDecision;
        this.contentType = contentType;
    }
}
class ExtensibleConfigChangedV8 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV7)) {
    constructor(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, isEnterpriseProduct, isConsumerProduct, newTabPageUrls, blockedPageLearnMoreURL) {
        super(isEnabled, undefined, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, isEnterpriseProduct, newTabPageUrls);
        this.isConsumerProduct = isConsumerProduct;
        this.blockedPageLearnMoreURL = blockedPageLearnMoreURL;
    }
}
class ExtensibleConfigChangedV9 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV8)) {
    constructor(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, isEnterpriseProduct, isConsumerProduct, newTabPageUrls, blockedPageLearnMoreURL, dontAskAgain) {
        super(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, isEnterpriseProduct, isConsumerProduct, newTabPageUrls, blockedPageLearnMoreURL);
        this.dontAskAgain = dontAskAgain;
    }
}
class HeartbeatV10 {
    constructor(id) {
        this.id = id;
    }
}
var SureClickStatus;
(function (SureClickStatus) {
    SureClickStatus[SureClickStatus["Enabled"] = 0] = "Enabled";
    SureClickStatus[SureClickStatus["Disabled"] = 1] = "Disabled";
    SureClickStatus[SureClickStatus["InitRequired"] = 2] = "InitRequired";
    SureClickStatus[SureClickStatus["Unlicensed"] = 3] = "Unlicensed";
    SureClickStatus[SureClickStatus["Unknown"] = 4] = "Unknown";
})(SureClickStatus || (SureClickStatus = {}));
class ExtensibleConfigChangedV11 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV9)) {
    constructor(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, isEnterpriseProduct, isConsumerProduct, newTabPageUrls, blockedPageLearnMoreURL, dontAskAgain, secureBrowserRedirectTrustedSites, productStatus) {
        super(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, isEnterpriseProduct, isConsumerProduct, newTabPageUrls, blockedPageLearnMoreURL, dontAskAgain);
        this.secureBrowserRedirectTrustedSites = secureBrowserRedirectTrustedSites;
        this.productStatus = productStatus;
    }
}
class ExtensibleConfigChangedV12 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV11)) {
}
class ExtensibleConfigChangedV13 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV12)) {
    constructor(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, isEnterpriseProduct, isConsumerProduct, newTabPageUrls, blockedPageLearnMoreURL, dontAskAgain, secureBrowserRedirectTrustedSites, sureClickStatus, linkProtectionServiceConsumers) {
        super(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, isEnterpriseProduct, isConsumerProduct, newTabPageUrls, blockedPageLearnMoreURL, dontAskAgain, secureBrowserRedirectTrustedSites, sureClickStatus);
        this.linkProtectionServiceConsumers = linkProtectionServiceConsumers;
    }
}
class ExtensibleConfigChangedV14 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV13)) {
}
class ExtensibleConfigChangedV15 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV14)) {
}
class ExternalAppLinkRequestV16 {
    constructor(linkSpec, externalAppName, vmid) {
        this.linkSpec = linkSpec;
        this.externalAppName = externalAppName;
        this.vmid = vmid;
    }
}
class ExtensibleConfigChangedV17 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV15)) {
    constructor(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, isEnterpriseProduct, isConsumerProduct, newTabPageUrls, blockedPageLearnMoreURL, dontAskAgain, secureBrowserRedirectTrustedSites, sureClickStatus, linkProtectionServiceConsumers, closeLaunchedPageTabs) {
        super(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, isEnterpriseProduct, isConsumerProduct, newTabPageUrls, blockedPageLearnMoreURL, dontAskAgain, secureBrowserRedirectTrustedSites, sureClickStatus, linkProtectionServiceConsumers);
        this.closeLaunchedPageTabs = closeLaunchedPageTabs;
    }
}
var ProductTypes;
(function (ProductTypes) {
    ProductTypes[ProductTypes["Unknown"] = 0] = "Unknown";
    ProductTypes[ProductTypes["LegacyEnterprise"] = 1] = "LegacyEnterprise";
    ProductTypes[ProductTypes["LegacyOther"] = 2] = "LegacyOther";
    ProductTypes[ProductTypes["DaaS"] = 3] = "DaaS";
    ProductTypes[ProductTypes["Unbundled"] = 4] = "Unbundled";
    ProductTypes[ProductTypes["Kodiak"] = 5] = "Kodiak";
    ProductTypes[ProductTypes["Foundation"] = 6] = "Foundation";
})(ProductTypes || (ProductTypes = {}));
class ExtensibleConfigChangedV19 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV17)) {
    constructor(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, linkProtectionServiceConsumers, closeLaunchedPageTabs, isHPConsumerMachine, productType) {
        super(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, undefined, undefined, newTabPageUrls, blockedPageLearnMoreURL, undefined, secureBrowserRedirectTrustedSites, sureClickStatus, linkProtectionServiceConsumers, closeLaunchedPageTabs);
        this.isHPConsumerMachine = isHPConsumerMachine;
        this.productType = productType;
    }
}
class ExtensibleConfigChangedV20 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV19)) {
    constructor(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, linkProtectionServiceConsumers, closeLaunchedPageTabs, isHPConsumerMachine, productType, intranetSites) {
        super(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, linkProtectionServiceConsumers, closeLaunchedPageTabs, isHPConsumerMachine, productType);
        this.intranetSites = intranetSites;
    }
}
class ExtensibleConfigChangedV21 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV20)) {
}
class PhishingDetectionTrippedV22 {
    constructor() { }
}
class PhishingDetectionSuppressedV22 {
    constructor() { }
}
class PhishingInformationSubmittedV22 {
    constructor() { }
}
class FrameLoadResponseV22 {
    constructor(frameId, linkProtectionWouldBlock, ipEnabled, ipConfig) {
        this.frameId = frameId;
        this.linkProtectionWouldBlock = linkProtectionWouldBlock;
        this.ipEnabled = ipEnabled;
        this.ipConfig = ipConfig;
    }
}
class ContentScriptDataV22 {
    constructor(linkProtectionWouldBlock, ipEnabled, ipConfig) {
        this.linkProtectionWouldBlock = linkProtectionWouldBlock;
        this.ipEnabled = ipEnabled;
        this.ipConfig = ipConfig;
    }
}
class OnFrameDomUpdateV22 {
    constructor(hasInterestingInput, hasCategory) {
        this.hasInterestingInput = hasInterestingInput;
        this.hasCategory = hasCategory;
    }
}
class FreezeScreenshotV22 {
    constructor() { }
}
class OnOverlayClickV22 {
    constructor(action) {
        this.action = action;
    }
}
class OnPhishingCategoryChangedV22 {
    constructor(category, canonicalBlockingSource) {
        this.category = category;
        this.canonicalBlockingSource = canonicalBlockingSource;
    }
    ;
}
class messages_PhishingCategoryRequestV22 {
    constructor(id, url) {
        this.id = id;
        this.url = url;
    }
}
class PhishingCategoryResponseV22 {
    constructor(id, category) {
        this.id = id;
        this.category = category;
    }
}
class messages_PhishingHostStatusChangeV22 {
    constructor(hostnames, allowInput) {
        this.hostnames = hostnames;
        this.allowInput = allowInput;
    }
}
class PreparePhishingReportV22 {
    constructor(tabId, timestamp, extensionId, extensionVersion, cloudListVersion, alertType, url, screenshotBase64, tabActivities, annotations) {
        this.tabId = tabId;
        this.timestamp = timestamp;
        this.extensionId = extensionId;
        this.extensionVersion = extensionVersion;
        this.cloudListVersion = cloudListVersion;
        this.alertType = alertType;
        this.url = url;
        this.screenshotBase64 = screenshotBase64;
        this.tabActivities = tabActivities;
        this.annotations = annotations;
    }
}
class PreparePhishingReportV28 {
    constructor(tabId, timestamp, extensionId, extensionVersion, cloudListVersion, alertType, url, screenshotBase64, statusCode, statusMsg, domainAgeDays, domainAgeDaysThreshold, tabActivities, annotations) {
        this.tabId = tabId;
        this.timestamp = timestamp;
        this.extensionId = extensionId;
        this.extensionVersion = extensionVersion;
        this.cloudListVersion = cloudListVersion;
        this.alertType = alertType;
        this.url = url;
        this.screenshotBase64 = screenshotBase64;
        this.statusCode = statusCode;
        this.statusMsg = statusMsg;
        this.domainAgeDays = domainAgeDays;
        this.domainAgeDaysThreshold = domainAgeDaysThreshold;
        this.tabActivities = tabActivities;
        this.annotations = annotations;
    }
}
class PreparePhishingReportV32 extends (/* unused pure expression or super */ null && (PreparePhishingReportV28)) {
    constructor(tabId, timestamp, extensionId, extensionVersion, cloudListVersion, alertType, url, screenshotBase64, statusCode, statusMsg, domainAgeDays, domainAgeDaysThreshold, tabActivities, annotations, logoAnalysis) {
        super(tabId, timestamp, extensionId, extensionVersion, cloudListVersion, alertType, url, screenshotBase64, statusCode, statusMsg, domainAgeDays, domainAgeDaysThreshold, tabActivities, annotations);
        this.logoAnalysis = logoAnalysis;
    }
}
class AddPhishingReportActionV22 {
    constructor(tabId, action) {
        this.tabId = tabId;
        this.action = action;
    }
}
class SendPhishingReportV22 {
    constructor(tabId) {
        this.tabId = tabId;
    }
}
class OptionsDataResponseV22 {
    constructor(ipShowList, ipUserAllowedHosts) {
        this.ipShowList = ipShowList;
        this.ipUserAllowedHosts = ipUserAllowedHosts;
    }
}
class ExtensibleConfigChangedV22 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV21)) {
    constructor(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, linkProtectionServiceConsumers, closeLaunchedPageTabs, isHPConsumerMachine, productType, intranetSites, identityProtection) {
        super(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, linkProtectionServiceConsumers, closeLaunchedPageTabs, isHPConsumerMachine, productType, intranetSites);
        this.identityProtection = identityProtection;
    }
}
class ExtensibleConfigChangedV23 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV22)) {
    constructor(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, closeLaunchedPageTabs, isHPConsumerMachine, productType, intranetSites, identityProtection) {
        super(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, undefined, closeLaunchedPageTabs, isHPConsumerMachine, productType, intranetSites, identityProtection);
    }
}
class IdentityProtectionRunningV24 {
    constructor(running) {
        this.running = running;
    }
}
class ExtensibleConfigChangedV24 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV23)) {
    constructor(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, closeLaunchedPageTabs, isHPConsumerMachine, productType, intranetSites, identityProtection, ipIsSureClick) {
        super(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, closeLaunchedPageTabs, isHPConsumerMachine, productType, intranetSites, identityProtection);
        this.ipIsSureClick = ipIsSureClick;
    }
}
class PopupDataResponseV25 {
    constructor(popupMessage, showClearRememberedDecisionsInfo, showSecureBrowserWindowButton, productType, helpLinkURL) {
        this.popupMessage = popupMessage;
        this.showClearRememberedDecisionsInfo = showClearRememberedDecisionsInfo;
        this.showSecureBrowserWindowButton = showSecureBrowserWindowButton;
        this.productType = productType;
        this.helpLinkURL = helpLinkURL;
    }
}
class ShowUrlFilteringOverlayV26 {
    constructor(blockingCategories) {
        this.blockingCategories = blockingCategories;
    }
}
class ShowDomainAgeUrlFilteringOverlayV28 {
    constructor(domainAgeDays) {
        this.domainAgeDays = domainAgeDays;
    }
}
class ShowStatusMsgUrlFilteringOverlayV29 {
    constructor(statusMsg) {
        this.statusMsg = statusMsg;
    }
}
class MakeUrlFilteringAlertV26 {
    constructor(tabId, timestamp, extensionId, extensionVersion, url, blockingCategories, tabActivities) {
        this.tabId = tabId;
        this.timestamp = timestamp;
        this.extensionId = extensionId;
        this.extensionVersion = extensionVersion;
        this.url = url;
        this.blockingCategories = blockingCategories;
        this.tabActivities = tabActivities;
    }
}
class MakeUrlFilteringAlertV27 {
    constructor(tabId, timestamp, extensionId, extensionVersion, url, blockingCategories, statusCode, statusMsg, overridden, tabActivities) {
        this.tabId = tabId;
        this.timestamp = timestamp;
        this.extensionId = extensionId;
        this.extensionVersion = extensionVersion;
        this.url = url;
        this.blockingCategories = blockingCategories;
        this.statusCode = statusCode;
        this.statusMsg = statusMsg;
        this.overridden = overridden;
        this.tabActivities = tabActivities;
    }
}
class MakeUrlFilteringAlertV28 extends (/* unused pure expression or super */ null && (MakeUrlFilteringAlertV27)) {
    constructor(tabId, timestamp, extensionId, extensionVersion, url, blockingCategories, statusCode, statusMsg, overridden, tabActivities, domainAgeDays, domainAgeDaysThreshold, alertType) {
        super(tabId, timestamp, extensionId, extensionVersion, url, blockingCategories, statusCode, statusMsg, overridden, tabActivities);
        this.domainAgeDays = domainAgeDays;
        this.domainAgeDaysThreshold = domainAgeDaysThreshold;
        this.alertType = alertType;
    }
}
class ExtensibleConfigChangedV26 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV24)) {
    constructor(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, closeLaunchedPageTabs, isHPConsumerMachine, productType, intranetSites, identityProtection, ipIsSureClick, ufBlockedCategories) {
        super(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, closeLaunchedPageTabs, isHPConsumerMachine, productType, intranetSites, identityProtection, ipIsSureClick);
        this.ufBlockedCategories = ufBlockedCategories;
    }
}
class ExtensibleConfigChangedV28 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV26)) {
    constructor(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, closeLaunchedPageTabs, isHPConsumerMachine, productType, intranetSites, identityProtection, ipIsSureClick, ufBlockedCategories, ufDomainAgeCheckEnabled, ufDomainAgeCheckMinDays) {
        super(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, closeLaunchedPageTabs, isHPConsumerMachine, productType, intranetSites, identityProtection, ipIsSureClick, ufBlockedCategories);
        this.ufDomainAgeCheckEnabled = ufDomainAgeCheckEnabled;
        this.ufDomainAgeCheckMinDays = ufDomainAgeCheckMinDays;
    }
}
class ExtensibleConfigChangedV29 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV28)) {
    constructor(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, closeLaunchedPageTabs, isHPConsumerMachine, productType, intranetSites, identityProtection, ipIsSureClick, ufBlockedCategories, ufDomainAgeCheckEnabled, ufDomainAgeCheckMinDays, ufStatusCodeCheckEnabled) {
        super(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, closeLaunchedPageTabs, isHPConsumerMachine, productType, intranetSites, identityProtection, ipIsSureClick, ufBlockedCategories, ufDomainAgeCheckEnabled, ufDomainAgeCheckMinDays);
        this.ufStatusCodeCheckEnabled = ufStatusCodeCheckEnabled;
    }
}
class AnalyseWebsiteScreenshotOpportunityEventV31 {
    constructor(important) {
        this.important = important;
    }
}
var LogoAnalysisResultTypes;
(function (LogoAnalysisResultTypes) {
    LogoAnalysisResultTypes[LogoAnalysisResultTypes["Failure"] = 0] = "Failure";
    LogoAnalysisResultTypes[LogoAnalysisResultTypes["NoLogoFound"] = 1] = "NoLogoFound";
    LogoAnalysisResultTypes[LogoAnalysisResultTypes["UnknownLogoFound"] = 2] = "UnknownLogoFound";
    LogoAnalysisResultTypes[LogoAnalysisResultTypes["KnownLogoFound"] = 3] = "KnownLogoFound";
})(LogoAnalysisResultTypes || (LogoAnalysisResultTypes = {}));
class AnalyseWebsiteScreenshotRequestV31 {
    constructor(id, url, screenshotBase64) {
        this.id = id;
        this.url = url;
        this.screenshotBase64 = screenshotBase64;
    }
}
class AnalyseWebsiteScreenshotResponseV31 {
    constructor(id, result, url, identifiedBrandLogos) {
        this.id = id;
        this.result = result;
        this.url = url;
        this.identifiedBrandLogos = identifiedBrandLogos;
    }
}
class OnLogoAnalysisCompleteV31 {
    constructor(logoFound, protectedLogoFound, protectedBrandLogo) {
        this.logoFound = logoFound;
        this.protectedLogoFound = protectedLogoFound;
        this.protectedBrandLogo = protectedBrandLogo;
    }
}
class Message {
    constructor(type, payload) {
        this.type = type;
        this.payload = payload;
    }
}
function messages_messageToString(message) {
    return string_utils_toString(message);
}

;// CONCATENATED MODULE: ./scripts/content-script/page-collectors.ts


class BasePageCollector {
    constructor(pageManager, messageSender) {
        this.pageManager = pageManager;
        this.messageSender = messageSender;
    }
}
class OnSubmitCollector extends BasePageCollector {
    constructor() {
        super(...arguments);
        this.forms = [];
        this.onSubmittedCB = () => this.onSubmitted();
    }
    onSubmitted() {
        if (this.pageManager.hasTripped) {
            this.messageSender.sendMessage(message_types_MessageType.phishingInformationSubmittedV22, new PhishingInformationSubmittedV22());
        }
    }
    reset() {
        for (const form of this.forms) {
            form.removeEventListener("submit", this.onSubmittedCB);
        }
        this.forms = [];
    }
    setup() {
        this.forms = Array.from(document.querySelectorAll("form"));
        for (const form of this.forms) {
            form.addEventListener("submit", this.onSubmittedCB);
        }
    }
}

;// CONCATENATED MODULE: ../lib/common/dom-utils.ts

function navigateDocument(document, url) {
    document.location.href = URLToString(url);
}
const INPUT_TAG = "INPUT";

;// CONCATENATED MODULE: ../lib/common/id-generator.ts


class id_generator_IdGenerator {
    constructor() {
        this.nextId = 0;
    }
    generateId() {
        const id = this.nextId;
        this.nextId += 1;
        return id;
    }
}
function hashId(id, seed = 0) {
    return murmurHash(id, seed);
}
function isSameId(a, b) {
    return a === b;
}
function makeIdHashSet() {
    return new HashSet(hashId, isSameId);
}
function makeIdHashMap() {
    return new HashMap(hashId, isSameId);
}

;// CONCATENATED MODULE: ./scripts/content-script/element-disabler.ts


class ElementDisabler {
    constructor() {
        this.originalStateKey = "brOriginalState";
        this.userInputCacheKey = "hpUserInput";
        this.blockedStyle = "background-image: url(" + chrome.runtime.getURL("icons/ip16.png") + ");" +
            "background-position: calc(100% - 2px) 50%;" +
            "background-repeat: no-repeat;" +
            "background-color: rgb(200,200,200);";
        this.originalStyles = new Map();
        this.idGenerator = new id_generator_IdGenerator();
    }
    disableElement(element) {
        element.dataset.hpBlockedId = this.generateBlockedId();
        if (!element.disabled && !element.dataset.hasOwnProperty(this.userInputCacheKey)) {
            try {
                if (element.value !== "") {
                    if (element.type !== "password") {
                        element.dataset[this.userInputCacheKey] = element.value;
                    }
                    element.value = "";
                }
            }
            catch (_a) {
                delete element.dataset[this.userInputCacheKey];
            }
        }
        element.dataset[this.originalStateKey] = element.disabled ? "true" : "false";
        element.disabled = true;
        const originalStyle = element.style.cssText;
        element.style.cssText = this.blockedStyle;
        this.originalStyles.set(element.dataset.hpBlockedId, originalStyle);
    }
    resetElement(element) {
        var _a;
        if (maybe_none(element.dataset.hpBlockedId)) {
            return;
        }
        const originalStyle = (_a = this.originalStyles.get(element.dataset.hpBlockedId)) !== null && _a !== void 0 ? _a : "";
        element.style.cssText = originalStyle;
        this.originalStyles.delete(element.dataset.hpBlockedId);
        if (element.dataset[this.originalStateKey] === "true") {
            element.disabled = true;
        }
        else {
            element.disabled = false;
        }
        delete element.dataset[this.originalStateKey];
        const cachedInput = element.dataset[this.userInputCacheKey];
        if (maybe_some(cachedInput)) {
            element.value = cachedInput;
            delete element.dataset[this.userInputCacheKey];
        }
        delete element.dataset.hpBlockedId;
    }
    generateBlockedId() {
        return `hp-blocked-${this.idGenerator.generateId()}`;
    }
}

;// CONCATENATED MODULE: ./scripts/content-script/dom-monitor.ts

class DOMMonitor {
    constructor(onInterestingDomMutation) {
        this.onInterestingDomMutation = onInterestingDomMutation;
        this.childObserver = new MutationObserver(() => this.onChildMutation());
        this.attributeObserver = new MutationObserver(mutations => this.onAttributeMutation(mutations));
    }
    resume() {
        this.childObserver.observe(document.body, { childList: true, subtree: true });
        if (document.querySelector(INPUT_TAG)) {
            this.attributeObserver.observe(document.body, { attributes: true, subtree: true });
        }
    }
    suspend() {
        this.childObserver.disconnect();
        this.attributeObserver.disconnect();
    }
    onChildMutation() {
        this.onInterestingDomMutation();
    }
    onAttributeMutation(mutationRecords) {
        for (const record of mutationRecords) {
            if (record.target instanceof Element && record.target.tagName === INPUT_TAG
                && record.type === "attributes" && record.attributeName === "type") {
                this.onInterestingDomMutation();
                return;
            }
        }
    }
}

;// CONCATENATED MODULE: ../lib/common/api-listener.ts


function suppressRuntimeErrors(knownErrorMessages) {
    const lastError = checkRuntimeLastError();
    if (none(lastError) || knownErrorMessages.some(m => lastError.startsWith(m))) {
        return;
    }
    logError(lastError);
}
function checkRuntimeLastError() {
    const lastError = chrome.runtime.lastError;
    if (lastError) {
        return lastError.message;
    }
    return undefined;
}
class ApiListenerManager {
    constructor() {
        this.eventData = [];
    }
    addEvent(name, event, callback, filter, extraInfo) {
        this.eventData.push([name, event, callback, filter, extraInfo]);
    }
    registerListeners() {
        for (const [name, event, callback, filter, extraInfo] of this.eventData) {
            const hasListener = event.hasListener(callback);
            logObject('ApiListenerManager.registerListeners', {
                name,
                filter,
                extraInfo,
                hasListener,
            });
            if (!hasListener) {
                if (some(filter)) {
                    if (some(extraInfo)) {
                        event.addListener(callback, filter, extraInfo);
                    }
                    else {
                        event.addListener(callback, filter);
                    }
                }
                else {
                    event.addListener(callback);
                }
            }
        }
    }
    unregisterListeners() {
        for (const [name, event, callback, filter, extraInfo] of this.eventData) {
            const hasListener = event.hasListener(callback);
            logObject('ApiListenerManager.unregisterListeners', {
                name,
                filter,
                extraInfo,
                hasListener,
            });
            if (hasListener) {
                event.removeListener(callback);
            }
        }
    }
}

;// CONCATENATED MODULE: ../lib/common/date-utils.ts
function currentDateTimeString() {
    return new Date().toISOString();
}

;// CONCATENATED MODULE: ../lib/common/storage.ts
var storage_StorageKey;
(function (StorageKey) {
    StorageKey["configMessage"] = "configMessage";
    StorageKey["reputableSites"] = "reputableSites";
    StorageKey["enabledFeatures"] = "enabledFeatures";
    StorageKey["failedReloadAttempts"] = "failedReloadAttempts";
    StorageKey["historySeeder"] = "historySeeder";
    StorageKey["customerList"] = "customerList";
    StorageKey["userEnabledLogging"] = "userEnabledLogging";
})(storage_StorageKey || (storage_StorageKey = {}));

;// CONCATENATED MODULE: ../lib/common/event-dispatcher.ts

class EventDispatcher {
    constructor() {
        this.eventHandlers = new Array();
        this.oneShotEventHandlers = new Array();
    }
    registerEventHandler(eventHandler) {
        this.eventHandlers.push(eventHandler);
    }
    registerOneShotEventHandler(eventHandler) {
        this.oneShotEventHandlers.push(eventHandler);
    }
    dispatchEvent(event) {
        for (const handleEvent of this.eventHandlers) {
            handleEvent(event);
        }
        for (const handleEvent of this.oneShotEventHandlers) {
            handleEvent(event);
        }
        this.oneShotEventHandlers = [];
    }
}
class ConditionDispatcher {
    constructor() {
        this.setCondition = doOnce(() => { this.setConditionImpl(); });
        this.condition = false;
        this.conditionHandlers = new Array();
    }
    registerConditionListener(conditionHandler) {
        if (this.condition) {
            conditionHandler();
        }
        else {
            this.conditionHandlers.push(conditionHandler);
        }
    }
    setConditionImpl() {
        this.condition = true;
        for (const handleCondition of this.conditionHandlers) {
            handleCondition();
        }
        this.conditionHandlers = [];
    }
}

;// CONCATENATED MODULE: ../lib/common/log.ts







class ConsoleLogSink {
    constructor() {
        this.logError = this.log;
    }
    log(message) {
        console.log(message);
    }
}
class BaseLogger {
    constructor() {
        this.enabledChanged = new EventDispatcher();
        this.sinks = [];
        this.addSink(new ConsoleLogSink());
    }
    addSink(sink) {
        this.sinks.push(sink);
    }
    formatMessage(message) {
        return `${currentDateTimeString()}: ${message}`;
    }
    log(message) {
        const formattedMessage = this.formatMessage(message);
        for (const sink of this.sinks) {
            sink.log(formattedMessage);
        }
    }
    logError(error) {
        const message = errorToString(error);
        const formattedMessage = this.formatMessage(message);
        for (const sink of this.sinks) {
            sink.logError(formattedMessage);
        }
    }
    get isEnabled() {
        return true;
    }
    set isEnabled(enabled) { }
}
class FirefoxLogger extends BaseLogger {
    constructor() {
        super();
        this.enabled = false;
        this.messageQueue = [];
        const key = FirefoxLogger.storageKey;
        chrome.storage.local.get(key, result => {
            var _a;
            const enabled = (_a = result[key]) !== null && _a !== void 0 ? _a : false;
            this.onEnabledChanged(enabled);
            chrome.storage.onChanged.addListener((changes, areaName) => {
                var _a;
                const newEnabled = (_a = changes[key]) === null || _a === void 0 ? void 0 : _a.newValue;
                if (maybe_some(newEnabled) && this.enabled !== newEnabled) {
                    this.onEnabledChanged(newEnabled);
                }
            });
        });
    }
    static get storageKey() {
        return storage_StorageKey.userEnabledLogging;
    }
    log(message) {
        const queue = this.messageQueue;
        if (maybe_some(queue)) {
            queue.push(message);
        }
        else if (this.isEnabled) {
            super.log(message);
        }
    }
    logError(error) {
        const queue = this.messageQueue;
        if (maybe_some(queue)) {
            queue.push(error);
        }
        else if (this.isEnabled) {
            super.logError(error);
        }
    }
    get isEnabled() {
        return this.enabled;
    }
    set isEnabled(enabled) {
        if (this.enabled === enabled) {
            return;
        }
        this.storeSetting(enabled);
        this.onEnabledChanged(enabled);
    }
    onEnabledChanged(enabled) {
        this.enabled = enabled;
        const queue = this.messageQueue;
        this.messageQueue = undefined;
        if (maybe_some(queue) && enabled) {
            this.drainQueue(queue);
        }
        this.enabledChanged.dispatchEvent(enabled);
    }
    drainQueue(queue) {
        for (const message of queue) {
            if (message instanceof Error) {
                super.logError(message);
            }
            else {
                super.log(message);
            }
        }
    }
    storeSetting(enabled) {
        const key = FirefoxLogger.storageKey;
        chrome.storage.local.set({ [key]: enabled }, () => {
            const error = checkRuntimeLastError();
            if (maybe_some(error)) {
                log_logError(`Error while storing that the user enabled logging: ${error}`);
            }
        });
    }
}
class DefaultLogger extends BaseLogger {
    constructor() {
        super();
    }
}
function makeLogger() {
    switch (currentBrowser) {
        case browser_Browser.firefox:
            return new FirefoxLogger();
        default:
            return new DefaultLogger();
    }
}
const logger = makeLogger();
function tryLog(log) {
    try {
        log();
    }
    catch (_a) {
        try {
            const error = new Error('tryLog');
            console.error(error);
        }
        catch (_b) { }
    }
}
function errorToString(error) {
    var _a, _b;
    return toJSONString({
        name: error.name,
        message: error.message,
        stack: (_b = (_a = error.stack) === null || _a === void 0 ? void 0 : _a.split('\n')) !== null && _b !== void 0 ? _b : []
    });
}
function log_log(message) {
    tryLog(() => {
        logger.log(message);
    });
}
function log_logObject(msg, o) {
    tryLog(() => {
        logger.log(`${msg}: ${toJSONString(o)}`);
    });
}
function isError(value) {
    return value instanceof Error;
}
function log_logError(errorOrMessage) {
    tryLog(() => {
        var _a;
        const error = (isError(errorOrMessage) ? errorOrMessage :
            isString(errorOrMessage) ? new Error(errorOrMessage) :
                new Error((_a = errorOrMessage === null || errorOrMessage === void 0 ? void 0 : errorOrMessage.toString()) !== null && _a !== void 0 ? _a : ''));
        logger.logError(error);
    });
}

;// CONCATENATED MODULE: ./scripts/content-script/page-monitors.ts



class BasePageMonitor {
    constructor(pageManager, messageSender) {
        this.pageManager = pageManager;
        this.messageSender = messageSender;
    }
}
class ScreenshotMonitor extends BasePageMonitor {
    constructor() {
        super(...arguments);
        this.stopped = false;
        this.onFocusCB = (event) => this.onInputFocus(event);
        this.onTransitionEndCB = (event) => this.onTransitionEnd(event);
    }
    start() {
        if (!this.stopped) {
            this.pageManager.interestingInputElements.forEach(e => e.addEventListener("focus", this.onFocusCB));
            document.addEventListener("transitionend", this.onTransitionEndCB);
        }
    }
    pause() {
        if (!this.stopped) {
            this.pageManager.interestingInputElements.forEach(e => e.removeEventListener("focus", this.onFocusCB));
            document.removeEventListener("transitionend", this.onTransitionEndCB);
        }
    }
    stop() {
        this.pause();
        this.stopped = true;
    }
    onInputFocus(event) {
        log_log(`Input was focused, will ask for screenshot analysis`);
        this.messageSender.sendMessage(message_types_MessageType.analyseWebsiteScreenshotOpportunityEventV31, new AnalyseWebsiteScreenshotOpportunityEventV31(true));
    }
    onTransitionEnd(event) {
        log_log(`Animation end was detected, will ask for screenshot analysis`);
        this.messageSender.sendMessage(message_types_MessageType.analyseWebsiteScreenshotOpportunityEventV31, new AnalyseWebsiteScreenshotOpportunityEventV31(false));
    }
}
class ScreenshotFreezer extends BasePageMonitor {
    constructor() {
        super(...arguments);
        this.stopped = false;
        this.onInputCB = (event) => this.onInput(event);
    }
    start() {
        if (!this.stopped) {
            this.pageManager.interestingInputElements.forEach(e => e.addEventListener("input", this.onInputCB));
        }
    }
    pause() {
        if (!this.stopped) {
            this.pageManager.interestingInputElements.forEach(e => e.removeEventListener("input", this.onInputCB));
        }
    }
    stop() {
        this.pause();
        this.stopped = true;
    }
    onInput(event) {
        this.messageSender.sendMessage(message_types_MessageType.freezeScreenshotV22, new FreezeScreenshotV22());
        this.stop();
    }
}

;// CONCATENATED MODULE: ../lib/common/identity-protection-common.ts


var identity_protection_common_IPPageCategory;
(function (IPPageCategory) {
    IPPageCategory[IPPageCategory["Allowed"] = 0] = "Allowed";
    IPPageCategory[IPPageCategory["Blocked"] = 1] = "Blocked";
    IPPageCategory[IPPageCategory["Unknown"] = 2] = "Unknown";
    IPPageCategory[IPPageCategory["UserAllowed"] = 3] = "UserAllowed";
})(identity_protection_common_IPPageCategory || (identity_protection_common_IPPageCategory = {}));
function isGoodCategory(category) {
    return category === identity_protection_common_IPPageCategory.Allowed || category === identity_protection_common_IPPageCategory.UserAllowed;
}
var IPOperationMode;
(function (IPOperationMode) {
    IPOperationMode[IPOperationMode["Normal"] = 0] = "Normal";
    IPOperationMode[IPOperationMode["BlockedFullReporting"] = 1] = "BlockedFullReporting";
    IPOperationMode[IPOperationMode["Learning"] = 2] = "Learning";
    IPOperationMode[IPOperationMode["PhishingProtection"] = 3] = "PhishingProtection";
    IPOperationMode[IPOperationMode["BlockedOnly"] = 4] = "BlockedOnly";
    IPOperationMode[IPOperationMode["Reserved5"] = 5] = "Reserved5";
    IPOperationMode[IPOperationMode["Reserved6"] = 6] = "Reserved6";
    IPOperationMode[IPOperationMode["Reserved7"] = 7] = "Reserved7";
    IPOperationMode[IPOperationMode["Reserved8"] = 8] = "Reserved8";
    IPOperationMode[IPOperationMode["Reserved9"] = 9] = "Reserved9";
    IPOperationMode[IPOperationMode["Reserved10"] = 10] = "Reserved10";
})(IPOperationMode || (IPOperationMode = {}));
function validateOperationMode(operationMode) {
    switch (operationMode) {
        case IPOperationMode.Normal:
        case IPOperationMode.BlockedFullReporting:
        case IPOperationMode.PhishingProtection:
        case IPOperationMode.BlockedOnly:
            return operationMode;
        case IPOperationMode.Learning:
            return IPOperationMode.BlockedFullReporting;
        default:
            logError(`Unknown or reserved identity protection operation mode: ${operationMode}`);
            return undefined;
    }
}
function shouldDisableInput(category, operationMode, linkProtectionWouldBlock) {
    if (isGoodCategory(category)) {
        return false;
    }
    if (maybe_none(category)) {
        category = identity_protection_common_IPPageCategory.Unknown;
    }
    switch (operationMode) {
        case IPOperationMode.Normal:
            return true;
        case IPOperationMode.PhishingProtection:
            return category === identity_protection_common_IPPageCategory.Blocked || linkProtectionWouldBlock;
        case IPOperationMode.BlockedFullReporting:
        case IPOperationMode.BlockedOnly:
            return category === identity_protection_common_IPPageCategory.Blocked;
    }
}
function shouldMakePhishingReport(category, operationMode, linkProtectionWouldBlock) {
    if (none(category) || isGoodCategory(category)) {
        return false;
    }
    switch (operationMode) {
        case IPOperationMode.Normal:
        case IPOperationMode.BlockedFullReporting:
            return true;
        case IPOperationMode.PhishingProtection:
            return category === identity_protection_common_IPPageCategory.Blocked || linkProtectionWouldBlock;
        case IPOperationMode.BlockedOnly:
            return category === identity_protection_common_IPPageCategory.Blocked;
    }
}
function identity_protection_common_isInputAllowableOpMode(operationMode) {
    return operationMode === IPOperationMode.Normal || operationMode === IPOperationMode.PhishingProtection;
}
var IPReportType;
(function (IPReportType) {
    IPReportType[IPReportType["CrendentialExtension"] = 0] = "CrendentialExtension";
    IPReportType[IPReportType["SmartScreen"] = 1] = "SmartScreen";
    IPReportType[IPReportType["URLFilteringExtension"] = 2] = "URLFilteringExtension";
    IPReportType[IPReportType["DomainAgeExtension"] = 3] = "DomainAgeExtension";
    IPReportType[IPReportType["DomainAgeURLFilteringExtension"] = 4] = "DomainAgeURLFilteringExtension";
    IPReportType[IPReportType["StatusCodeURLFilteringExtension"] = 5] = "StatusCodeURLFilteringExtension";
    IPReportType[IPReportType["AIBrandLogoProtectionExtension"] = 6] = "AIBrandLogoProtectionExtension";
})(IPReportType || (IPReportType = {}));
var IPReportActions;
(function (IPReportActions) {
    IPReportActions[IPReportActions["Unknown"] = 0] = "Unknown";
    IPReportActions[IPReportActions["InputAllowed"] = 1] = "InputAllowed";
    IPReportActions[IPReportActions["FormSubmitted"] = 2] = "FormSubmitted";
    IPReportActions[IPReportActions["LearningModeBypass"] = 3] = "LearningModeBypass";
    IPReportActions[IPReportActions["BlockedByBlocklist"] = 4] = "BlockedByBlocklist";
})(IPReportActions || (IPReportActions = {}));

;// CONCATENATED MODULE: ./scripts/content-script/page-detectors.ts


class BasePageDetector {
    constructor(pageManager, config) {
        this.pageManager = pageManager;
        this.config = config;
    }
    reset() { }
    setup() { }
    checkForDetectionTripped() { return false; }
}
class OnPasswordInputDetector extends BasePageDetector {
    constructor() {
        super(...arguments);
        this.onInputCB = (event) => this.onInput(event);
    }
    reset() {
        this.pageManager.passwordElements.forEach(pw => pw.removeEventListener("input", this.onInputCB));
    }
    setup() {
        if (this.shouldInstallPasswordTrigger()) {
            this.pageManager.passwordElements.forEach(pw => pw.addEventListener("input", this.onInputCB));
        }
    }
    checkForDetectionTripped() {
        return false;
    }
    shouldInstallPasswordTrigger() {
        return this.pageManager.passwordElements.length > 0
            && !isGoodCategory(this.pageManager.pageCategory)
            && !this.pageManager.hasTripped
            && this.config.onlyTriggerOnPasswordInput;
    }
    onInput(event) {
        if (this.shouldTrip()) {
            this.pageManager.signalDetectionTripped("password input");
        }
    }
    shouldTrip() {
        return (maybe_some(this.pageManager.pageCategory) && !isGoodCategory(this.pageManager.pageCategory)) || this.pageManager.hasProtectedBrandLogo;
    }
}
class PasswordPageDetector extends BasePageDetector {
    chckForDetectionTripped() {
        if (this.shouldTrip()) {
            this.pageManager.signalDetectionTripped("password page detector");
            return true;
        }
        return false;
    }
    shouldTrip() {
        return ((maybe_some(this.pageManager.pageCategory) && !isGoodCategory(this.pageManager.pageCategory)) || this.pageManager.hasProtectedBrandLogo)
            && this.pageManager.passwordElements.length > 0
            && !this.config.onlyTriggerOnPasswordInput
            && this.config.onlyOnPageWithPasswordInput;
    }
}
class ZealousDetector extends BasePageDetector {
    chekForDetectionTripped() {
        if (this.shouldTrip()) {
            this.pageManager.signalDetectionTripped("zealous detector");
            return true;
        }
        return false;
    }
    shouldTrip() {
        return ((maybe_some(this.pageManager.pageCategory) && !isGoodCategory(this.pageManager.pageCategory)) || this.pageManager.hasProtectedBrandLogo)
            && this.pageManager.interestingInputElements.length > 0
            && !this.config.onlyTriggerOnPasswordInput
            && !this.config.onlyOnPageWithPasswordInput;
    }
}

;// CONCATENATED MODULE: ./scripts/content-script/phishing-page-manager.ts












class PhishingPageManager {
    constructor(linkProtectionWouldBlock, config, messageSender) {
        this.linkProtectionWouldBlock = linkProtectionWouldBlock;
        this.config = config;
        this.messageSender = messageSender;
        this.PASSWORD_QUERY_STRING = `${INPUT_TAG}[type=password],${INPUT_TAG}[name=password]`;
        this.elementalist = new ElementDisabler();
        this.isEnabled = true;
        this._interestingInputElements = [];
        this._passwordElements = [];
        this.tripped = false;
        this.suppressed = false;
        this.suppressors = [
            new LinkAnalyserSuppressor(this, this.config),
            new PasswordFillerSuppressor(this, this.config)
        ];
        this.detectors = [
            new ZealousDetector(this, this.config),
            new OnPasswordInputDetector(this, this.config),
            new PasswordPageDetector(this, this.config)
        ];
        this.collectors = [
            new OnSubmitCollector(this, this.messageSender)
        ];
        this.monitors = [
            new ScreenshotMonitor(this, this.messageSender),
            new ScreenshotFreezer(this, this.messageSender)
        ];
        this.domMonitor = new DOMMonitor(() => this.inspectPage());
        this.inspectPage();
    }
    disable(newLinkProtectionWouldBlock) {
        this.linkProtectionWouldBlock = newLinkProtectionWouldBlock;
        if (this.isEnabled) {
            this.domMonitor.suspend();
            this.resetPage();
            this.isEnabled = false;
        }
    }
    enable(newLinkProtectionWouldBlock) {
        if (!this.isEnabled || this.linkProtectionWouldBlock !== newLinkProtectionWouldBlock) {
            this.linkProtectionWouldBlock = newLinkProtectionWouldBlock;
            this.inspectPage();
            this.isEnabled = true;
        }
    }
    get hasTripped() { return this.tripped; }
    get isSuppressed() { return this.suppressed; }
    get interestingInputElements() { return this._interestingInputElements; }
    get passwordElements() { return this._passwordElements; }
    get logoAnalysis() { return this._logoAnalysis; }
    get hasProtectedBrandLogo() {
        if (maybe_none(this.logoAnalysis)) {
            return false;
        }
        const { protectedLogoFound } = this.logoAnalysis;
        return this.pageCategory === identity_protection_common_IPPageCategory.Unknown && protectedLogoFound;
    }
    get pageCategory() { return this._pageCategory; }
    get canonicalBlockingReason() { return this._canonicalBlockingReason; }
    updatePageCategoryInfo(pageCategory, canonicalBlockingReason) {
        this._pageCategory = pageCategory;
        if (maybe_some(canonicalBlockingReason)) {
            this._canonicalBlockingReason = canonicalBlockingReason;
        }
        if (this.isEnabled) {
            this.inspectPage();
        }
    }
    updatePageLogoInfo(logoAnalysis) {
        const { protectedLogoFound, } = logoAnalysis;
        log_logObject('PhishingPageManager: Page logo detection updated', logoAnalysis);
        this._logoAnalysis = logoAnalysis;
        if (this.isEnabled) {
            this.inspectPage();
        }
    }
    signalDetectionTripped(reason) {
        log_log(`PhishingPageManager: Detection tripped because of ${reason}`);
        setTimeout(() => {
            if (this.tripped) {
                return;
            }
            this.runSuppressors();
            if (this.suppressed) {
                return;
            }
            log_log(`PhishingPageManager: Detection tripped because of ${reason}`);
            if (maybe_none(this.pageCategory)) {
                log_log(`Warning: Detection tripped before the page was categorised`);
            }
            this.messageSender.sendMessage(message_types_MessageType.phishingDetectionTrippedV22, new PhishingDetectionTrippedV22());
            this.handleDetectionTripped();
        }, 10);
    }
    handleDetectionTripped() {
        if (this.tripped) {
            return;
        }
        this.tripped = true;
        this.inspectPage();
    }
    suppressDetection(reason) {
        if (this.suppressed) {
            return;
        }
        log_log(`PhishingPageManager: Detection suppressed because of ${reason}`);
        this.messageSender.sendMessage(message_types_MessageType.phishingDetectionSuppressedV22, new PhishingDetectionSuppressedV22());
        this.handleDetectionSuppressed();
    }
    handleDetectionSuppressed() {
        if (this.suppressed) {
            return;
        }
        this.suppressed = true;
        this.domMonitor.suspend();
        this.monitors.forEach(monitor => monitor.stop());
        this.resetPage();
    }
    resetPage() {
        this.interestingInputElements.forEach(e => this.elementalist.resetElement(e));
        this.collectors.forEach(collector => collector.reset());
        this.monitors.forEach(monitor => monitor.pause());
        this.detectors.forEach(detector => detector.reset());
    }
    extractPageFeatures() {
        let isInterestingPage = true;
        this._passwordElements = Array.from(document.querySelectorAll(this.PASSWORD_QUERY_STRING));
        if (this.config.onlyOnPageWithPasswordInput || this.config.onlyTriggerOnPasswordInput) {
            isInterestingPage = this._passwordElements.length > 0;
        }
        if (isInterestingPage) {
            const queryString = [this.PASSWORD_QUERY_STRING].concat(this.config.blockedElementTags).concat(this.config.blockedInputElementTypes.map(t => `${INPUT_TAG}[type=${t}]`)).join(',');
            this._interestingInputElements = Array.from(document.querySelectorAll(queryString));
        }
        else {
            this._interestingInputElements = [];
        }
    }
    runSuppressors() {
        for (const suppressor of this.suppressors) {
            if (suppressor.checkForSuppressionMarkers()) {
                return;
            }
        }
    }
    setupPageTools() {
        this.collectors.forEach(collector => collector.setup());
        this.monitors.forEach(monitor => monitor.start());
        this.detectors.forEach(detector => detector.setup());
    }
    runDetectors() {
        for (const detector of this.detectors) {
            if (detector.checkForDetectionTripped()) {
                return;
            }
        }
    }
    maybeDisableInput() {
        if (shouldDisableInput(this.pageCategory, this.config.operationMode, this.linkProtectionWouldBlock)) {
            this.interestingInputElements.forEach(e => this.elementalist.disableElement(e));
        }
    }
    runInspectionLoop() {
        this.resetPage();
        if (this.suppressed) {
            return;
        }
        this.extractPageFeatures();
        const hasInterestingInput = this.interestingInputElements.length > 0;
        this.messageSender.sendMessage(message_types_MessageType.onFrameDomUpdateV22, new OnFrameDomUpdateV22(hasInterestingInput, maybe_some(this.pageCategory)));
        if (hasInterestingInput) {
            if (!this.tripped) {
                this.runSuppressors();
            }
            if (!this.suppressed) {
                this.setupPageTools();
                if (this.tripped) {
                    this.maybeDisableInput();
                }
                else {
                    this.runDetectors();
                }
            }
        }
    }
    inspectPage() {
        this.domMonitor.suspend();
        this.runInspectionLoop();
        this.domMonitor.resume();
    }
}

;// CONCATENATED MODULE: ../lib/common/content-script-common.ts
var OverlayAction;
(function (OverlayAction) {
    OverlayAction[OverlayAction["OverlayNotShown"] = 0] = "OverlayNotShown";
    OverlayAction[OverlayAction["BackToSafety"] = 1] = "BackToSafety";
    OverlayAction[OverlayAction["CloseTab"] = 2] = "CloseTab";
    OverlayAction[OverlayAction["ViewWithInputDisabled"] = 3] = "ViewWithInputDisabled";
    OverlayAction[OverlayAction["EnableInput"] = 4] = "EnableInput";
})(OverlayAction || (OverlayAction = {}));

;// CONCATENATED MODULE: ../lib/common/common-types.ts
const TopLevelFrameId = 0;

;// CONCATENATED MODULE: ../lib/host/host-constants.ts
const hostConstants = {
    hostHelperId: "com.bromium.hosthelper",
    blockedPage: "blocked-page.html",
    externalAppLinkNavigator: "external-app-link-navigator-v1.html",
    externalAppLinkPage: "external-app-link-page-v1.html",
    blockedFilePage: "blocked-file-page.html",
    externalAppLinkPagePortName: "com.bromium.external.app.link.page",
    blockedPagePortName: "com.bromium.blocked.page",
    blockedFilePagePortName: "com.bromium.blocked.file.page",
    popupPortName: "com.bromium.popup",
    optionsPortName: "com.bromium.options",
    identityProtectionPortName: "com.bromium.identity.protection",
};

;// CONCATENATED MODULE: ../lib/common/range.ts

class Range {
    constructor(min, max) {
        this.min = min;
        this.max = max;
    }
    contains(value) {
        return number_utils_isInRange(value, this.min, this.max);
    }
}

;// CONCATENATED MODULE: ../lib/host/protocol-versions.ts




var ProtocolVersion;
(function (ProtocolVersion) {
    ProtocolVersion["v1"] = "tag:bromium.com,2018-02:protocols:google-chrome-extension:initial";
    ProtocolVersion["v2"] = "tag:bromium.com,2018-06:protocols:google-chrome-extension:v2";
    ProtocolVersion["v3"] = "tag:bromium.com,2018-07:protocols:google-chrome-extension:v3";
    ProtocolVersion["v4"] = "tag:bromium.com,2018-08:protocols:google-chrome-extension:v4";
    ProtocolVersion["v5"] = "tag:bromium.com,2018-11:protocols:google-chrome-extension:v5";
    ProtocolVersion["v6"] = "tag:bromium.com,2018-12:protocols:google-chrome-extension:v6";
    ProtocolVersion["v7"] = "tag:bromium.com,2019-01:protocols:google-chrome-extension:v7";
    ProtocolVersion["v8"] = "tag:bromium.com,2019-06:protocols:google-chrome-extension:v8";
    ProtocolVersion["v9"] = "tag:bromium.com,2019-07:protocols:google-chrome-extension:v9";
    ProtocolVersion["v10"] = "tag:bromium.com,2019-09:protocols:google-chrome-extension:v10";
    ProtocolVersion["v11"] = "tag:bromium.com,2019-10:protocols:google-chrome-extension:v11";
    ProtocolVersion["v12"] = "tag:bromium.com,2019-11:protocols:google-chrome-extension:v12";
    ProtocolVersion["v13"] = "tag:bromium.com,2019-12:protocols:google-chrome-extension:v13";
    ProtocolVersion["v14"] = "tag:bromium.com,2020-01:protocols:google-chrome-extension:v14";
    ProtocolVersion["v15"] = "tag:bromium.com,2020-02:protocols:google-chrome-extension:v15";
    ProtocolVersion["v16"] = "tag:bromium.com,2020-02:protocols:google-chrome-extension:v16";
    ProtocolVersion["v17"] = "tag:bromium.com,2020-04:protocols:google-chrome-extension:v17";
    ProtocolVersion["v18"] = "tag:bromium.com,2020-05:protocols:google-chrome-extension:v18";
    ProtocolVersion["v19"] = "tag:bromium.com,2020-05:protocols:google-chrome-extension:v19";
    ProtocolVersion["v20"] = "tag:SBX,2020-10:v20";
    ProtocolVersion["v21"] = "tag:SBX,2020-11:v21";
    ProtocolVersion["v22"] = "tag:SBX+IP,2020-11:v22";
    ProtocolVersion["v23"] = "tag:SBX+IP,2021-03:v23";
    ProtocolVersion["v24"] = "tag:SBX+IP,2021-07:v24";
    ProtocolVersion["v25"] = "tag:SBX+IP,2021-10:v25";
    ProtocolVersion["v26"] = "tag:SBX+IP+UF,2023-01:v26";
    ProtocolVersion["v27"] = "tag:SBX+IP+UF,2023-07:v27";
    ProtocolVersion["v28"] = "tag:SBX+IP+UF,2023-10:v28";
    ProtocolVersion["v29"] = "tag:SBX+IP+UF,2024-03:v29";
    ProtocolVersion["v30"] = "tag:SBX+IP+UF,2024-05:v30";
    ProtocolVersion["v31"] = "tag:SBX+IP+UF,2024-10:v31";
    ProtocolVersion["v32"] = "tag:SBX+IP+UF+AI,2024-11:v32";
    ProtocolVersion["v33"] = "tag:SBX+IP+UF+AI,2025-02:v33";
})(ProtocolVersion || (ProtocolVersion = {}));
const supportedProtocolVersions = [
    ProtocolVersion.v33,
    ProtocolVersion.v32,
    ProtocolVersion.v31,
    ProtocolVersion.v30,
    ProtocolVersion.v29,
    ProtocolVersion.v28,
    ProtocolVersion.v27,
    ProtocolVersion.v26,
    ProtocolVersion.v25,
    ProtocolVersion.v24,
    ProtocolVersion.v23,
    ProtocolVersion.v22,
    ProtocolVersion.v21,
    ProtocolVersion.v20,
    ProtocolVersion.v19,
    ProtocolVersion.v18,
    ProtocolVersion.v17,
    ProtocolVersion.v16,
    ProtocolVersion.v15,
    ProtocolVersion.v14,
    ProtocolVersion.v13,
    ProtocolVersion.v12,
    ProtocolVersion.v11,
    ProtocolVersion.v10,
    ProtocolVersion.v9,
    ProtocolVersion.v8,
    ProtocolVersion.v7,
    ProtocolVersion.v6,
    ProtocolVersion.v5,
    ProtocolVersion.v4,
    ProtocolVersion.v3,
    ProtocolVersion.v2,
    ProtocolVersion.v1
];
const supportedMessageTypes = (() => {
    const supportedMessageRanges = makeStringHashMap();
    supportedMessageRanges.putMany([
        [ProtocolVersion.v1, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.heartbeatV1)],
        [ProtocolVersion.v2, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.enabledFeaturesResponseV2)],
        [ProtocolVersion.v3, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.reputationChangedV3)],
        [ProtocolVersion.v4, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.blockedPageDataResponseV4)],
        [ProtocolVersion.v5, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.popupDataResponseV5)],
        [ProtocolVersion.v6, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.trustUrlV6)],
        [ProtocolVersion.v7, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.configChangedV7)],
        [ProtocolVersion.v8, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.configChangedV8)],
        [ProtocolVersion.v9, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.configChangedV9)],
        [ProtocolVersion.v10, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.heartbeatV10)],
        [ProtocolVersion.v11, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.configChangedV11)],
        [ProtocolVersion.v12, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.configChangedV12)],
        [ProtocolVersion.v13, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.configChangedV13)],
        [ProtocolVersion.v14, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.configChangedV14)],
        [ProtocolVersion.v15, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.configChangedV15)],
        [ProtocolVersion.v16, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.externalAppLinkRequestV16)],
        [ProtocolVersion.v17, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.configChangedV17)],
        [ProtocolVersion.v18, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.popupDataResponseV18)],
        [ProtocolVersion.v19, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.configChangedV19)],
        [ProtocolVersion.v20, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.configChangedV20)],
        [ProtocolVersion.v21, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.configChangedV21)],
        [ProtocolVersion.v22, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.configChangedV22)],
        [ProtocolVersion.v23, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.configChangedV23)],
        [ProtocolVersion.v24, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.configChangedV24)],
        [ProtocolVersion.v25, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.popupDataResponseV25)],
        [ProtocolVersion.v26, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.configChangedV26)],
        [ProtocolVersion.v27, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.makeUrlFilteringAlertV27)],
        [ProtocolVersion.v28, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.makeUrlFilteringAlertV28)],
        [ProtocolVersion.v29, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.showStatusMsgUrlFilteringOverlayV29)],
        [ProtocolVersion.v30, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.downloadCreatedV30)],
        [ProtocolVersion.v31, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.onLogoAnalysisCompleteV31)],
        [ProtocolVersion.v32, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.preparePhishingReportV32)],
        [ProtocolVersion.v33, new Range(message_types_MessageType.handshakeV1, message_types_MessageType.configChangedV33)],
    ]);
    return supportedMessageRanges;
})();
function isSupported(rangeMap, value, version) {
    if (maybe_none(version)) {
        return false;
    }
    const range = rangeMap.get(version);
    if (maybe_none(range)) {
        return false;
    }
    return range.contains(value);
}
function isMessageTypeSupported(messageType, protocolVersion) {
    return isSupported(supportedMessageTypes, messageType, protocolVersion);
}
function protocol_versions_shouldLogMessage(protocolVersion) {
    return !isMessageTypeSupported(message_types_MessageType.heartbeatV10, protocolVersion);
}
var HelpPageVersion;
(function (HelpPageVersion) {
    HelpPageVersion["v415"] = "v4.1.5";
    HelpPageVersion["v4181"] = "v4.1.8.1";
    HelpPageVersion["v430"] = "v4.3.0";
    HelpPageVersion["v435"] = "v4.3.5";
    HelpPageVersion["maxHelpPageVersion"] = "v4.3.5";
})(HelpPageVersion || (HelpPageVersion = {}));
;
const supportedHelpPageVersions = (() => {
    const supportedHelpPageVersions = makeStringHashMap();
    supportedHelpPageVersions.putMany([
        [ProtocolVersion.v1, HelpPageVersion.v415],
        [ProtocolVersion.v2, HelpPageVersion.v415],
        [ProtocolVersion.v3, HelpPageVersion.v415],
        [ProtocolVersion.v4, HelpPageVersion.v415],
        [ProtocolVersion.v5, HelpPageVersion.v415],
        [ProtocolVersion.v6, HelpPageVersion.v415],
        [ProtocolVersion.v7, HelpPageVersion.v415],
        [ProtocolVersion.v8, HelpPageVersion.v415],
        [ProtocolVersion.v9, HelpPageVersion.v415],
        [ProtocolVersion.v10, HelpPageVersion.v415],
        [ProtocolVersion.v11, HelpPageVersion.v4181],
        [ProtocolVersion.v12, HelpPageVersion.v4181],
        [ProtocolVersion.v13, HelpPageVersion.v4181],
        [ProtocolVersion.v14, HelpPageVersion.v4181],
        [ProtocolVersion.v15, HelpPageVersion.v4181],
        [ProtocolVersion.v16, HelpPageVersion.v4181],
        [ProtocolVersion.v17, HelpPageVersion.v4181],
        [ProtocolVersion.v18, HelpPageVersion.v4181],
        [ProtocolVersion.v19, HelpPageVersion.v4181],
        [ProtocolVersion.v20, HelpPageVersion.v4181],
        [ProtocolVersion.v21, HelpPageVersion.v4181],
        [ProtocolVersion.v22, HelpPageVersion.v430],
        [ProtocolVersion.v23, HelpPageVersion.v430],
        [ProtocolVersion.v24, HelpPageVersion.v435],
        [ProtocolVersion.v25, HelpPageVersion.v435],
        [ProtocolVersion.v26, HelpPageVersion.v435],
        [ProtocolVersion.v27, HelpPageVersion.v435],
        [ProtocolVersion.v28, HelpPageVersion.v435],
        [ProtocolVersion.v29, HelpPageVersion.v435],
        [ProtocolVersion.v30, HelpPageVersion.v435],
        [ProtocolVersion.v31, HelpPageVersion.v435],
        [ProtocolVersion.v33, HelpPageVersion.v435],
    ]);
    return supportedHelpPageVersions;
})();
function getHelpPageVersion(protocolVersion) {
    if (some(protocolVersion)) {
        const supportedVersion = supportedHelpPageVersions.get(protocolVersion);
        if (some(supportedVersion)) {
            return supportedVersion;
        }
    }
    return HelpPageVersion.maxHelpPageVersion;
}

;// CONCATENATED MODULE: ../lib/common/tab-utils.ts




function isValidWindowId(windowId) {
    return some(windowId) && windowId !== chrome.windows.WINDOW_ID_NONE;
}
function isValidTabId(tabId) {
    return tabId !== chrome.tabs.TAB_ID_NONE;
}
function hashTabId(tabId, seed = 0) {
    return murmurHash(tabId, seed);
}
function isSameTabId(a, b) {
    if (!isValidTabId(a) || !isValidTabId(b)) {
        return false;
    }
    return a === b;
}
const TabsAPIChromeNewTabSpec = "chrome://newtab";
const TabsAPIFirefoxNewTabSpecs = (/* unused pure expression or super */ null && (["about:newtab", "about:home"]));
const TabsAPIEdgeChromiumNewTabSpec = "edge://newtab";
function parseTabsAPIBrowserNewTabURLs() {
    const tabsAPIBrowserNewTabSpecs = [
        [Browser.chrome, [TabsAPIChromeNewTabSpec]],
        [Browser.firefox, TabsAPIFirefoxNewTabSpecs],
        [Browser.edgeChromium, [TabsAPIEdgeChromiumNewTabSpec]]
    ];
    const tabsAPIBrowserNewTabURLs = new Map();
    for (const [browser, specs] of tabsAPIBrowserNewTabSpecs) {
        const urls = specs.map(parseUrl).filter(some);
        if (urls.length > 0) {
            tabsAPIBrowserNewTabURLs.set(browser, urls);
        }
    }
    return tabsAPIBrowserNewTabURLs;
}

;// CONCATENATED MODULE: ../lib/common/port-utils.ts




function readPortTabId(port) {
    var _a, _b;
    const tabId = (_b = (_a = port === null || port === void 0 ? void 0 : port.sender) === null || _a === void 0 ? void 0 : _a.tab) === null || _b === void 0 ? void 0 : _b.id;
    if (maybe_none(tabId) || !isValidTabId(tabId)) {
        return undefined;
    }
    return tabId;
}
function readPortPageUrl(port) {
    var _a;
    const urlSpec = (_a = port === null || port === void 0 ? void 0 : port.sender) === null || _a === void 0 ? void 0 : _a.url;
    if (maybe_none(urlSpec)) {
        return;
    }
    return url_utils_parseUrl(urlSpec);
}
function readPortTabUrl(port) {
    var _a, _b;
    const urlSpec = (_b = (_a = port === null || port === void 0 ? void 0 : port.sender) === null || _a === void 0 ? void 0 : _a.tab) === null || _b === void 0 ? void 0 : _b.url;
    if (none(urlSpec)) {
        return undefined;
    }
    return parseUrl(urlSpec);
}
function readPortFrameId(port) {
    var _a;
    return (_a = port === null || port === void 0 ? void 0 : port.sender) === null || _a === void 0 ? void 0 : _a.frameId;
}
function portToString(port) {
    if (port === undefined) {
        return "undefined";
    }
    return string_utils_toString({
        name: port.name,
        tabId: readPortTabId(port),
        frameId: readPortFrameId(port),
        pageUrl: readPortPageUrl(port)
    });
}

;// CONCATENATED MODULE: ../lib/common/connection.ts
var ConnectionState;
(function (ConnectionState) {
    ConnectionState[ConnectionState["Connecting"] = 0] = "Connecting";
    ConnectionState[ConnectionState["Handshaking"] = 1] = "Handshaking";
    ConnectionState[ConnectionState["Connected"] = 2] = "Connected";
    ConnectionState[ConnectionState["Disconnecting"] = 3] = "Disconnecting";
    ConnectionState[ConnectionState["Disconnected"] = 4] = "Disconnected";
})(ConnectionState || (ConnectionState = {}));
class ConnectionStateChangedEvent {
    constructor(oldState, newState) {
        this.oldState = oldState;
        this.newState = newState;
    }
}

;// CONCATENATED MODULE: ../lib/common/errors.ts

var ChragError;
(function (ChragError) {
    ChragError[ChragError["notEnabled"] = 0] = "notEnabled";
    ChragError[ChragError["helperPortError"] = 1] = "helperPortError";
    ChragError[ChragError["launchBrowserFailed"] = 2] = "launchBrowserFailed";
    ChragError[ChragError["trustDownloadFailed"] = 3] = "trustDownloadFailed";
    ChragError[ChragError["handshakeError"] = 4] = "handshakeError";
    ChragError[ChragError["unknownError"] = 5] = "unknownError";
    ChragError[ChragError["recoveredFromError"] = 6] = "recoveredFromError";
    ChragError[ChragError["is32bitFirefox"] = 7] = "is32bitFirefox";
    ChragError[ChragError["helperUnresponsive"] = 8] = "helperUnresponsive";
})(ChragError || (ChragError = {}));
var ChragErrorLimits;
(function (ChragErrorLimits) {
    ChragErrorLimits[ChragErrorLimits["min"] = 0] = "min";
    ChragErrorLimits[ChragErrorLimits["max"] = 8] = "max";
})(ChragErrorLimits || (ChragErrorLimits = {}));
function isChragError(type) {
    return isInRange(type, ChragErrorLimits.min, ChragErrorLimits.max);
}
function errors_isError(value) {
    return value instanceof Error;
}

;// CONCATENATED MODULE: ../lib/common/message-encoder.ts
function encodeMessage(type, payload) {
    return { type: type, payload: payload };
}

;// CONCATENATED MODULE: ../lib/common/handshaker.ts
class HandshakenEvent {
    constructor(negotiatedVersion) {
        this.negotiatedVersion = negotiatedVersion;
    }
}

;// CONCATENATED MODULE: ../lib/common/message-decoder.ts


function decodeMessage(encodedMessage) {
    let message = encodedMessage;
    if (message.type === undefined) {
        message = JSON.parse(encodedMessage.toString());
        if (message.type === undefined) {
            return undefined;
        }
    }
    if (!number_utils_isNumber(message.type)) {
        return undefined;
    }
    if (!isMessageType(message.type)) {
        return undefined;
    }
    return message;
}
class MessageDecodedEvent {
    constructor(message) {
        this.message = message;
    }
}

;// CONCATENATED MODULE: ../lib/common/message-sender.ts

class MessageSender {
    constructor(doSendMessage) {
        this.doSendMessage = doSendMessage;
        this.sendMessage = (type, payload) => {
            const message = encodeMessage(type, payload);
            return this.doSendMessage(message);
        };
    }
}

;// CONCATENATED MODULE: ../lib/common/message-port-channel.ts














var Negotiation;
(function (Negotiation) {
    Negotiation[Negotiation["None"] = 0] = "None";
    Negotiation[Negotiation["NegotiateProtocolVersion"] = 1] = "NegotiateProtocolVersion";
})(Negotiation || (Negotiation = {}));
class MessagePortChannel {
    constructor(connectToPort, onConnect, onDisconnect, onPortError, onNegotiationError, messageRouter, negotiation) {
        this.connectToPort = connectToPort;
        this.onConnect = onConnect;
        this.onDisconnect = onDisconnect;
        this.onPortError = onPortError;
        this.onNegotiationError = onNegotiationError;
        this.messageRouter = messageRouter;
        this.negotiation = negotiation;
        this.onHandshaken = new EventDispatcher();
        this.onConnectionStateChanged = new EventDispatcher();
        this.messages = new Array();
        this._connState = ConnectionState.Disconnected;
        this._negotiatedVersion = undefined;
        this.messageSender = new MessageSender((message) => this.sendMessage(message));
    }
    disconnectPort(port) {
        port.disconnect();
        this.handleDisconnect(port);
    }
    connect() {
        if (this.connState !== ConnectionState.Disconnected) {
            throw new Error(`MessagePortChannel.connect called with connState == ${this.connState}`);
        }
        const shouldHandshake = this.negotiation === Negotiation.NegotiateProtocolVersion;
        this.connState = ConnectionState.Connecting;
        this.connectToPort.then((port) => {
            if (this.connState === ConnectionState.Disconnecting) {
                this.disconnectPort(port);
                return;
            }
            this.port = port;
            this.port.onMessage.addListener((encodeMessage, port) => this.onMessage(encodeMessage, port));
            this.port.onDisconnect.addListener((port) => this.handleDisconnect(port));
            if (shouldHandshake) {
                this.connState = ConnectionState.Handshaking;
                const handshake = new HandshakeV1(supportedProtocolVersions);
                const message = encodeMessage(message_types_MessageType.handshakeV1, handshake);
                this.postMessage(message);
            }
            else {
                this.sendQueuedMessages();
                this.connState = ConnectionState.Connected;
                this.onConnect(this.port);
            }
        });
        if (shouldHandshake) {
            setTimeout(() => {
                if (this.connState === ConnectionState.Handshaking) {
                    this.onNegotiationError(new Error("Handshake timed out after 60s"));
                }
            }, 60000);
        }
    }
    disconnect() {
        switch (this.connState) {
            case ConnectionState.Disconnected:
                break;
            case ConnectionState.Disconnecting:
                break;
            case ConnectionState.Connecting:
                this.connState = ConnectionState.Disconnecting;
                break;
            case ConnectionState.Handshaking:
                if (maybe_some(this.port)) {
                    this.disconnectPort(this.port);
                }
                break;
            case ConnectionState.Connected:
                if (maybe_some(this.port)) {
                    this.disconnectPort(this.port);
                }
                break;
        }
    }
    postMessage(message) {
        try {
            if (maybe_none(this.port)) {
                throw new Error("MessagePortChannel.postMessage: this.port === undefined");
            }
            if (!message_types_isFrequentlySentMessageType(message.type)) {
                this.log(`MessagePortChannel.postMessage: message: ${messages_messageToString(message)}`);
            }
            this.port.postMessage(message);
        }
        catch (e) {
            if (errors_isError(e)) {
                this.onPortError(e);
            }
            else {
                const error = new Error(`Unknown error caught in postMessage: ${string_utils_toString(e)}`);
                this.onPortError(error);
            }
        }
    }
    sendQueuedMessages() {
        for (const message of this.messages) {
            this.postMessage(message);
        }
        this.messages = [];
    }
    queueMessage(message) {
        this.messages.push(message);
    }
    sendMessage(message) {
        if (this.connState === ConnectionState.Connected) {
            this.postMessage(message);
        }
        else {
            this.queueMessage(message);
        }
    }
    onMessage(encodedMessage, port) {
        if (this.connState === ConnectionState.Handshaking) {
            this.log(`MessagePortChannel.onMessage: message: ${string_utils_toString(encodedMessage)} port: ${portToString(port)}`);
            let message = decodeMessage(encodedMessage);
            if (maybe_none(message)) {
                this.onNegotiationError(new Error(`Invalid message before handshaken: ${string_utils_toString(encodedMessage)}`));
            }
            else if (message.type !== message_types_MessageType.handshakeV1) {
                this.onNegotiationError(new Error(`Message before handshaken: ${message.type}`));
            }
            else if (maybe_none(this.port)) {
                this.onPortError(new Error("MessagePortChannel.onMessage: this.port === undefined"));
            }
            else {
                const handshake = message.payload;
                for (const supportedVersion of supportedProtocolVersions) {
                    if (handshake.versions.indexOf(supportedVersion) >= 0) {
                        this._negotiatedVersion = supportedVersion;
                        this.log(`Negotiated protocol version: ${this._negotiatedVersion}`);
                        this.sendQueuedMessages();
                        this.connState = ConnectionState.Connected;
                        this.onHandshaken.dispatchEvent(new HandshakenEvent(this._negotiatedVersion));
                        this.onConnect(this.port);
                        return;
                    }
                }
                this.onNegotiationError(new Error(`No supported version received in handshake: ${handshake.versions}`));
            }
        }
        else if (this.connState == ConnectionState.Connected) {
            this.messageRouter.onMessageReceived(port, encodedMessage);
        }
    }
    handleDisconnect(port) {
        if (this.connState === ConnectionState.Disconnected) {
            return;
        }
        this.connState = ConnectionState.Disconnected;
        this.port = undefined;
        this.onDisconnect(port);
    }
    shouldLogMessage() {
        if (this.negotiation === Negotiation.None) {
            return true;
        }
        return maybe_some(this.negotiatedVersion) && protocol_versions_shouldLogMessage(this.negotiatedVersion);
    }
    log(message) {
        if (this.shouldLogMessage()) {
            log_log(message);
        }
        else {
            console.log(message);
        }
    }
    logError(errorOrMessage) {
        log_logError(errorOrMessage);
    }
    get connState() {
        return this._connState;
    }
    set connState(newState) {
        const oldState = this._connState;
        this._connState = newState;
        this.onConnectionStateChanged.dispatchEvent(new ConnectionStateChangedEvent(oldState, newState));
    }
    get isHandshaken() {
        return this.connState === ConnectionState.Connected;
    }
    get negotiatedVersion() {
        return this._negotiatedVersion;
    }
    get connectionState() {
        return this.connState;
    }
}
class GenericMessagePortChannel extends MessagePortChannel {
    constructor(connectToPort, onConnect, onDisconnect, messageRouter, negotiation) {
        super(connectToPort, onConnect, onDisconnect, (e) => { console.error(e); }, (e) => { console.error(e); }, messageRouter, negotiation);
    }
}

;// CONCATENATED MODULE: ../lib/common/promise-utils.ts
function makePromise(factory) {
    return new Promise((resolve, reject) => {
        resolve(factory());
    });
}
function makePromiseAsync(factory) {
    return new Promise((resolve, reject) => {
        factory(resolve);
    });
}
const wrap = (func) => {
    return (...args) => {
        return new Promise(resolve => {
            func(...args, (result) => resolve(result));
        });
    };
};

;// CONCATENATED MODULE: ../lib/common/message-router.ts




function handleInvalidMessage(port, invalidMessage) {
    log_logError(`handleInvalidMessage: invalidMessage: ${string_utils_toString(invalidMessage)}`);
}
function onUnhandledMessage(port, message) {
    log_logError(`onUnhandledMessage: message: ${string_utils_toString(message)}`);
}
class MessageRouter {
    constructor(handleInvalidMessage, onUnhandledMessage) {
        this.handleInvalidMessage = handleInvalidMessage;
        this.onUnhandledMessage = onUnhandledMessage;
        this.messageHandlers = new Map();
    }
    registerMessagePayloadHandler(type, handlePayload) {
        this.registerMessageHandler(type, message => handlePayload(message.payload));
    }
    registerMessageHandler(type, handleMessage) {
        const messageHandlers = this.messageHandlers.get(type);
        if (messageHandlers === undefined) {
            this.messageHandlers.set(type, [handleMessage]);
        }
        else {
            messageHandlers.push(handleMessage);
        }
    }
    registerManyMessageHandler(types, handleMessage) {
        for (const type of types) {
            this.registerMessageHandler(type, handleMessage);
        }
    }
}
class GenericMessageRouter extends MessageRouter {
    constructor() {
        super(handleInvalidMessage, onUnhandledMessage);
        this.onMessageDecoded = new EventDispatcher();
    }
    onMessageReceived(port, encodedMessage) {
        let message = decodeMessage(encodedMessage);
        if (message === undefined) {
            this.handleInvalidMessage(port, encodedMessage);
            return;
        }
        this.onMessageDecoded.dispatchEvent(new MessageDecodedEvent(message));
        const messageHandlers = this.messageHandlers.get(message.type);
        if (messageHandlers === undefined) {
            this.onUnhandledMessage(port, message);
            return;
        }
        for (const handleMessage of messageHandlers) {
            handleMessage(message);
        }
    }
    tryRouteMessage(message) {
        const messageHandlers = this.messageHandlers.get(message.type);
        if (messageHandlers !== undefined) {
            for (const handleMessage of messageHandlers) {
                handleMessage(message);
            }
        }
    }
}

;// CONCATENATED MODULE: ../lib/common/logger.ts





class MessagingLogSink {
    constructor(sendMessage) {
        this.sendMessage = sendMessage;
        this.isSendingLogMessage = false;
    }
    log(message, level = LogLevel.Info) {
        if (this.isSendingLogMessage) {
            return;
        }
        this.isSendingLogMessage = true;
        try {
            this.sendMessage(message_types_MessageType.logMessageV1, { level, message });
        }
        catch (e) {
        }
        finally {
            this.isSendingLogMessage = false;
        }
    }
    logError(message) {
        this.log(message, LogLevel.Error);
    }
}
class HelperLogSink extends (/* unused pure expression or super */ null && (MessagingLogSink)) {
    constructor(sender) {
        super((type, payload) => sender.sendMessage(type, payload));
    }
}
class ScriptLogSink extends MessagingLogSink {
    constructor(extensionPortController) {
        super((type, payload) => extensionPortController.sendMessage(type, payload));
    }
}
class MessageLogger {
    constructor(messageDecoder, handshaker) {
        this.protocolVersion = undefined;
        handshaker.onHandshaken.registerEventHandler((event) => {
            this.protocolVersion = event.negotiatedVersion;
        });
        messageDecoder.onMessageDecoded.registerEventHandler((event) => {
            const message = event.message;
            if (!isFrequentlySentMessageType(message.type)) {
                this.log(`MessageLogger.onMessageReceived: message: ${messageToString(message)}`);
            }
        });
    }
    log(message) {
        if (some(this.protocolVersion) && shouldLogMessage(this.protocolVersion)) {
            log(message);
        }
        else {
            console.log(message);
        }
    }
}

;// CONCATENATED MODULE: ../lib/common/extension-port-controller.ts








var extension_port_controller_ConnectionState;
(function (ConnectionState) {
    ConnectionState[ConnectionState["disconnected"] = 0] = "disconnected";
    ConnectionState[ConnectionState["connecting"] = 1] = "connecting";
    ConnectionState[ConnectionState["connected"] = 2] = "connected";
    ConnectionState[ConnectionState["extensionReady"] = 3] = "extensionReady";
})(extension_port_controller_ConnectionState || (extension_port_controller_ConnectionState = {}));
class ExtensionPortController {
    constructor(portName, onExtensionReady, onExtensionDisconnected) {
        this.portName = portName;
        this.onExtensionReady = onExtensionReady;
        this.onExtensionDisconnected = onExtensionDisconnected;
        this.registerMessagePayloadHandler = (type, handler) => {
            this.messageRouter.registerMessagePayloadHandler(type, handler);
        };
        this.sendMessage = (type, payload) => this.extensionChannel.messageSender.sendMessage(type, payload);
        this.messageRouter = new GenericMessageRouter();
        this.connectionState = extension_port_controller_ConnectionState.disconnected;
        this.registerMessagePayloadHandler(message_types_MessageType.extensionReadyV1, (message) => this.handleExtensionReady(message));
        this.extensionChannel = this.createExtensionChannel();
        logger.addSink(new ScriptLogSink(this));
    }
    connect() {
        if (this.connectionState === extension_port_controller_ConnectionState.disconnected) {
            this.connectionState = extension_port_controller_ConnectionState.connecting;
            this.extensionChannel.connect();
        }
    }
    connectToPort() {
        return makePromise(() => {
            return chrome.runtime.connect({
                name: this.portName
            });
        });
    }
    createExtensionChannel() {
        return new GenericMessagePortChannel(this.connectToPort(), (port) => this.handleExtensionConnected(port), (port) => this.handleExtensionDisconnected(port), this.messageRouter, Negotiation.None);
    }
    reconnectToExtension() {
        this.log(`ExtensionPortController.reconnectToExtension: ${string_utils_toString({
            portName: this.portName,
            connectionState: this.connectionState
        })}`);
        this.connectionState = extension_port_controller_ConnectionState.connecting;
        this.extensionChannel = this.createExtensionChannel();
        this.extensionChannel.connect();
    }
    handleExtensionReady(payload) {
        var _a;
        this.log(`ExtensionPortController: extension ready: ${this.portName}`);
        this.connectionState = extension_port_controller_ConnectionState.extensionReady;
        (_a = this.onExtensionReady) === null || _a === void 0 ? void 0 : _a.call(this, payload.tabId);
    }
    handleExtensionConnected(port) {
        this.log(`ExtensionPortController: extension connected: ${this.portName}`);
        this.connectionState = extension_port_controller_ConnectionState.connected;
    }
    handleExtensionDisconnected(port) {
        var _a;
        this.log(`ExtensionPortController: extension disconnected: ${this.portName}`);
        if (this.connectionState !== extension_port_controller_ConnectionState.extensionReady) {
            this.reconnectToExtension();
        }
        else {
            (_a = this.onExtensionDisconnected) === null || _a === void 0 ? void 0 : _a.call(this);
        }
    }
    log(message) {
        if (this.portName === hostConstants.identityProtectionPortName) {
            return;
        }
        log_log(message);
    }
}

;// CONCATENATED MODULE: ./branding/hp_sure_click/assets/logo-hp-lod.svg
/* harmony default export */ const logo_hp_lod = ("<svg viewBox=\"0 0 7 7\" xmlns=\"http://www.w3.org/2000/svg\"><g fill=\"#FFF\" fill-rule=\"nonzero\"><path d=\"M5.457 2.478h-.522l-.718 2h.522z\"/><path d=\"M3.478 6.74h-.087l.674-1.827h.913c.152 0 .348-.13.392-.283l.717-1.978c.109-.326-.065-.587-.413-.587H4.39L3.326 5l-.609 1.652a3.264 3.264 0 0 1-2.5-3.174c0-1.5 1-2.76 2.392-3.13l-.63 1.695-1.044 2.87h.695L2.522 2.5h.521l-.89 2.413h.695l.826-2.26c.109-.327-.065-.588-.413-.588h-.587L3.326.217h.152A3.257 3.257 0 0 1 6.74 3.478 3.257 3.257 0 0 1 3.48 6.74z\"/></g></svg>\r\n");
;// CONCATENATED MODULE: ./branding/hp_sure_click/assets/logo-wolf-lod.svg
/* harmony default export */ const logo_wolf_lod = ("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 347.58 339.64\"><defs><style>.cls-1{fill:#fff;}.cls-2{fill:#d1d3d4;}</style></defs><g id=\"Layer_2\" data-name=\"Layer 2\"><g id=\"Layer_1-2\" data-name=\"Layer 1\"><path class=\"cls-1\" d=\"M183.51,147.49l60.14-35.68-.28-.53L232.78,45l-.12.1c-9.14,34.06-32.46,58.28-59.79,58.28h0V237.25l18.55-8.48h0l-7.85-81C183.5,147.6,183.49,147.49,183.51,147.49Z\"/><path class=\"cls-2\" d=\"M113.1,45.2l-.23-.2-10.59,66.28-.28.53,60.14,35.68s0,.11,0,.3l-7.85,81h0l18.54,8.48V103.38C145.54,103.35,122.26,79.19,113.1,45.2Z\"/><path class=\"cls-1\" d=\"M209.56,141.12l29.87-18.49,31.41,39h0c-12.56.34-34.06,7.24-47.94,21.38-16.22,16.55-24,40.68-24,40.68l-6.69-59.88c.57-.27,7-3.17,10.46-6.82C206.82,152.7,209.41,143.84,209.56,141.12Z\"/><path class=\"cls-2\" d=\"M136.09,141.12l-29.87-18.49-31.41,39h0c12.56.34,34.06,7.24,47.94,21.38,16.23,16.55,23.95,40.68,23.95,40.68l6.69-59.88c-.57-.27-7-3.17-10.45-6.82C138.84,152.7,136.25,143.84,136.09,141.12Z\"/><path class=\"cls-1\" d=\"M172.83,0C100.73,0,42.07,58.65,42.07,130.75S100.73,261.5,172.83,261.5s130.75-58.65,130.75-130.75S244.92,0,172.83,0Zm0,252.61A121.86,121.86,0,1,1,294.68,130.75,122,122,0,0,1,172.83,252.61Z\"/><path class=\"cls-1\" d=\"M19.74,308.23c.71,0,1.07.34,1.07,1V339.1H17.2a1.09,1.09,0,0,1-.78-.27.92.92,0,0,1-.29-.75V325.25H4.68V339.1H1.07c-.71,0-1.07-.34-1.07-1V308.23H3.61a1.15,1.15,0,0,1,.78.26,1,1,0,0,1,.29.76v12.07H16.13V308.23Z\"/><path class=\"cls-1\" d=\"M28.11,339.1c-.71,0-1.07-.34-1.07-1V308.76c1.31-.24,2.78-.44,4.42-.6s3.16-.25,4.58-.25c3.6,0,6.24.78,7.94,2.32s2.53,4.13,2.53,7.75a13.67,13.67,0,0,1-.69,4.68,8,8,0,0,1-1.93,3.12,7.56,7.56,0,0,1-3.06,1.76,13.48,13.48,0,0,1-4,.56,19.22,19.22,0,0,1-2.45-.16,26.8,26.8,0,0,1-2.72-.47V339.1Zm3.57-15.19c.77.15,1.54.27,2.32.38a17.92,17.92,0,0,0,2.31.15,9.38,9.38,0,0,0,2.5-.29,3.65,3.65,0,0,0,1.76-1,4.66,4.66,0,0,0,1-2,14.29,14.29,0,0,0,0-6.46,4.24,4.24,0,0,0-1.13-1.94,4.12,4.12,0,0,0-1.85-.94,11.66,11.66,0,0,0-2.48-.24c-.89,0-1.73,0-2.51.09s-1.44.13-1.94.22Z\"/><path class=\"cls-1\" d=\"M76.62,310.72a1.09,1.09,0,0,1,.78.29,1.43,1.43,0,0,1,.37.78l4.63,21.79q1.53-6.15,2.67-12.57c.76-4.27,1.3-8.54,1.63-12.78h3.48q1,0,.93,1.11c0,.42-.06.83-.11,1.25s-.1.9-.16,1.47c-.23,1.87-.54,3.93-.91,6.17s-.82,4.55-1.32,6.93-1.08,4.75-1.71,7.12-1.29,4.65-2,6.82H81a1.07,1.07,0,0,1-.8-.27,1.69,1.69,0,0,1-.4-.84l-4.59-21-4.84,22.1H66.53a1.33,1.33,0,0,1-.88-.22,2.21,2.21,0,0,1-.47-.76q-1-3.08-2-6.81c-.66-2.5-1.25-5.08-1.79-7.74s-1-5.3-1.4-7.93-.7-5.1-.91-7.41h3.79q.93,0,1,1.11.49,5.88,1.59,11.94T68,333.53l5-22.81Z\"/><path class=\"cls-1\" d=\"M117.13,323.69a33,33,0,0,1-.8,8.06,12.09,12.09,0,0,1-2.27,4.86,7.47,7.47,0,0,1-3.54,2.38,15.34,15.34,0,0,1-4.57.65,15,15,0,0,1-4.54-.65,7.46,7.46,0,0,1-3.52-2.38,12.22,12.22,0,0,1-2.28-4.86,41.05,41.05,0,0,1,0-16.13,12.11,12.11,0,0,1,2.28-4.85,7.48,7.48,0,0,1,3.52-2.39,15,15,0,0,1,4.54-.64,15.34,15.34,0,0,1,4.57.64,7.49,7.49,0,0,1,3.54,2.39,12,12,0,0,1,2.27,4.85A33.07,33.07,0,0,1,117.13,323.69Zm-17.55,0a45.61,45.61,0,0,0,.29,5.72,11,11,0,0,0,1,3.7,4.49,4.49,0,0,0,2,2,8.31,8.31,0,0,0,6.2,0,4.49,4.49,0,0,0,2-2,11.2,11.2,0,0,0,1-3.7,51.37,51.37,0,0,0,0-11.45,11.2,11.2,0,0,0-1-3.7,4.47,4.47,0,0,0-2-2,8.31,8.31,0,0,0-6.2,0,4.47,4.47,0,0,0-2,2,11,11,0,0,0-1,3.7A45.68,45.68,0,0,0,99.58,323.69Z\"/><path class=\"cls-1\" d=\"M123.82,339.1c-.72,0-1.07-.34-1.07-1V308.23h3.61a1.17,1.17,0,0,1,.78.26,1,1,0,0,1,.29.76v25.93h11c.71,0,1.07.34,1.07,1v2.89Z\"/><path class=\"cls-1\" d=\"M160.71,312.06H148.45v9.67h9.81a.9.9,0,0,1,1,1v2.85H148.45v13.5h-3.6c-.72,0-1.07-.34-1.07-1V308.23h15.9a.9.9,0,0,1,1,1Z\"/><path class=\"cls-1\" d=\"M173.36,316.29c0-2.82.8-5,2.41-6.37s4.08-2.14,7.44-2.14A27.75,27.75,0,0,1,187,308a15,15,0,0,1,2.9.6,1.51,1.51,0,0,1,.86.69,2.14,2.14,0,0,1,.16.87v2.05c-1.1-.15-2.23-.28-3.39-.38s-2.34-.16-3.56-.16a12.42,12.42,0,0,0-2.9.29,4.88,4.88,0,0,0-1.85.83,2.94,2.94,0,0,0-1,1.33,5.62,5.62,0,0,0-.28,1.87,5.4,5.4,0,0,0,.31,2,3.13,3.13,0,0,0,1,1.35,7.45,7.45,0,0,0,1.92,1.05c.79.31,1.76.68,2.92,1.09s2.26.89,3.23,1.34a9,9,0,0,1,2.49,1.67,6.67,6.67,0,0,1,1.61,2.45,10.42,10.42,0,0,1,.55,3.68c0,3.2-.86,5.5-2.58,6.88s-4.22,2.07-7.48,2.07a28.07,28.07,0,0,1-4.15-.29,16.14,16.14,0,0,1-3.12-.69,1.59,1.59,0,0,1-.8-.58,1.61,1.61,0,0,1-.22-.89v-2.23q1.56.22,3.45.45a34.26,34.26,0,0,0,4,.22,12.19,12.19,0,0,0,3.1-.33,4.74,4.74,0,0,0,1.91-.94,3,3,0,0,0,1-1.49,6.86,6.86,0,0,0,.27-2,6.15,6.15,0,0,0-.29-2.05,3,3,0,0,0-1-1.36,8.6,8.6,0,0,0-1.89-1.05q-1.18-.5-3-1.11a34.14,34.14,0,0,1-3.32-1.38,9.32,9.32,0,0,1-2.45-1.72,6.78,6.78,0,0,1-1.54-2.41A9.85,9.85,0,0,1,173.36,316.29Z\"/><path class=\"cls-1\" d=\"M213.68,308.23a.9.9,0,0,1,1,1v2.81H202v9.49h10.56a.9.9,0,0,1,1,1v2.85H202v9.85h12.21a1.09,1.09,0,0,1,.78.27,1,1,0,0,1,.29.76v2.8H198.36c-.72,0-1.07-.34-1.07-1V308.23Z\"/><path class=\"cls-1\" d=\"M230.39,307.78a21.34,21.34,0,0,1,3.23.25,10.76,10.76,0,0,1,2.61.64,1.42,1.42,0,0,1,.73.58,1.85,1.85,0,0,1,.2.94v2.09c-.86-.12-1.82-.23-2.87-.33a31.75,31.75,0,0,0-3.28-.16,9.09,9.09,0,0,0-3.38.56,4.64,4.64,0,0,0-2.23,1.89,9.28,9.28,0,0,0-1.2,3.59,36.62,36.62,0,0,0-.36,5.63,33.77,33.77,0,0,0,.45,6.11,9.94,9.94,0,0,0,1.31,3.67,4.49,4.49,0,0,0,2.21,1.81,9.32,9.32,0,0,0,3.16.49,21.75,21.75,0,0,0,3.25-.22,14.34,14.34,0,0,1,2.1-.23,1,1,0,0,1,1.11,1.07v2.18a20.06,20.06,0,0,1-3.1.87,19.86,19.86,0,0,1-4.16.38,12.94,12.94,0,0,1-5-.89,8,8,0,0,1-3.45-2.83,13,13,0,0,1-2-4.94,35.89,35.89,0,0,1-.63-7.24,36.43,36.43,0,0,1,.63-7.31,12.9,12.9,0,0,1,2-4.95,7.82,7.82,0,0,1,3.5-2.78A13.81,13.81,0,0,1,230.39,307.78Z\"/><path class=\"cls-1\" d=\"M262.2,328.19q0,5.88-2.38,8.64T252,339.59a16.07,16.07,0,0,1-4.43-.55,7.46,7.46,0,0,1-3.26-1.88,8.47,8.47,0,0,1-2-3.49,18.52,18.52,0,0,1-.69-5.48v-20h3.61c.71,0,1.07.34,1.07,1v19.43a15.85,15.85,0,0,0,.24,2.89,5.69,5.69,0,0,0,.87,2.21,3.89,3.89,0,0,0,1.71,1.38,7.33,7.33,0,0,0,2.83.47,7,7,0,0,0,2.77-.47,3.92,3.92,0,0,0,1.69-1.36,5.43,5.43,0,0,0,.87-2.18,16.53,16.53,0,0,0,.24-3v-20.4h3.61a1.13,1.13,0,0,1,.78.26,1,1,0,0,1,.29.76Z\"/><path class=\"cls-1\" d=\"M269.33,339.1c-.71,0-1.07-.34-1.07-1V308.76q2-.36,4.41-.6c1.64-.16,3.28-.25,4.95-.25,3.56,0,6.15.78,7.75,2.34s2.41,3.92,2.41,7.07a9,9,0,0,1-1.54,5.43,8.38,8.38,0,0,1-4.08,3,26.47,26.47,0,0,1,2.16,3c.73,1.15,1.41,2.34,2.05,3.56s1.22,2.42,1.74,3.61.93,2.24,1.23,3.16h-3.87a1.4,1.4,0,0,1-.91-.24,1.69,1.69,0,0,1-.47-.74,27.69,27.69,0,0,0-1.1-2.56c-.46-1-1-2-1.51-3s-1.16-2-1.81-3.07a27.3,27.3,0,0,0-2-2.78H272.9V339.1Zm3.57-16h4.9a8.77,8.77,0,0,0,2.16-.25,4,4,0,0,0,1.73-.87,4,4,0,0,0,1.14-1.76,8.62,8.62,0,0,0,.4-2.87,9.79,9.79,0,0,0-.35-2.85,4.22,4.22,0,0,0-1.05-1.78,3.68,3.68,0,0,0-1.76-.92,11.52,11.52,0,0,0-2.5-.24c-1,0-1.91,0-2.71.09s-1.46.13-2,.22Z\"/><path class=\"cls-1\" d=\"M294.59,339.1c-.71,0-1.07-.34-1.07-1V308.23h3.61c.71,0,1.07.34,1.07,1V339.1Z\"/><path class=\"cls-1\" d=\"M310.68,312.15h-7.09c-.71,0-1.07-.34-1.07-1v-2.89h20a1.13,1.13,0,0,1,.78.26,1,1,0,0,1,.29.76v2.9h-8.19v27h-3.61c-.72,0-1.07-.34-1.07-1Z\"/><path class=\"cls-1\" d=\"M335.8,339.1c-.71,0-1.06-.34-1.06-1v-10.7c-1-1.69-1.94-3.31-2.77-4.87s-1.59-3.12-2.27-4.68-1.31-3.13-1.89-4.7-1.11-3.21-1.58-4.9h4c.45,0,.73.09.87.29a3.25,3.25,0,0,1,.38.91c.26.95.59,2,1,3.07s.81,2.25,1.27,3.46,1,2.43,1.53,3.69,1.19,2.52,1.88,3.77q1-1.92,2-4.08t1.74-4.23c.52-1.38,1-2.67,1.36-3.88a26.67,26.67,0,0,0,.8-3h3.47a1,1,0,0,1,.89.42,1.15,1.15,0,0,1,.05,1.05q-.81,2.54-1.65,4.76c-.57,1.49-1.17,2.94-1.83,4.35s-1.36,2.81-2.11,4.21-1.59,2.85-2.48,4.36V339.1Z\"/></g></g></svg>");
;// CONCATENATED MODULE: ./branding/hp_sure_click/assets/ai.svg
/* harmony default export */ const ai = ("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\n<!-- Created with Inkscape (http://www.inkscape.org/) -->\n\n<svg\n   width=\"48\"\n   height=\"48\"\n   viewBox=\"0 0 12.7 12.7\"\n   version=\"1.1\"\n   id=\"svg1\"\n   xml:space=\"preserve\"\n   inkscape:version=\"1.3.2 (091e20e, 2023-11-25, custom)\"\n   sodipodi:docname=\"ai.svg\"\n   xmlns:inkscape=\"http://www.inkscape.org/namespaces/inkscape\"\n   xmlns:sodipodi=\"http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd\"\n   xmlns=\"http://www.w3.org/2000/svg\"\n   xmlns:svg=\"http://www.w3.org/2000/svg\"><sodipodi:namedview\n     id=\"namedview1\"\n     pagecolor=\"#ffffff\"\n     bordercolor=\"#000000\"\n     borderopacity=\"0.25\"\n     inkscape:showpageshadow=\"2\"\n     inkscape:pageopacity=\"0.0\"\n     inkscape:pagecheckerboard=\"0\"\n     inkscape:deskcolor=\"#d1d1d1\"\n     inkscape:document-units=\"mm\"\n     inkscape:zoom=\"16\"\n     inkscape:cx=\"41.5\"\n     inkscape:cy=\"9.03125\"\n     inkscape:window-width=\"2560\"\n     inkscape:window-height=\"1369\"\n     inkscape:window-x=\"-8\"\n     inkscape:window-y=\"-8\"\n     inkscape:window-maximized=\"1\"\n     inkscape:current-layer=\"layer1\" /><defs\n     id=\"defs1\" /><g\n     inkscape:label=\"Layer 1\"\n     inkscape:groupmode=\"layer\"\n     id=\"layer1\"><path\n       style=\"fill:#0296d5;stroke:none;stroke-width:0.183328\"\n       d=\"M 8.9094595,9.1865947 H 8.7801165 C 8.3300045,7.6120898 7.8896075,5.9422242 7.3290885,4.4007252 7.1071215,3.7902904 6.7686162,3.0839103 6.1284773,2.8235487 5.6870403,2.6440052 5.2254466,2.7469272 4.7703245,2.7780952 4.2863508,2.8112379 3.7386869,2.6903689 3.2830759,2.8973077 2.1441044,3.4146519 1.7685124,5.3806802 1.4961101,6.4702931 1.3689467,6.9789653 0.8348483,8.3047741 1.1503835,8.7779941 1.3552298,9.0852085 2.7541495,9.031017 2.9398445,8.7242982 3.1669445,8.3491885 3.1916204,7.7370072 3.2828267,7.3110533 3.4746691,6.4150836 3.6977497,5.5268902 3.994438,4.6594225 4.0899828,4.3800551 4.3611897,3.4773684 4.6981663,3.4165429 5.0877838,3.3462159 5.4141709,4.6504856 5.503298,4.9181185 5.967783,6.3129197 6.1195579,8.773849 7.3633205,9.723052 c 0.392181,0.299301 0.887433,0.2396307 1.352116,0.2396307 0.498686,0 1.098206,0.092709 1.5519265,-0.1563443 C 11.15742,9.3177638 11.806709,7.3142504 11.54053,6.3447364 11.431771,5.9486181 10.109095,5.9587888 9.8352015,6.1859446 9.5660995,6.40913 9.5954285,6.9921856 9.5400285,7.3110523 9.4221425,7.9895639 9.1713795,8.5574807 8.9094575,9.1865951 M 9.9538197,3.8094779 c -0.2626172,0.1259043 -0.3288392,0.9157424 -0.0999,1.0970615 0.2374013,0.1880245 1.2951073,0.1534116 1.5630543,0.028239 0.312325,-0.1458978 0.286029,-0.8732085 0.05141,-1.0771019 -0.242165,-0.2104302 -1.23359,-0.1829043 -1.5145631,-0.04821\"\n       id=\"path1\"\n       sodipodi:nodetypes=\"ccsssccsscsscsscsssccsccc\" /></g></svg>\n");
;// CONCATENATED MODULE: ./branding/hp_sure_click/assets/icon-warning-alt.svg
/* harmony default export */ const icon_warning_alt = ("<svg aria-label=\"Warning Alt\" fill=\"currentColor\" focusable=\"false\" role=\"img\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\" class=\"css-1xcgh5c\"><path d=\"M21.0170288,18.513916L12.8718262,4.0298462c-0.3823242-0.6797485-1.3610229-0.6797485-1.7433472,0\r\n\tL2.9833374,18.513916C2.6084595,19.180481,3.09021,20.0040894,3.8549805,20.0040894h16.2903442\r\n\tC20.9100952,20.0040894,21.3917847,19.180481,21.0170288,18.513916z M11.5001221,7.999939c0-0.276123,0.223877-0.5,0.5-0.5\r\n\tc0.2761841,0,0.5,0.223877,0.5,0.5v5.499939c0,0.2762451-0.2238159,0.5-0.5,0.5c-0.276123,0-0.5-0.2237549-0.5-0.5V7.999939z\r\n\t M12.0001221,17.5c-0.5523071,0-1-0.4476929-1-1s0.4476929-1,1-1s1,0.4476929,1,1S12.5524292,17.5,12.0001221,17.5z\"></path></svg>\r\n");
;// CONCATENATED MODULE: ./branding/hp_sure_click/assets/logo-credential-protection-lod.svg
/* harmony default export */ const logo_credential_protection_lod = ("<svg width=\"95\" height=\"106\" viewBox=\"0 0 95 106\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\r\n<g>\r\n<path d=\"M5.19995 17.3C2.99995 18.3 1.29995 20.4 0.999953 22.8C-0.200047 31.4 -2.00005 53.5 6.29995 73.6C6.69995 74.7 16.3 99.9 45.6 105.6C46.2 105.7 46.8 105.8 47.4 105.7C49 105.6 52.7 105 56 103.8C82.6 94.6 89.6 69.8 90.3 67C96.3 48.3 94.2 29.1 93.5 22.9C93.2 20.4 91.6 18.2 89.2 17.2L49.6 0.5C48.7 0.2 47.8 0 46.9 0C46 0 45 0.2 44.1 0.6L5.19995 17.3ZM48.1 4.2L87.9 20.9C88.9 21.3 89.6 22.3 89.7 23.3C90.3999 29.4 92.4 47.9 86.6 65.8V66C86.5 66.2 80.2 91.3 54.8 100.1C52.1 101 48.7 101.7 47.3 101.7C47.2 101.7 47.2 101.7 47.1 101.7C46.9 101.7 46.7 101.7 46.5 101.6C19.2 96.2 10.5 73.1 10.2 72.1V72C2.09995 52.9 3.89995 31.6 4.99995 23.3C5.09995 22.2 5.79995 21.4 6.79995 20.9L45.7 4.2C46.4 3.9 47.3 3.9 48.1 4.2Z\" fill=\"#fff\"/>\r\n<path d=\"M78.5 45.0001C78.5 44.9001 78.5 44.8001 78.5 44.7001C78.5 44.6001 78.5 44.6001 78.5 44.5001C78.5 44.1001 78.4 43.7001 78.2 43.4001C78.2 43.3001 78.1 43.3001 78.1 43.2001C78 43.1001 78 43.0001 77.9 43.0001C77.9 42.9001 77.8 42.9001 77.8 42.8001C77.7 42.7001 77.7 42.7001 77.6 42.6001C77.5 42.5001 77.5 42.5001 77.4 42.4001C77.3 42.3001 77.3 42.3001 77.2 42.2001C77.1 42.1001 77 42.1001 76.8 42.0001C76.7 42.0001 76.7 41.9001 76.6 41.9001C76.5 41.8001 76.3 41.8001 76.2 41.8001C76.2 41.8001 76.2 41.8001 76.1 41.8001H76C75.9 41.8001 75.9 41.8001 75.8 41.8001L66.3 40.7001L66.8 38.6001C70.9 37.9001 74.1 34.4001 74.1 30.2001C74.1 25.5001 70.2 21.6001 65.4 21.6001C60.6 21.6001 56.7 25.4001 56.7 30.2001C56.7 33.3001 58.4 36.0001 60.9 37.5001L60.3 40.1001L54.5 39.5001C52.9 39.3001 51.4 40.5001 51.2 42.1001C51 43.7001 52.2 45.2001 53.8 45.4001L65.6 46.7001L44.6 58.3001L32.7 43.4001L39 44.0001C41.2 50.6001 47.4 52.8001 47.6 52.9001C47.9 53.0001 48.3 53.1001 48.6 53.1001C49.8 53.1001 51 52.3001 51.4 51.1001C51.9 49.5001 51.1 47.8001 49.5 47.3001C49.5 47.3001 45.4 45.8001 44.4 41.4001C44.1 40.2001 44 39.1001 44.1 38.2001C45 38.8001 46.3 38.9001 47.3 38.3001C48.7 37.4001 49.2 35.6001 48.3 34.2001L46.2 30.7001C45.5 29.6001 44.2 29.0001 42.9 29.4001C41 29.9001 38.4 33.1001 38.1 37.9001L26.2 36.6001C26.1 36.6001 26.1 36.6001 26 36.6001C25.9 36.6001 25.9 36.6001 25.8 36.6001C25.7 36.6001 25.5 36.6001 25.4 36.6001H25.3C25.1 36.6001 25 36.7001 24.8 36.7001C24.8 36.7001 24.7 36.7001 24.7 36.8001C24.6 36.9001 24.5 36.9001 24.3 37.0001C24.3 37.0001 24.2 37.0001 24.2 37.1001C23.9 37.3001 23.6 37.6001 23.4 37.9001C23.3 38.0001 23.3 38.1001 23.2 38.1001C23.2 38.2001 23.1 38.3001 23.1 38.3001C23 38.5001 22.9 38.7001 22.9 39.0001L15.9 71.9001C15.7 72.7001 15.9 73.5001 16.3 74.2001C16.8 74.9001 17.5 75.3001 18.3 75.5001L66.7 84.0001C66.9 84.0001 67.1 84.0001 67.2 84.0001C68.6 84.0001 69.8 83.0001 70.1 81.7001L78.3 45.3001C78.3 45.2001 78.3 45.2001 78.3 45.1001C78.5 45.2001 78.5 45.1001 78.5 45.0001ZM65.4 27.6001C66.9 27.6001 68.1 28.8001 68.1 30.2001C68.1 31.6001 66.9 32.8001 65.4 32.8001C63.9 32.8001 62.7 31.6001 62.7 30.2001C62.7 28.8001 64 27.6001 65.4 27.6001ZM65.1 77.7001L22.6 70.2001L27.6 46.5001L41.4 64.0001C42 64.7001 42.9 65.1001 43.8 65.1001C44.3 65.1001 44.8 65.0001 45.2 64.7001L71.1 50.5001L65.1 77.7001Z\" fill=\"#fff\"/>\r\n</g>\r\n</svg>\r\n");
;// CONCATENATED MODULE: ../node_modules/preact/dist/preact.module.js
var n,l,u,i,t,o,r,f,e={},c=[],s=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i;function a(n,l){for(var u in l)n[u]=l[u];return n}function h(n){var l=n.parentNode;l&&l.removeChild(n)}function v(l,u,i){var t,o,r,f={};for(r in u)"key"==r?t=u[r]:"ref"==r?o=u[r]:f[r]=u[r];if(arguments.length>2&&(f.children=arguments.length>3?n.call(arguments,2):i),"function"==typeof l&&null!=l.defaultProps)for(r in l.defaultProps)void 0===f[r]&&(f[r]=l.defaultProps[r]);return y(l,f,t,o,null)}function y(n,i,t,o,r){var f={type:n,props:i,key:t,ref:o,__k:null,__:null,__b:0,__e:null,__d:void 0,__c:null,__h:null,constructor:void 0,__v:null==r?++u:r};return null==r&&null!=l.vnode&&l.vnode(f),f}function p(){return{current:null}}function d(n){return n.children}function _(n,l){this.props=n,this.context=l}function k(n,l){if(null==l)return n.__?k(n.__,n.__.__k.indexOf(n)+1):null;for(var u;l<n.__k.length;l++)if(null!=(u=n.__k[l])&&null!=u.__e)return u.__e;return"function"==typeof n.type?k(n):null}function b(n){var l,u;if(null!=(n=n.__)&&null!=n.__c){for(n.__e=n.__c.base=null,l=0;l<n.__k.length;l++)if(null!=(u=n.__k[l])&&null!=u.__e){n.__e=n.__c.base=u.__e;break}return b(n)}}function m(n){(!n.__d&&(n.__d=!0)&&t.push(n)&&!g.__r++||r!==l.debounceRendering)&&((r=l.debounceRendering)||o)(g)}function g(){for(var n;g.__r=t.length;)n=t.sort(function(n,l){return n.__v.__b-l.__v.__b}),t=[],n.some(function(n){var l,u,i,t,o,r;n.__d&&(o=(t=(l=n).__v).__e,(r=l.__P)&&(u=[],(i=a({},t)).__v=t.__v+1,j(r,t,i,l.__n,void 0!==r.ownerSVGElement,null!=t.__h?[o]:null,u,null==o?k(t):o,t.__h),z(u,t),t.__e!=o&&b(t)))})}function w(n,l,u,i,t,o,r,f,s,a){var h,v,p,_,b,m,g,w=i&&i.__k||c,A=w.length;for(u.__k=[],h=0;h<l.length;h++)if(null!=(_=u.__k[h]=null==(_=l[h])||"boolean"==typeof _?null:"string"==typeof _||"number"==typeof _||"bigint"==typeof _?y(null,_,null,null,_):Array.isArray(_)?y(d,{children:_},null,null,null):_.__b>0?y(_.type,_.props,_.key,null,_.__v):_)){if(_.__=u,_.__b=u.__b+1,null===(p=w[h])||p&&_.key==p.key&&_.type===p.type)w[h]=void 0;else for(v=0;v<A;v++){if((p=w[v])&&_.key==p.key&&_.type===p.type){w[v]=void 0;break}p=null}j(n,_,p=p||e,t,o,r,f,s,a),b=_.__e,(v=_.ref)&&p.ref!=v&&(g||(g=[]),p.ref&&g.push(p.ref,null,_),g.push(v,_.__c||b,_)),null!=b?(null==m&&(m=b),"function"==typeof _.type&&_.__k===p.__k?_.__d=s=x(_,s,n):s=P(n,_,p,w,b,s),"function"==typeof u.type&&(u.__d=s)):s&&p.__e==s&&s.parentNode!=n&&(s=k(p))}for(u.__e=m,h=A;h--;)null!=w[h]&&("function"==typeof u.type&&null!=w[h].__e&&w[h].__e==u.__d&&(u.__d=k(i,h+1)),N(w[h],w[h]));if(g)for(h=0;h<g.length;h++)M(g[h],g[++h],g[++h])}function x(n,l,u){for(var i,t=n.__k,o=0;t&&o<t.length;o++)(i=t[o])&&(i.__=n,l="function"==typeof i.type?x(i,l,u):P(u,i,i,t,i.__e,l));return l}function A(n,l){return l=l||[],null==n||"boolean"==typeof n||(Array.isArray(n)?n.some(function(n){A(n,l)}):l.push(n)),l}function P(n,l,u,i,t,o){var r,f,e;if(void 0!==l.__d)r=l.__d,l.__d=void 0;else if(null==u||t!=o||null==t.parentNode)n:if(null==o||o.parentNode!==n)n.appendChild(t),r=null;else{for(f=o,e=0;(f=f.nextSibling)&&e<i.length;e+=2)if(f==t)break n;n.insertBefore(t,o),r=o}return void 0!==r?r:t.nextSibling}function C(n,l,u,i,t){var o;for(o in u)"children"===o||"key"===o||o in l||H(n,o,null,u[o],i);for(o in l)t&&"function"!=typeof l[o]||"children"===o||"key"===o||"value"===o||"checked"===o||u[o]===l[o]||H(n,o,l[o],u[o],i)}function $(n,l,u){"-"===l[0]?n.setProperty(l,u):n[l]=null==u?"":"number"!=typeof u||s.test(l)?u:u+"px"}function H(n,l,u,i,t){var o;n:if("style"===l)if("string"==typeof u)n.style.cssText=u;else{if("string"==typeof i&&(n.style.cssText=i=""),i)for(l in i)u&&l in u||$(n.style,l,"");if(u)for(l in u)i&&u[l]===i[l]||$(n.style,l,u[l])}else if("o"===l[0]&&"n"===l[1])o=l!==(l=l.replace(/Capture$/,"")),l=l.toLowerCase()in n?l.toLowerCase().slice(2):l.slice(2),n.l||(n.l={}),n.l[l+o]=u,u?i||n.addEventListener(l,o?T:I,o):n.removeEventListener(l,o?T:I,o);else if("dangerouslySetInnerHTML"!==l){if(t)l=l.replace(/xlink(H|:h)/,"h").replace(/sName$/,"s");else if("href"!==l&&"list"!==l&&"form"!==l&&"tabIndex"!==l&&"download"!==l&&l in n)try{n[l]=null==u?"":u;break n}catch(n){}"function"==typeof u||(null!=u&&(!1!==u||"a"===l[0]&&"r"===l[1])?n.setAttribute(l,u):n.removeAttribute(l))}}function I(n){this.l[n.type+!1](l.event?l.event(n):n)}function T(n){this.l[n.type+!0](l.event?l.event(n):n)}function j(n,u,i,t,o,r,f,e,c){var s,h,v,y,p,k,b,m,g,x,A,P=u.type;if(void 0!==u.constructor)return null;null!=i.__h&&(c=i.__h,e=u.__e=i.__e,u.__h=null,r=[e]),(s=l.__b)&&s(u);try{n:if("function"==typeof P){if(m=u.props,g=(s=P.contextType)&&t[s.__c],x=s?g?g.props.value:s.__:t,i.__c?b=(h=u.__c=i.__c).__=h.__E:("prototype"in P&&P.prototype.render?u.__c=h=new P(m,x):(u.__c=h=new _(m,x),h.constructor=P,h.render=O),g&&g.sub(h),h.props=m,h.state||(h.state={}),h.context=x,h.__n=t,v=h.__d=!0,h.__h=[]),null==h.__s&&(h.__s=h.state),null!=P.getDerivedStateFromProps&&(h.__s==h.state&&(h.__s=a({},h.__s)),a(h.__s,P.getDerivedStateFromProps(m,h.__s))),y=h.props,p=h.state,v)null==P.getDerivedStateFromProps&&null!=h.componentWillMount&&h.componentWillMount(),null!=h.componentDidMount&&h.__h.push(h.componentDidMount);else{if(null==P.getDerivedStateFromProps&&m!==y&&null!=h.componentWillReceiveProps&&h.componentWillReceiveProps(m,x),!h.__e&&null!=h.shouldComponentUpdate&&!1===h.shouldComponentUpdate(m,h.__s,x)||u.__v===i.__v){h.props=m,h.state=h.__s,u.__v!==i.__v&&(h.__d=!1),h.__v=u,u.__e=i.__e,u.__k=i.__k,u.__k.forEach(function(n){n&&(n.__=u)}),h.__h.length&&f.push(h);break n}null!=h.componentWillUpdate&&h.componentWillUpdate(m,h.__s,x),null!=h.componentDidUpdate&&h.__h.push(function(){h.componentDidUpdate(y,p,k)})}h.context=x,h.props=m,h.state=h.__s,(s=l.__r)&&s(u),h.__d=!1,h.__v=u,h.__P=n,s=h.render(h.props,h.state,h.context),h.state=h.__s,null!=h.getChildContext&&(t=a(a({},t),h.getChildContext())),v||null==h.getSnapshotBeforeUpdate||(k=h.getSnapshotBeforeUpdate(y,p)),A=null!=s&&s.type===d&&null==s.key?s.props.children:s,w(n,Array.isArray(A)?A:[A],u,i,t,o,r,f,e,c),h.base=u.__e,u.__h=null,h.__h.length&&f.push(h),b&&(h.__E=h.__=null),h.__e=!1}else null==r&&u.__v===i.__v?(u.__k=i.__k,u.__e=i.__e):u.__e=L(i.__e,u,i,t,o,r,f,c);(s=l.diffed)&&s(u)}catch(n){u.__v=null,(c||null!=r)&&(u.__e=e,u.__h=!!c,r[r.indexOf(e)]=null),l.__e(n,u,i)}}function z(n,u){l.__c&&l.__c(u,n),n.some(function(u){try{n=u.__h,u.__h=[],n.some(function(n){n.call(u)})}catch(n){l.__e(n,u.__v)}})}function L(l,u,i,t,o,r,f,c){var s,a,v,y=i.props,p=u.props,d=u.type,_=0;if("svg"===d&&(o=!0),null!=r)for(;_<r.length;_++)if((s=r[_])&&"setAttribute"in s==!!d&&(d?s.localName===d:3===s.nodeType)){l=s,r[_]=null;break}if(null==l){if(null===d)return document.createTextNode(p);l=o?document.createElementNS("http://www.w3.org/2000/svg",d):document.createElement(d,p.is&&p),r=null,c=!1}if(null===d)y===p||c&&l.data===p||(l.data=p);else{if(r=r&&n.call(l.childNodes),a=(y=i.props||e).dangerouslySetInnerHTML,v=p.dangerouslySetInnerHTML,!c){if(null!=r)for(y={},_=0;_<l.attributes.length;_++)y[l.attributes[_].name]=l.attributes[_].value;(v||a)&&(v&&(a&&v.__html==a.__html||v.__html===l.innerHTML)||(l.innerHTML=v&&v.__html||""))}if(C(l,p,y,o,c),v)u.__k=[];else if(_=u.props.children,w(l,Array.isArray(_)?_:[_],u,i,t,o&&"foreignObject"!==d,r,f,r?r[0]:i.__k&&k(i,0),c),null!=r)for(_=r.length;_--;)null!=r[_]&&h(r[_]);c||("value"in p&&void 0!==(_=p.value)&&(_!==l.value||"progress"===d&&!_||"option"===d&&_!==y.value)&&H(l,"value",_,y.value,!1),"checked"in p&&void 0!==(_=p.checked)&&_!==l.checked&&H(l,"checked",_,y.checked,!1))}return l}function M(n,u,i){try{"function"==typeof n?n(u):n.current=u}catch(n){l.__e(n,i)}}function N(n,u,i){var t,o;if(l.unmount&&l.unmount(n),(t=n.ref)&&(t.current&&t.current!==n.__e||M(t,null,u)),null!=(t=n.__c)){if(t.componentWillUnmount)try{t.componentWillUnmount()}catch(n){l.__e(n,u)}t.base=t.__P=null}if(t=n.__k)for(o=0;o<t.length;o++)t[o]&&N(t[o],u,"function"!=typeof n.type);i||null==n.__e||h(n.__e),n.__e=n.__d=void 0}function O(n,l,u){return this.constructor(n,u)}function S(u,i,t){var o,r,f;l.__&&l.__(u,i),r=(o="function"==typeof t)?null:t&&t.__k||i.__k,f=[],j(i,u=(!o&&t||i).__k=v(d,null,[u]),r||e,e,void 0!==i.ownerSVGElement,!o&&t?[t]:r?null:i.firstChild?n.call(i.childNodes):null,f,!o&&t?t:r?r.__e:i.firstChild,o),z(f,u)}function q(n,l){S(n,l,q)}function B(l,u,i){var t,o,r,f=a({},l.props);for(r in u)"key"==r?t=u[r]:"ref"==r?o=u[r]:f[r]=u[r];return arguments.length>2&&(f.children=arguments.length>3?n.call(arguments,2):i),y(l.type,f,t||l.key,o||l.ref,null)}function D(n,l){var u={__c:l="__cC"+f++,__:n,Consumer:function(n,l){return n.children(l)},Provider:function(n){var u,i;return this.getChildContext||(u=[],(i={})[l]=this,this.getChildContext=function(){return i},this.shouldComponentUpdate=function(n){this.props.value!==n.value&&u.some(m)},this.sub=function(n){u.push(n);var l=n.componentWillUnmount;n.componentWillUnmount=function(){u.splice(u.indexOf(n),1),l&&l.call(n)}}),n.children}};return u.Provider.__=u.Consumer.contextType=u}n=c.slice,l={__e:function(n,l,u,i){for(var t,o,r;l=l.__;)if((t=l.__c)&&!t.__)try{if((o=t.constructor)&&null!=o.getDerivedStateFromError&&(t.setState(o.getDerivedStateFromError(n)),r=t.__d),null!=t.componentDidCatch&&(t.componentDidCatch(n,i||{}),r=t.__d),r)return t.__E=t}catch(l){n=l}throw n}},u=0,i=function(n){return null!=n&&void 0===n.constructor},_.prototype.setState=function(n,l){var u;u=null!=this.__s&&this.__s!==this.state?this.__s:this.__s=a({},this.state),"function"==typeof n&&(n=n(a({},u),this.props)),n&&a(u,n),null!=n&&this.__v&&(l&&this.__h.push(l),m(this))},_.prototype.forceUpdate=function(n){this.__v&&(this.__e=!0,n&&this.__h.push(n),m(this))},_.prototype.render=d,t=[],o="function"==typeof Promise?Promise.prototype.then.bind(Promise.resolve()):setTimeout,g.__r=0,f=0;
//# sourceMappingURL=preact.module.js.map

;// CONCATENATED MODULE: ../node_modules/preact/hooks/dist/hooks.module.js
var hooks_module_t,hooks_module_u,hooks_module_r,hooks_module_o=0,hooks_module_i=[],hooks_module_c=l.__b,hooks_module_f=l.__r,hooks_module_e=l.diffed,hooks_module_a=l.__c,hooks_module_v=l.unmount;function hooks_module_l(t,r){l.__h&&l.__h(hooks_module_u,t,hooks_module_o||r),hooks_module_o=0;var i=hooks_module_u.__H||(hooks_module_u.__H={__:[],__h:[]});return t>=i.__.length&&i.__.push({}),i.__[t]}function hooks_module_m(n){return hooks_module_o=1,hooks_module_p(hooks_module_w,n)}function hooks_module_p(n,r,o){var i=hooks_module_l(hooks_module_t++,2);return i.t=n,i.__c||(i.__=[o?o(r):hooks_module_w(void 0,r),function(n){var t=i.t(i.__[0],n);i.__[0]!==t&&(i.__=[t,i.__[1]],i.__c.setState({}))}],i.__c=hooks_module_u),i.__}function hooks_module_y(r,o){var i=hooks_module_l(hooks_module_t++,3);!l.__s&&hooks_module_k(i.__H,o)&&(i.__=r,i.__H=o,hooks_module_u.__H.__h.push(i))}function hooks_module_d(r,o){var i=hooks_module_l(hooks_module_t++,4);!l.__s&&hooks_module_k(i.__H,o)&&(i.__=r,i.__H=o,hooks_module_u.__h.push(i))}function hooks_module_h(n){return hooks_module_o=5,hooks_module_(function(){return{current:n}},[])}function hooks_module_s(n,t,u){hooks_module_o=6,hooks_module_d(function(){return"function"==typeof n?(n(t()),function(){return n(null)}):n?(n.current=t(),function(){return n.current=null}):void 0},null==u?u:u.concat(n))}function hooks_module_(n,u){var r=hooks_module_l(hooks_module_t++,7);return hooks_module_k(r.__H,u)&&(r.__=n(),r.__H=u,r.__h=n),r.__}function hooks_module_A(n,t){return hooks_module_o=8,hooks_module_(function(){return n},t)}function F(n){var r=hooks_module_u.context[n.__c],o=hooks_module_l(hooks_module_t++,9);return o.c=n,r?(null==o.__&&(o.__=!0,r.sub(hooks_module_u)),r.props.value):n.__}function hooks_module_T(t,u){l.useDebugValue&&l.useDebugValue(u?u(t):t)}function hooks_module_q(n){var r=hooks_module_l(hooks_module_t++,10),o=hooks_module_m();return r.__=n,hooks_module_u.componentDidCatch||(hooks_module_u.componentDidCatch=function(n){r.__&&r.__(n),o[1](n)}),[o[0],function(){o[1](void 0)}]}function hooks_module_x(){for(var t;t=hooks_module_i.shift();)if(t.__P)try{t.__H.__h.forEach(hooks_module_g),t.__H.__h.forEach(hooks_module_j),t.__H.__h=[]}catch(u){t.__H.__h=[],l.__e(u,t.__v)}}l.__b=function(n){hooks_module_u=null,hooks_module_c&&hooks_module_c(n)},l.__r=function(n){hooks_module_f&&hooks_module_f(n),hooks_module_t=0;var r=(hooks_module_u=n.__c).__H;r&&(r.__h.forEach(hooks_module_g),r.__h.forEach(hooks_module_j),r.__h=[])},l.diffed=function(t){hooks_module_e&&hooks_module_e(t);var o=t.__c;o&&o.__H&&o.__H.__h.length&&(1!==hooks_module_i.push(o)&&hooks_module_r===l.requestAnimationFrame||((hooks_module_r=l.requestAnimationFrame)||function(n){var t,u=function(){clearTimeout(r),hooks_module_b&&cancelAnimationFrame(t),setTimeout(n)},r=setTimeout(u,100);hooks_module_b&&(t=requestAnimationFrame(u))})(hooks_module_x)),hooks_module_u=null},l.__c=function(t,u){u.some(function(t){try{t.__h.forEach(hooks_module_g),t.__h=t.__h.filter(function(n){return!n.__||hooks_module_j(n)})}catch(r){u.some(function(n){n.__h&&(n.__h=[])}),u=[],l.__e(r,t.__v)}}),hooks_module_a&&hooks_module_a(t,u)},l.unmount=function(t){hooks_module_v&&hooks_module_v(t);var u,r=t.__c;r&&r.__H&&(r.__H.__.forEach(function(n){try{hooks_module_g(n)}catch(n){u=n}}),u&&l.__e(u,r.__v))};var hooks_module_b="function"==typeof requestAnimationFrame;function hooks_module_g(n){var t=hooks_module_u,r=n.__c;"function"==typeof r&&(n.__c=void 0,r()),hooks_module_u=t}function hooks_module_j(n){var t=hooks_module_u;n.__c=n.__(),hooks_module_u=t}function hooks_module_k(n,t){return!n||n.length!==t.length||t.some(function(t,u){return t!==n[u]})}function hooks_module_w(n,t){return"function"==typeof t?t(n):t}
//# sourceMappingURL=hooks.module.js.map

;// CONCATENATED MODULE: ../node_modules/preact/compat/dist/compat.module.js
function compat_module_C(n,t){for(var e in t)n[e]=t[e];return n}function compat_module_S(n,t){for(var e in n)if("__source"!==e&&!(e in t))return!0;for(var r in t)if("__source"!==r&&n[r]!==t[r])return!0;return!1}function E(n){this.props=n}function compat_module_g(n,t){function e(n){var e=this.props.ref,r=e==n.ref;return!r&&e&&(e.call?e(null):e.current=null),t?!t(this.props,n)||!r:compat_module_S(this.props,n)}function r(t){return this.shouldComponentUpdate=e,v(n,t)}return r.displayName="Memo("+(n.displayName||n.name)+")",r.prototype.isReactComponent=!0,r.__f=!0,r}(E.prototype=new _).isPureReactComponent=!0,E.prototype.shouldComponentUpdate=function(n,t){return compat_module_S(this.props,n)||compat_module_S(this.state,t)};var compat_module_w=l.__b;l.__b=function(n){n.type&&n.type.__f&&n.ref&&(n.props.ref=n.ref,n.ref=null),compat_module_w&&compat_module_w(n)};var R="undefined"!=typeof Symbol&&Symbol.for&&Symbol.for("react.forward_ref")||3911;function compat_module_x(n){function t(t){var e=compat_module_C({},t);return delete e.ref,n(e,t.ref||null)}return t.$$typeof=R,t.render=t,t.prototype.isReactComponent=t.__f=!0,t.displayName="ForwardRef("+(n.displayName||n.name)+")",t}var compat_module_N=function(n,t){return null==n?null:A(A(n).map(t))},compat_module_k={map:compat_module_N,forEach:compat_module_N,count:function(n){return n?A(n).length:0},only:function(n){var t=A(n);if(1!==t.length)throw"Children.only";return t[0]},toArray:A},compat_module_A=l.__e;l.__e=function(n,t,e,r){if(n.then)for(var u,o=t;o=o.__;)if((u=o.__c)&&u.__c)return null==t.__e&&(t.__e=e.__e,t.__k=e.__k),u.__c(n,t);compat_module_A(n,t,e,r)};var compat_module_O=l.unmount;function compat_module_L(){this.__u=0,this.t=null,this.__b=null}function U(n){var t=n.__.__c;return t&&t.__e&&t.__e(n)}function compat_module_F(n){var t,e,r;function u(u){if(t||(t=n()).then(function(n){e=n.default||n},function(n){r=n}),r)throw r;if(!e)throw t;return v(e,u)}return u.displayName="Lazy",u.__f=!0,u}function compat_module_M(){this.u=null,this.o=null}l.unmount=function(n){var t=n.__c;t&&t.__R&&t.__R(),t&&!0===n.__h&&(n.type=null),compat_module_O&&compat_module_O(n)},(compat_module_L.prototype=new _).__c=function(n,t){var e=t.__c,r=this;null==r.t&&(r.t=[]),r.t.push(e);var u=U(r.__v),o=!1,i=function(){o||(o=!0,e.__R=null,u?u(l):l())};e.__R=i;var l=function(){if(!--r.__u){if(r.state.__e){var n=r.state.__e;r.__v.__k[0]=function n(t,e,r){return t&&(t.__v=null,t.__k=t.__k&&t.__k.map(function(t){return n(t,e,r)}),t.__c&&t.__c.__P===e&&(t.__e&&r.insertBefore(t.__e,t.__d),t.__c.__e=!0,t.__c.__P=r)),t}(n,n.__c.__P,n.__c.__O)}var t;for(r.setState({__e:r.__b=null});t=r.t.pop();)t.forceUpdate()}},f=!0===t.__h;r.__u++||f||r.setState({__e:r.__b=r.__v.__k[0]}),n.then(i,i)},compat_module_L.prototype.componentWillUnmount=function(){this.t=[]},compat_module_L.prototype.render=function(n,t){if(this.__b){if(this.__v.__k){var e=document.createElement("div"),r=this.__v.__k[0].__c;this.__v.__k[0]=function n(t,e,r){return t&&(t.__c&&t.__c.__H&&(t.__c.__H.__.forEach(function(n){"function"==typeof n.__c&&n.__c()}),t.__c.__H=null),null!=(t=compat_module_C({},t)).__c&&(t.__c.__P===r&&(t.__c.__P=e),t.__c=null),t.__k=t.__k&&t.__k.map(function(t){return n(t,e,r)})),t}(this.__b,e,r.__O=r.__P)}this.__b=null}var u=t.__e&&v(d,null,n.fallback);return u&&(u.__h=null),[v(d,null,t.__e?null:n.children),u]};var compat_module_T=function(n,t,e){if(++e[1]===e[0]&&n.o.delete(t),n.props.revealOrder&&("t"!==n.props.revealOrder[0]||!n.o.size))for(e=n.u;e;){for(;e.length>3;)e.pop()();if(e[1]<e[0])break;n.u=e=e[2]}};function compat_module_D(n){return this.getChildContext=function(){return n.context},n.children}function compat_module_I(n){var t=this,e=n.i;t.componentWillUnmount=function(){S(null,t.l),t.l=null,t.i=null},t.i&&t.i!==e&&t.componentWillUnmount(),n.__v?(t.l||(t.i=e,t.l={nodeType:1,parentNode:e,childNodes:[],appendChild:function(n){this.childNodes.push(n),t.i.appendChild(n)},insertBefore:function(n,e){this.childNodes.push(n),t.i.appendChild(n)},removeChild:function(n){this.childNodes.splice(this.childNodes.indexOf(n)>>>1,1),t.i.removeChild(n)}}),S(v(compat_module_D,{context:t.context},n.__v),t.l)):t.l&&t.componentWillUnmount()}function W(n,t){var e=v(compat_module_I,{__v:n,i:t});return e.containerInfo=t,e}(compat_module_M.prototype=new _).__e=function(n){var t=this,e=U(t.__v),r=t.o.get(n);return r[0]++,function(u){var o=function(){t.props.revealOrder?(r.push(u),compat_module_T(t,n,r)):u()};e?e(o):o()}},compat_module_M.prototype.render=function(n){this.u=null,this.o=new Map;var t=A(n.children);n.revealOrder&&"b"===n.revealOrder[0]&&t.reverse();for(var e=t.length;e--;)this.o.set(t[e],this.u=[1,0,this.u]);return n.children},compat_module_M.prototype.componentDidUpdate=compat_module_M.prototype.componentDidMount=function(){var n=this;this.o.forEach(function(t,e){compat_module_T(n,e,t)})};var compat_module_P="undefined"!=typeof Symbol&&Symbol.for&&Symbol.for("react.element")||60103,V=/^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|marker(?!H|W|U)|overline|paint|stop|strikethrough|stroke|text(?!L)|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/,compat_module_j="undefined"!=typeof document,compat_module_z=function(n){return("undefined"!=typeof Symbol&&"symbol"==typeof Symbol()?/fil|che|rad/i:/fil|che|ra/i).test(n)};function compat_module_B(n,t,e){return null==t.__k&&(t.textContent=""),S(n,t),"function"==typeof e&&e(),n?n.__c:null}function compat_module_$(n,t,e){return q(n,t),"function"==typeof e&&e(),n?n.__c:null}_.prototype.isReactComponent={},["componentWillMount","componentWillReceiveProps","componentWillUpdate"].forEach(function(n){Object.defineProperty(_.prototype,n,{configurable:!0,get:function(){return this["UNSAFE_"+n]},set:function(t){Object.defineProperty(this,n,{configurable:!0,writable:!0,value:t})}})});var compat_module_H=l.event;function Z(){}function Y(){return this.cancelBubble}function compat_module_q(){return this.defaultPrevented}l.event=function(n){return compat_module_H&&(n=compat_module_H(n)),n.persist=Z,n.isPropagationStopped=Y,n.isDefaultPrevented=compat_module_q,n.nativeEvent=n};var G,J={configurable:!0,get:function(){return this.class}},K=l.vnode;l.vnode=function(n){var t=n.type,e=n.props,r=e;if("string"==typeof t){var u=-1===t.indexOf("-");for(var o in r={},e){var i=e[o];compat_module_j&&"children"===o&&"noscript"===t||"value"===o&&"defaultValue"in e&&null==i||("defaultValue"===o&&"value"in e&&null==e.value?o="value":"download"===o&&!0===i?i="":/ondoubleclick/i.test(o)?o="ondblclick":/^onchange(textarea|input)/i.test(o+t)&&!compat_module_z(e.type)?o="oninput":/^onfocus$/i.test(o)?o="onfocusin":/^onblur$/i.test(o)?o="onfocusout":/^on(Ani|Tra|Tou|BeforeInp|Compo)/.test(o)?o=o.toLowerCase():u&&V.test(o)?o=o.replace(/[A-Z0-9]/,"-$&").toLowerCase():null===i&&(i=void 0),r[o]=i)}"select"==t&&r.multiple&&Array.isArray(r.value)&&(r.value=A(e.children).forEach(function(n){n.props.selected=-1!=r.value.indexOf(n.props.value)})),"select"==t&&null!=r.defaultValue&&(r.value=A(e.children).forEach(function(n){n.props.selected=r.multiple?-1!=r.defaultValue.indexOf(n.props.value):r.defaultValue==n.props.value})),n.props=r,e.class!=e.className&&(J.enumerable="className"in e,null!=e.className&&(r.class=e.className),Object.defineProperty(r,"className",J))}n.$$typeof=compat_module_P,K&&K(n)};var Q=l.__r;l.__r=function(n){Q&&Q(n),G=n.__c};var X={ReactCurrentDispatcher:{current:{readContext:function(n){return G.__n[n.__c].props.value}}}},nn="17.0.2";function tn(n){return v.bind(null,n)}function en(n){return!!n&&n.$$typeof===compat_module_P}function rn(n){return en(n)?B.apply(null,arguments):n}function un(n){return!!n.__k&&(S(null,n),!0)}function on(n){return n&&(n.base||1===n.nodeType&&n)||null}var ln=function(n,t){return n(t)},fn=function(n,t){return n(t)},cn=d;/* harmony default export */ const compat_module = ({useState:hooks_module_m,useReducer:hooks_module_p,useEffect:hooks_module_y,useLayoutEffect:hooks_module_d,useRef:hooks_module_h,useImperativeHandle:hooks_module_s,useMemo:hooks_module_,useCallback:hooks_module_A,useContext:F,useDebugValue:hooks_module_T,version:"17.0.2",Children:compat_module_k,render:compat_module_B,hydrate:compat_module_$,unmountComponentAtNode:un,createPortal:W,createElement:v,createContext:D,createFactory:tn,cloneElement:rn,createRef:p,Fragment:d,isValidElement:en,findDOMNode:on,Component:_,PureComponent:E,memo:compat_module_g,forwardRef:compat_module_x,flushSync:fn,unstable_batchedUpdates:ln,StrictMode:d,Suspense:compat_module_L,SuspenseList:compat_module_M,lazy:compat_module_F,__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED:X});
//# sourceMappingURL=compat.module.js.map

;// CONCATENATED MODULE: ../lib/common/i18n.ts


var I18nMessages;
(function (I18nMessages) {
    I18nMessages["name"] = "extName";
    I18nMessages["blockedLinkPageTitle"] = "blockedLinkPageTitle";
    I18nMessages["blockedLinkPageOpenedSecureExplanation"] = "blockedLinkPageOpenedSecureExplanation";
    I18nMessages["blockedPDFPageTitle"] = "blockedPDFPageTitle";
    I18nMessages["blockedPDFPageOpenedSecureExplanation"] = "blockedPDFPageOpenedSecureExplanation";
    I18nMessages["blockedPageHelpLink"] = "blockedPageHelpLink";
    I18nMessages["blockedPageWarningTooltip"] = "blockedPageWarningTooltip";
    I18nMessages["blockedPageUntrustedTooltip"] = "blockedPageUntrustedTooltip";
    I18nMessages["blockedPageBrowserExplanation"] = "blockedPageSecureBrowserExplanation";
    I18nMessages["launchedLinkPageOpenedSecureExplanation"] = "launchedLinkPageOpenedSecureExplanation";
    I18nMessages["launchedPDFPageOpenedSecureExplanation"] = "launchedPDFPageOpenedSecureExplanation";
    I18nMessages["launchedPageGoBack"] = "launchedPageGoBack";
    I18nMessages["launchedPageCloseTab"] = "launchedPageCloseTab";
    I18nMessages["trustUrlButton"] = "blockedPageContinue";
    I18nMessages["untrustUrlButton"] = "blockedPageSecure";
    I18nMessages["rememberTrustDecisionText"] = "blockedPageRemember";
    I18nMessages["openLinkInSecureBrowser"] = "contextMenuOpenSecure";
    I18nMessages["popupNoError"] = "popupNoError";
    I18nMessages["popupGenericError"] = "popupGenericError";
    I18nMessages["popupMissingHelper"] = "popupMissingHelper";
    I18nMessages["popupSureClickInitRequired"] = "popupSureClickInitRequired";
    I18nMessages["popupDisabled"] = "popupDisabled";
    I18nMessages["popupSureClickUnlicensed"] = "popupSureClickUnlicensed";
    I18nMessages["popupSureClickUnconfigured"] = "popupSureClickUnconfigured";
    I18nMessages["popupSecureBrowserWindowButton"] = "popupSecureBrowserWindowButton";
    I18nMessages["popupClearRememberedDecisionsText"] = "popupClearRememberedDecisionsText";
    I18nMessages["popupClearRememberedDecisionsButton"] = "popupClearRememberedDecisionsButton";
    I18nMessages["helpLinkText"] = "popupHelpLinkText";
    I18nMessages["helpLinkLocale"] = "helpLinkLocale";
    I18nMessages["optionsNoOptions"] = "optionsPageNoOptions";
    I18nMessages["optionsLoggingToggle"] = "optionsPageLoggingToggle";
    I18nMessages["ipOverlayBlocked_Title"] = "overlayBlacklist_Title";
    I18nMessages["ipOverlayBlocked_Description"] = "overlayBlacklist_Description";
    I18nMessages["ipOverlayBrandLogo_Description"] = "overlayBlacklistBrand_Description";
    I18nMessages["ipOverlayBlockedDomainAge_Description"] = "overlayBlacklistDomainAge_Description";
    I18nMessages["ipOverlayBlockedFile_Description"] = "overlayBlockedFile_Description";
    I18nMessages["ipOverlayBlockedHttp_Title"] = "overlayHttpBlacklist_Title";
    I18nMessages["ipOverlayBlockedHttp_Description"] = "overlayHttpBlacklist_Description";
    I18nMessages["ipOverlayNormalUnknown_Title"] = "overlayNormalUnknown_Title";
    I18nMessages["ipOverlayNormalUnknown_Description"] = "overlayNormalUnknown_Description";
    I18nMessages["ipOverlayManagedUnknown_Title"] = "overlayManagedUnknown_Title";
    I18nMessages["ipOverlay_BackToSafetyButton"] = "overlay_BackToSafetyButton";
    I18nMessages["ipOverlay_ViewPageLinkButton"] = "overlay_ViewPageLinkButton";
    I18nMessages["ipOverlay_AllowInputButton"] = "overlay_AllowInputButton";
    I18nMessages["ipOverlay_BlameAdmin"] = "overlay_BlameAdmin";
    I18nMessages["ipOptionsAllowedDomainsSectionHeader"] = "optionsAllowedDomainsSectionHeader";
    I18nMessages["ipOptionsAllowedDomainsEmpty"] = "optionsAllowedDomainsEmpty";
    I18nMessages["ufOverlay_Title"] = "ufOverlayTitle";
    I18nMessages["ufStatusMsgOverlay_DescriptionNone"] = "ufStatusMsgOverlayDescriptionNone";
})(I18nMessages || (I18nMessages = {}));
const I18nMessagesWithSub = {
    trustUrlButton: {
        key: "blockedPageContinueV2",
        placeholder: "{THIS_BROWSER}"
    },
    ufOverlay_DescriptionOne: {
        key: "ufOverlayDescriptionOne",
        placeholder: "{CATEGORY}"
    },
    ufOverlay_DescriptionMany: {
        key: "ufOverlayDescriptionMany",
        placeholder: "{LIST_OF_CATEGORIES}"
    },
    daufOverlay_DescriptionDomainAgeDays: {
        key: "daufOverlayDescriptionDomainAgeDays",
        placeholder: "{DOMAIN_AGE_DAYS}"
    },
    ufStatusMsgOverlay_DescriptionOne: {
        key: "ufStatusMsgOverlayDescriptionOne",
        placeholder: "{STATUSMSG}"
    },
    ufStatusMsgOverlay_DescriptionMany: {
        key: "ufStatusMsgOverlayDescriptionMany",
        placeholder: "{LIST_OF_STATUSMSG}"
    },
    ipOverlayProtectedBrandLogo_Description: {
        key: "overlayBlacklistProtectedBrand_Description",
        placeholder: "{BRAND}"
    }
};
function getI18n(i18nMessage, substitution) {
    let key, placeholder;
    if (isString(i18nMessage)) {
        key = i18nMessage;
    }
    else {
        ({ key, placeholder } = i18nMessage);
    }
    let result = chrome.i18n.getMessage(key);
    if (maybe_some(placeholder) && maybe_some(substitution)) {
        result = result.replace(placeholder, substitution);
    }
    return result;
}

;// CONCATENATED MODULE: ../lib/common/alarms.ts


var alarms_AlarmName;
(function (AlarmName) {
    AlarmName["customerBecListFetch"] = "customerBecFetch";
    AlarmName["hpCloudListClearDeadEntries"] = "hpCloudCDE";
    AlarmName["urlFilteringClearDeadEntries"] = "urlFilteringCDE";
})(alarms_AlarmName || (alarms_AlarmName = {}));
class AlarmManager {
    constructor() {
        this.callbacks = new Map();
        chrome.alarms.clearAll();
        chrome.alarms.onAlarm.addListener(alarm => {
            const callback = this.callbacks.get(alarm.name);
            if (some(callback)) {
                callback();
            }
            else {
                logError(`onAlarm: no callback found for alarm with name "${alarm.name}"`);
            }
        });
    }
    registerPeriodicAlarm(name, periodInMinutes, callback) {
        this.callbacks.set(name, callback);
        chrome.alarms.create(name, { periodInMinutes });
    }
}

;// CONCATENATED MODULE: ./config-keys.ts
var config_keys_ConfigKey;
(function (ConfigKey) {
    ConfigKey[ConfigKey["config"] = 0] = "config";
    ConfigKey[ConfigKey["reputableSites"] = 1] = "reputableSites";
    ConfigKey[ConfigKey["sbxEnabledFeatures"] = 2] = "sbxEnabledFeatures";
})(config_keys_ConfigKey || (config_keys_ConfigKey = {}));

;// CONCATENATED MODULE: ../node_modules/lru-cache/dist/esm/index.js
/**
 * @module LRUCache
 */
const perf = typeof performance === 'object' &&
    performance &&
    typeof performance.now === 'function'
    ? performance
    : Date;
const warned = new Set();
/* c8 ignore start */
const PROCESS = (typeof process === 'object' && !!process ? process : {});
/* c8 ignore start */
const emitWarning = (msg, type, code, fn) => {
    typeof PROCESS.emitWarning === 'function'
        ? PROCESS.emitWarning(msg, type, code, fn)
        : console.error(`[${code}] ${type}: ${msg}`);
};
let AC = globalThis.AbortController;
let AS = globalThis.AbortSignal;
/* c8 ignore start */
if (typeof AC === 'undefined') {
    //@ts-ignore
    AS = class AbortSignal {
        onabort;
        _onabort = [];
        reason;
        aborted = false;
        addEventListener(_, fn) {
            this._onabort.push(fn);
        }
    };
    //@ts-ignore
    AC = class AbortController {
        constructor() {
            warnACPolyfill();
        }
        signal = new AS();
        abort(reason) {
            if (this.signal.aborted)
                return;
            //@ts-ignore
            this.signal.reason = reason;
            //@ts-ignore
            this.signal.aborted = true;
            //@ts-ignore
            for (const fn of this.signal._onabort) {
                fn(reason);
            }
            this.signal.onabort?.(reason);
        }
    };
    let printACPolyfillWarning = PROCESS.env?.LRU_CACHE_IGNORE_AC_WARNING !== '1';
    const warnACPolyfill = () => {
        if (!printACPolyfillWarning)
            return;
        printACPolyfillWarning = false;
        emitWarning('AbortController is not defined. If using lru-cache in ' +
            'node 14, load an AbortController polyfill from the ' +
            '`node-abort-controller` package. A minimal polyfill is ' +
            'provided for use by LRUCache.fetch(), but it should not be ' +
            'relied upon in other contexts (eg, passing it to other APIs that ' +
            'use AbortController/AbortSignal might have undesirable effects). ' +
            'You may disable this with LRU_CACHE_IGNORE_AC_WARNING=1 in the env.', 'NO_ABORT_CONTROLLER', 'ENOTSUP', warnACPolyfill);
    };
}
/* c8 ignore stop */
const shouldWarn = (code) => !warned.has(code);
const TYPE = Symbol('type');
const isPosInt = (n) => n && n === Math.floor(n) && n > 0 && isFinite(n);
/* c8 ignore start */
// This is a little bit ridiculous, tbh.
// The maximum array length is 2^32-1 or thereabouts on most JS impls.
// And well before that point, you're caching the entire world, I mean,
// that's ~32GB of just integers for the next/prev links, plus whatever
// else to hold that many keys and values.  Just filling the memory with
// zeroes at init time is brutal when you get that big.
// But why not be complete?
// Maybe in the future, these limits will have expanded.
const getUintArray = (max) => !isPosInt(max)
    ? null
    : max <= Math.pow(2, 8)
        ? Uint8Array
        : max <= Math.pow(2, 16)
            ? Uint16Array
            : max <= Math.pow(2, 32)
                ? Uint32Array
                : max <= Number.MAX_SAFE_INTEGER
                    ? ZeroArray
                    : null;
/* c8 ignore stop */
class ZeroArray extends Array {
    constructor(size) {
        super(size);
        this.fill(0);
    }
}
class Stack {
    heap;
    length;
    // private constructor
    static #constructing = (/* unused pure expression or super */ null && (false));
    static create(max) {
        const HeapCls = getUintArray(max);
        if (!HeapCls)
            return [];
        Stack.#constructing = true;
        const s = new Stack(max, HeapCls);
        Stack.#constructing = false;
        return s;
    }
    constructor(max, HeapCls) {
        /* c8 ignore start */
        if (!Stack.#constructing) {
            throw new TypeError('instantiate Stack using Stack.create(n)');
        }
        /* c8 ignore stop */
        this.heap = new HeapCls(max);
        this.length = 0;
    }
    push(n) {
        this.heap[this.length++] = n;
    }
    pop() {
        return this.heap[--this.length];
    }
}
/**
 * Default export, the thing you're using this module to get.
 *
 * All properties from the options object (with the exception of
 * {@link OptionsBase.max} and {@link OptionsBase.maxSize}) are added as
 * normal public members. (`max` and `maxBase` are read-only getters.)
 * Changing any of these will alter the defaults for subsequent method calls,
 * but is otherwise safe.
 */
class esm_LRUCache {
    // properties coming in from the options of these, only max and maxSize
    // really *need* to be protected. The rest can be modified, as they just
    // set defaults for various methods.
    #max;
    #maxSize;
    #dispose;
    #disposeAfter;
    #fetchMethod;
    /**
     * {@link LRUCache.OptionsBase.ttl}
     */
    ttl;
    /**
     * {@link LRUCache.OptionsBase.ttlResolution}
     */
    ttlResolution;
    /**
     * {@link LRUCache.OptionsBase.ttlAutopurge}
     */
    ttlAutopurge;
    /**
     * {@link LRUCache.OptionsBase.updateAgeOnGet}
     */
    updateAgeOnGet;
    /**
     * {@link LRUCache.OptionsBase.updateAgeOnHas}
     */
    updateAgeOnHas;
    /**
     * {@link LRUCache.OptionsBase.allowStale}
     */
    allowStale;
    /**
     * {@link LRUCache.OptionsBase.noDisposeOnSet}
     */
    noDisposeOnSet;
    /**
     * {@link LRUCache.OptionsBase.noUpdateTTL}
     */
    noUpdateTTL;
    /**
     * {@link LRUCache.OptionsBase.maxEntrySize}
     */
    maxEntrySize;
    /**
     * {@link LRUCache.OptionsBase.sizeCalculation}
     */
    sizeCalculation;
    /**
     * {@link LRUCache.OptionsBase.noDeleteOnFetchRejection}
     */
    noDeleteOnFetchRejection;
    /**
     * {@link LRUCache.OptionsBase.noDeleteOnStaleGet}
     */
    noDeleteOnStaleGet;
    /**
     * {@link LRUCache.OptionsBase.allowStaleOnFetchAbort}
     */
    allowStaleOnFetchAbort;
    /**
     * {@link LRUCache.OptionsBase.allowStaleOnFetchRejection}
     */
    allowStaleOnFetchRejection;
    /**
     * {@link LRUCache.OptionsBase.ignoreFetchAbort}
     */
    ignoreFetchAbort;
    // computed properties
    #size;
    #calculatedSize;
    #keyMap;
    #keyList;
    #valList;
    #next;
    #prev;
    #head;
    #tail;
    #free;
    #disposed;
    #sizes;
    #starts;
    #ttls;
    #hasDispose;
    #hasFetchMethod;
    #hasDisposeAfter;
    /**
     * Do not call this method unless you need to inspect the
     * inner workings of the cache.  If anything returned by this
     * object is modified in any way, strange breakage may occur.
     *
     * These fields are private for a reason!
     *
     * @internal
     */
    static unsafeExposeInternals(c) {
        return {
            // properties
            starts: c.#starts,
            ttls: c.#ttls,
            sizes: c.#sizes,
            keyMap: c.#keyMap,
            keyList: c.#keyList,
            valList: c.#valList,
            next: c.#next,
            prev: c.#prev,
            get head() {
                return c.#head;
            },
            get tail() {
                return c.#tail;
            },
            free: c.#free,
            // methods
            isBackgroundFetch: (p) => c.#isBackgroundFetch(p),
            backgroundFetch: (k, index, options, context) => c.#backgroundFetch(k, index, options, context),
            moveToTail: (index) => c.#moveToTail(index),
            indexes: (options) => c.#indexes(options),
            rindexes: (options) => c.#rindexes(options),
            isStale: (index) => c.#isStale(index),
        };
    }
    // Protected read-only members
    /**
     * {@link LRUCache.OptionsBase.max} (read-only)
     */
    get max() {
        return this.#max;
    }
    /**
     * {@link LRUCache.OptionsBase.maxSize} (read-only)
     */
    get maxSize() {
        return this.#maxSize;
    }
    /**
     * The total computed size of items in the cache (read-only)
     */
    get calculatedSize() {
        return this.#calculatedSize;
    }
    /**
     * The number of items stored in the cache (read-only)
     */
    get size() {
        return this.#size;
    }
    /**
     * {@link LRUCache.OptionsBase.fetchMethod} (read-only)
     */
    get fetchMethod() {
        return this.#fetchMethod;
    }
    /**
     * {@link LRUCache.OptionsBase.dispose} (read-only)
     */
    get dispose() {
        return this.#dispose;
    }
    /**
     * {@link LRUCache.OptionsBase.disposeAfter} (read-only)
     */
    get disposeAfter() {
        return this.#disposeAfter;
    }
    constructor(options) {
        const { max = 0, ttl, ttlResolution = 1, ttlAutopurge, updateAgeOnGet, updateAgeOnHas, allowStale, dispose, disposeAfter, noDisposeOnSet, noUpdateTTL, maxSize = 0, maxEntrySize = 0, sizeCalculation, fetchMethod, noDeleteOnFetchRejection, noDeleteOnStaleGet, allowStaleOnFetchRejection, allowStaleOnFetchAbort, ignoreFetchAbort, } = options;
        if (max !== 0 && !isPosInt(max)) {
            throw new TypeError('max option must be a nonnegative integer');
        }
        const UintArray = max ? getUintArray(max) : Array;
        if (!UintArray) {
            throw new Error('invalid max value: ' + max);
        }
        this.#max = max;
        this.#maxSize = maxSize;
        this.maxEntrySize = maxEntrySize || this.#maxSize;
        this.sizeCalculation = sizeCalculation;
        if (this.sizeCalculation) {
            if (!this.#maxSize && !this.maxEntrySize) {
                throw new TypeError('cannot set sizeCalculation without setting maxSize or maxEntrySize');
            }
            if (typeof this.sizeCalculation !== 'function') {
                throw new TypeError('sizeCalculation set to non-function');
            }
        }
        if (fetchMethod !== undefined &&
            typeof fetchMethod !== 'function') {
            throw new TypeError('fetchMethod must be a function if specified');
        }
        this.#fetchMethod = fetchMethod;
        this.#hasFetchMethod = !!fetchMethod;
        this.#keyMap = new Map();
        this.#keyList = new Array(max).fill(undefined);
        this.#valList = new Array(max).fill(undefined);
        this.#next = new UintArray(max);
        this.#prev = new UintArray(max);
        this.#head = 0;
        this.#tail = 0;
        this.#free = Stack.create(max);
        this.#size = 0;
        this.#calculatedSize = 0;
        if (typeof dispose === 'function') {
            this.#dispose = dispose;
        }
        if (typeof disposeAfter === 'function') {
            this.#disposeAfter = disposeAfter;
            this.#disposed = [];
        }
        else {
            this.#disposeAfter = undefined;
            this.#disposed = undefined;
        }
        this.#hasDispose = !!this.#dispose;
        this.#hasDisposeAfter = !!this.#disposeAfter;
        this.noDisposeOnSet = !!noDisposeOnSet;
        this.noUpdateTTL = !!noUpdateTTL;
        this.noDeleteOnFetchRejection = !!noDeleteOnFetchRejection;
        this.allowStaleOnFetchRejection = !!allowStaleOnFetchRejection;
        this.allowStaleOnFetchAbort = !!allowStaleOnFetchAbort;
        this.ignoreFetchAbort = !!ignoreFetchAbort;
        // NB: maxEntrySize is set to maxSize if it's set
        if (this.maxEntrySize !== 0) {
            if (this.#maxSize !== 0) {
                if (!isPosInt(this.#maxSize)) {
                    throw new TypeError('maxSize must be a positive integer if specified');
                }
            }
            if (!isPosInt(this.maxEntrySize)) {
                throw new TypeError('maxEntrySize must be a positive integer if specified');
            }
            this.#initializeSizeTracking();
        }
        this.allowStale = !!allowStale;
        this.noDeleteOnStaleGet = !!noDeleteOnStaleGet;
        this.updateAgeOnGet = !!updateAgeOnGet;
        this.updateAgeOnHas = !!updateAgeOnHas;
        this.ttlResolution =
            isPosInt(ttlResolution) || ttlResolution === 0
                ? ttlResolution
                : 1;
        this.ttlAutopurge = !!ttlAutopurge;
        this.ttl = ttl || 0;
        if (this.ttl) {
            if (!isPosInt(this.ttl)) {
                throw new TypeError('ttl must be a positive integer if specified');
            }
            this.#initializeTTLTracking();
        }
        // do not allow completely unbounded caches
        if (this.#max === 0 && this.ttl === 0 && this.#maxSize === 0) {
            throw new TypeError('At least one of max, maxSize, or ttl is required');
        }
        if (!this.ttlAutopurge && !this.#max && !this.#maxSize) {
            const code = 'LRU_CACHE_UNBOUNDED';
            if (shouldWarn(code)) {
                warned.add(code);
                const msg = 'TTL caching without ttlAutopurge, max, or maxSize can ' +
                    'result in unbounded memory consumption.';
                emitWarning(msg, 'UnboundedCacheWarning', code, esm_LRUCache);
            }
        }
    }
    /**
     * Return the remaining TTL time for a given entry key
     */
    getRemainingTTL(key) {
        return this.#keyMap.has(key) ? Infinity : 0;
    }
    #initializeTTLTracking() {
        const ttls = new ZeroArray(this.#max);
        const starts = new ZeroArray(this.#max);
        this.#ttls = ttls;
        this.#starts = starts;
        this.#setItemTTL = (index, ttl, start = perf.now()) => {
            starts[index] = ttl !== 0 ? start : 0;
            ttls[index] = ttl;
            if (ttl !== 0 && this.ttlAutopurge) {
                const t = setTimeout(() => {
                    if (this.#isStale(index)) {
                        this.delete(this.#keyList[index]);
                    }
                }, ttl + 1);
                // unref() not supported on all platforms
                /* c8 ignore start */
                if (t.unref) {
                    t.unref();
                }
                /* c8 ignore stop */
            }
        };
        this.#updateItemAge = index => {
            starts[index] = ttls[index] !== 0 ? perf.now() : 0;
        };
        this.#statusTTL = (status, index) => {
            if (ttls[index]) {
                const ttl = ttls[index];
                const start = starts[index];
                /* c8 ignore next */
                if (!ttl || !start)
                    return;
                status.ttl = ttl;
                status.start = start;
                status.now = cachedNow || getNow();
                const age = status.now - start;
                status.remainingTTL = ttl - age;
            }
        };
        // debounce calls to perf.now() to 1s so we're not hitting
        // that costly call repeatedly.
        let cachedNow = 0;
        const getNow = () => {
            const n = perf.now();
            if (this.ttlResolution > 0) {
                cachedNow = n;
                const t = setTimeout(() => (cachedNow = 0), this.ttlResolution);
                // not available on all platforms
                /* c8 ignore start */
                if (t.unref) {
                    t.unref();
                }
                /* c8 ignore stop */
            }
            return n;
        };
        this.getRemainingTTL = key => {
            const index = this.#keyMap.get(key);
            if (index === undefined) {
                return 0;
            }
            const ttl = ttls[index];
            const start = starts[index];
            if (!ttl || !start) {
                return Infinity;
            }
            const age = (cachedNow || getNow()) - start;
            return ttl - age;
        };
        this.#isStale = index => {
            const s = starts[index];
            const t = ttls[index];
            return !!t && !!s && (cachedNow || getNow()) - s > t;
        };
    }
    // conditionally set private methods related to TTL
    #updateItemAge = () => { };
    #statusTTL = () => { };
    #setItemTTL = () => { };
    /* c8 ignore stop */
    #isStale = () => false;
    #initializeSizeTracking() {
        const sizes = new ZeroArray(this.#max);
        this.#calculatedSize = 0;
        this.#sizes = sizes;
        this.#removeItemSize = index => {
            this.#calculatedSize -= sizes[index];
            sizes[index] = 0;
        };
        this.#requireSize = (k, v, size, sizeCalculation) => {
            // provisionally accept background fetches.
            // actual value size will be checked when they return.
            if (this.#isBackgroundFetch(v)) {
                return 0;
            }
            if (!isPosInt(size)) {
                if (sizeCalculation) {
                    if (typeof sizeCalculation !== 'function') {
                        throw new TypeError('sizeCalculation must be a function');
                    }
                    size = sizeCalculation(v, k);
                    if (!isPosInt(size)) {
                        throw new TypeError('sizeCalculation return invalid (expect positive integer)');
                    }
                }
                else {
                    throw new TypeError('invalid size value (must be positive integer). ' +
                        'When maxSize or maxEntrySize is used, sizeCalculation ' +
                        'or size must be set.');
                }
            }
            return size;
        };
        this.#addItemSize = (index, size, status) => {
            sizes[index] = size;
            if (this.#maxSize) {
                const maxSize = this.#maxSize - sizes[index];
                while (this.#calculatedSize > maxSize) {
                    this.#evict(true);
                }
            }
            this.#calculatedSize += sizes[index];
            if (status) {
                status.entrySize = size;
                status.totalCalculatedSize = this.#calculatedSize;
            }
        };
    }
    #removeItemSize = _i => { };
    #addItemSize = (_i, _s, _st) => { };
    #requireSize = (_k, _v, size, sizeCalculation) => {
        if (size || sizeCalculation) {
            throw new TypeError('cannot set size without setting maxSize or maxEntrySize on cache');
        }
        return 0;
    };
    *#indexes({ allowStale = this.allowStale } = {}) {
        if (this.#size) {
            for (let i = this.#tail; true;) {
                if (!this.#isValidIndex(i)) {
                    break;
                }
                if (allowStale || !this.#isStale(i)) {
                    yield i;
                }
                if (i === this.#head) {
                    break;
                }
                else {
                    i = this.#prev[i];
                }
            }
        }
    }
    *#rindexes({ allowStale = this.allowStale } = {}) {
        if (this.#size) {
            for (let i = this.#head; true;) {
                if (!this.#isValidIndex(i)) {
                    break;
                }
                if (allowStale || !this.#isStale(i)) {
                    yield i;
                }
                if (i === this.#tail) {
                    break;
                }
                else {
                    i = this.#next[i];
                }
            }
        }
    }
    #isValidIndex(index) {
        return (index !== undefined &&
            this.#keyMap.get(this.#keyList[index]) === index);
    }
    /**
     * Return a generator yielding `[key, value]` pairs,
     * in order from most recently used to least recently used.
     */
    *entries() {
        for (const i of this.#indexes()) {
            if (this.#valList[i] !== undefined &&
                this.#keyList[i] !== undefined &&
                !this.#isBackgroundFetch(this.#valList[i])) {
                yield [this.#keyList[i], this.#valList[i]];
            }
        }
    }
    /**
     * Inverse order version of {@link LRUCache.entries}
     *
     * Return a generator yielding `[key, value]` pairs,
     * in order from least recently used to most recently used.
     */
    *rentries() {
        for (const i of this.#rindexes()) {
            if (this.#valList[i] !== undefined &&
                this.#keyList[i] !== undefined &&
                !this.#isBackgroundFetch(this.#valList[i])) {
                yield [this.#keyList[i], this.#valList[i]];
            }
        }
    }
    /**
     * Return a generator yielding the keys in the cache,
     * in order from most recently used to least recently used.
     */
    *keys() {
        for (const i of this.#indexes()) {
            const k = this.#keyList[i];
            if (k !== undefined &&
                !this.#isBackgroundFetch(this.#valList[i])) {
                yield k;
            }
        }
    }
    /**
     * Inverse order version of {@link LRUCache.keys}
     *
     * Return a generator yielding the keys in the cache,
     * in order from least recently used to most recently used.
     */
    *rkeys() {
        for (const i of this.#rindexes()) {
            const k = this.#keyList[i];
            if (k !== undefined &&
                !this.#isBackgroundFetch(this.#valList[i])) {
                yield k;
            }
        }
    }
    /**
     * Return a generator yielding the values in the cache,
     * in order from most recently used to least recently used.
     */
    *values() {
        for (const i of this.#indexes()) {
            const v = this.#valList[i];
            if (v !== undefined &&
                !this.#isBackgroundFetch(this.#valList[i])) {
                yield this.#valList[i];
            }
        }
    }
    /**
     * Inverse order version of {@link LRUCache.values}
     *
     * Return a generator yielding the values in the cache,
     * in order from least recently used to most recently used.
     */
    *rvalues() {
        for (const i of this.#rindexes()) {
            const v = this.#valList[i];
            if (v !== undefined &&
                !this.#isBackgroundFetch(this.#valList[i])) {
                yield this.#valList[i];
            }
        }
    }
    /**
     * Iterating over the cache itself yields the same results as
     * {@link LRUCache.entries}
     */
    [Symbol.iterator]() {
        return this.entries();
    }
    /**
     * Find a value for which the supplied fn method returns a truthy value,
     * similar to Array.find().  fn is called as fn(value, key, cache).
     */
    find(fn, getOptions = {}) {
        for (const i of this.#indexes()) {
            const v = this.#valList[i];
            const value = this.#isBackgroundFetch(v)
                ? v.__staleWhileFetching
                : v;
            if (value === undefined)
                continue;
            if (fn(value, this.#keyList[i], this)) {
                return this.get(this.#keyList[i], getOptions);
            }
        }
    }
    /**
     * Call the supplied function on each item in the cache, in order from
     * most recently used to least recently used.  fn is called as
     * fn(value, key, cache).  Does not update age or recenty of use.
     * Does not iterate over stale values.
     */
    forEach(fn, thisp = this) {
        for (const i of this.#indexes()) {
            const v = this.#valList[i];
            const value = this.#isBackgroundFetch(v)
                ? v.__staleWhileFetching
                : v;
            if (value === undefined)
                continue;
            fn.call(thisp, value, this.#keyList[i], this);
        }
    }
    /**
     * The same as {@link LRUCache.forEach} but items are iterated over in
     * reverse order.  (ie, less recently used items are iterated over first.)
     */
    rforEach(fn, thisp = this) {
        for (const i of this.#rindexes()) {
            const v = this.#valList[i];
            const value = this.#isBackgroundFetch(v)
                ? v.__staleWhileFetching
                : v;
            if (value === undefined)
                continue;
            fn.call(thisp, value, this.#keyList[i], this);
        }
    }
    /**
     * Delete any stale entries. Returns true if anything was removed,
     * false otherwise.
     */
    purgeStale() {
        let deleted = false;
        for (const i of this.#rindexes({ allowStale: true })) {
            if (this.#isStale(i)) {
                this.delete(this.#keyList[i]);
                deleted = true;
            }
        }
        return deleted;
    }
    /**
     * Get the extended info about a given entry, to get its value, size, and
     * TTL info simultaneously. Like {@link LRUCache#dump}, but just for a
     * single key. Always returns stale values, if their info is found in the
     * cache, so be sure to check for expired TTLs if relevant.
     */
    info(key) {
        const i = this.#keyMap.get(key);
        if (i === undefined)
            return undefined;
        const v = this.#valList[i];
        const value = this.#isBackgroundFetch(v)
            ? v.__staleWhileFetching
            : v;
        if (value === undefined)
            return undefined;
        const entry = { value };
        if (this.#ttls && this.#starts) {
            const ttl = this.#ttls[i];
            const start = this.#starts[i];
            if (ttl && start) {
                const remain = ttl - (perf.now() - start);
                entry.ttl = remain;
                entry.start = Date.now();
            }
        }
        if (this.#sizes) {
            entry.size = this.#sizes[i];
        }
        return entry;
    }
    /**
     * Return an array of [key, {@link LRUCache.Entry}] tuples which can be
     * passed to cache.load()
     */
    dump() {
        const arr = [];
        for (const i of this.#indexes({ allowStale: true })) {
            const key = this.#keyList[i];
            const v = this.#valList[i];
            const value = this.#isBackgroundFetch(v)
                ? v.__staleWhileFetching
                : v;
            if (value === undefined || key === undefined)
                continue;
            const entry = { value };
            if (this.#ttls && this.#starts) {
                entry.ttl = this.#ttls[i];
                // always dump the start relative to a portable timestamp
                // it's ok for this to be a bit slow, it's a rare operation.
                const age = perf.now() - this.#starts[i];
                entry.start = Math.floor(Date.now() - age);
            }
            if (this.#sizes) {
                entry.size = this.#sizes[i];
            }
            arr.unshift([key, entry]);
        }
        return arr;
    }
    /**
     * Reset the cache and load in the items in entries in the order listed.
     * Note that the shape of the resulting cache may be different if the
     * same options are not used in both caches.
     */
    load(arr) {
        this.clear();
        for (const [key, entry] of arr) {
            if (entry.start) {
                // entry.start is a portable timestamp, but we may be using
                // node's performance.now(), so calculate the offset, so that
                // we get the intended remaining TTL, no matter how long it's
                // been on ice.
                //
                // it's ok for this to be a bit slow, it's a rare operation.
                const age = Date.now() - entry.start;
                entry.start = perf.now() - age;
            }
            this.set(key, entry.value, entry);
        }
    }
    /**
     * Add a value to the cache.
     *
     * Note: if `undefined` is specified as a value, this is an alias for
     * {@link LRUCache#delete}
     */
    set(k, v, setOptions = {}) {
        if (v === undefined) {
            this.delete(k);
            return this;
        }
        const { ttl = this.ttl, start, noDisposeOnSet = this.noDisposeOnSet, sizeCalculation = this.sizeCalculation, status, } = setOptions;
        let { noUpdateTTL = this.noUpdateTTL } = setOptions;
        const size = this.#requireSize(k, v, setOptions.size || 0, sizeCalculation);
        // if the item doesn't fit, don't do anything
        // NB: maxEntrySize set to maxSize by default
        if (this.maxEntrySize && size > this.maxEntrySize) {
            if (status) {
                status.set = 'miss';
                status.maxEntrySizeExceeded = true;
            }
            // have to delete, in case something is there already.
            this.delete(k);
            return this;
        }
        let index = this.#size === 0 ? undefined : this.#keyMap.get(k);
        if (index === undefined) {
            // addition
            index = (this.#size === 0
                ? this.#tail
                : this.#free.length !== 0
                    ? this.#free.pop()
                    : this.#size === this.#max
                        ? this.#evict(false)
                        : this.#size);
            this.#keyList[index] = k;
            this.#valList[index] = v;
            this.#keyMap.set(k, index);
            this.#next[this.#tail] = index;
            this.#prev[index] = this.#tail;
            this.#tail = index;
            this.#size++;
            this.#addItemSize(index, size, status);
            if (status)
                status.set = 'add';
            noUpdateTTL = false;
        }
        else {
            // update
            this.#moveToTail(index);
            const oldVal = this.#valList[index];
            if (v !== oldVal) {
                if (this.#hasFetchMethod && this.#isBackgroundFetch(oldVal)) {
                    oldVal.__abortController.abort(new Error('replaced'));
                    const { __staleWhileFetching: s } = oldVal;
                    if (s !== undefined && !noDisposeOnSet) {
                        if (this.#hasDispose) {
                            this.#dispose?.(s, k, 'set');
                        }
                        if (this.#hasDisposeAfter) {
                            this.#disposed?.push([s, k, 'set']);
                        }
                    }
                }
                else if (!noDisposeOnSet) {
                    if (this.#hasDispose) {
                        this.#dispose?.(oldVal, k, 'set');
                    }
                    if (this.#hasDisposeAfter) {
                        this.#disposed?.push([oldVal, k, 'set']);
                    }
                }
                this.#removeItemSize(index);
                this.#addItemSize(index, size, status);
                this.#valList[index] = v;
                if (status) {
                    status.set = 'replace';
                    const oldValue = oldVal && this.#isBackgroundFetch(oldVal)
                        ? oldVal.__staleWhileFetching
                        : oldVal;
                    if (oldValue !== undefined)
                        status.oldValue = oldValue;
                }
            }
            else if (status) {
                status.set = 'update';
            }
        }
        if (ttl !== 0 && !this.#ttls) {
            this.#initializeTTLTracking();
        }
        if (this.#ttls) {
            if (!noUpdateTTL) {
                this.#setItemTTL(index, ttl, start);
            }
            if (status)
                this.#statusTTL(status, index);
        }
        if (!noDisposeOnSet && this.#hasDisposeAfter && this.#disposed) {
            const dt = this.#disposed;
            let task;
            while ((task = dt?.shift())) {
                this.#disposeAfter?.(...task);
            }
        }
        return this;
    }
    /**
     * Evict the least recently used item, returning its value or
     * `undefined` if cache is empty.
     */
    pop() {
        try {
            while (this.#size) {
                const val = this.#valList[this.#head];
                this.#evict(true);
                if (this.#isBackgroundFetch(val)) {
                    if (val.__staleWhileFetching) {
                        return val.__staleWhileFetching;
                    }
                }
                else if (val !== undefined) {
                    return val;
                }
            }
        }
        finally {
            if (this.#hasDisposeAfter && this.#disposed) {
                const dt = this.#disposed;
                let task;
                while ((task = dt?.shift())) {
                    this.#disposeAfter?.(...task);
                }
            }
        }
    }
    #evict(free) {
        const head = this.#head;
        const k = this.#keyList[head];
        const v = this.#valList[head];
        if (this.#hasFetchMethod && this.#isBackgroundFetch(v)) {
            v.__abortController.abort(new Error('evicted'));
        }
        else if (this.#hasDispose || this.#hasDisposeAfter) {
            if (this.#hasDispose) {
                this.#dispose?.(v, k, 'evict');
            }
            if (this.#hasDisposeAfter) {
                this.#disposed?.push([v, k, 'evict']);
            }
        }
        this.#removeItemSize(head);
        // if we aren't about to use the index, then null these out
        if (free) {
            this.#keyList[head] = undefined;
            this.#valList[head] = undefined;
            this.#free.push(head);
        }
        if (this.#size === 1) {
            this.#head = this.#tail = 0;
            this.#free.length = 0;
        }
        else {
            this.#head = this.#next[head];
        }
        this.#keyMap.delete(k);
        this.#size--;
        return head;
    }
    /**
     * Check if a key is in the cache, without updating the recency of use.
     * Will return false if the item is stale, even though it is technically
     * in the cache.
     *
     * Will not update item age unless
     * {@link LRUCache.OptionsBase.updateAgeOnHas} is set.
     */
    has(k, hasOptions = {}) {
        const { updateAgeOnHas = this.updateAgeOnHas, status } = hasOptions;
        const index = this.#keyMap.get(k);
        if (index !== undefined) {
            const v = this.#valList[index];
            if (this.#isBackgroundFetch(v) &&
                v.__staleWhileFetching === undefined) {
                return false;
            }
            if (!this.#isStale(index)) {
                if (updateAgeOnHas) {
                    this.#updateItemAge(index);
                }
                if (status) {
                    status.has = 'hit';
                    this.#statusTTL(status, index);
                }
                return true;
            }
            else if (status) {
                status.has = 'stale';
                this.#statusTTL(status, index);
            }
        }
        else if (status) {
            status.has = 'miss';
        }
        return false;
    }
    /**
     * Like {@link LRUCache#get} but doesn't update recency or delete stale
     * items.
     *
     * Returns `undefined` if the item is stale, unless
     * {@link LRUCache.OptionsBase.allowStale} is set.
     */
    peek(k, peekOptions = {}) {
        const { allowStale = this.allowStale } = peekOptions;
        const index = this.#keyMap.get(k);
        if (index === undefined ||
            (!allowStale && this.#isStale(index))) {
            return;
        }
        const v = this.#valList[index];
        // either stale and allowed, or forcing a refresh of non-stale value
        return this.#isBackgroundFetch(v) ? v.__staleWhileFetching : v;
    }
    #backgroundFetch(k, index, options, context) {
        const v = index === undefined ? undefined : this.#valList[index];
        if (this.#isBackgroundFetch(v)) {
            return v;
        }
        const ac = new AC();
        const { signal } = options;
        // when/if our AC signals, then stop listening to theirs.
        signal?.addEventListener('abort', () => ac.abort(signal.reason), {
            signal: ac.signal,
        });
        const fetchOpts = {
            signal: ac.signal,
            options,
            context,
        };
        const cb = (v, updateCache = false) => {
            const { aborted } = ac.signal;
            const ignoreAbort = options.ignoreFetchAbort && v !== undefined;
            if (options.status) {
                if (aborted && !updateCache) {
                    options.status.fetchAborted = true;
                    options.status.fetchError = ac.signal.reason;
                    if (ignoreAbort)
                        options.status.fetchAbortIgnored = true;
                }
                else {
                    options.status.fetchResolved = true;
                }
            }
            if (aborted && !ignoreAbort && !updateCache) {
                return fetchFail(ac.signal.reason);
            }
            // either we didn't abort, and are still here, or we did, and ignored
            const bf = p;
            if (this.#valList[index] === p) {
                if (v === undefined) {
                    if (bf.__staleWhileFetching) {
                        this.#valList[index] = bf.__staleWhileFetching;
                    }
                    else {
                        this.delete(k);
                    }
                }
                else {
                    if (options.status)
                        options.status.fetchUpdated = true;
                    this.set(k, v, fetchOpts.options);
                }
            }
            return v;
        };
        const eb = (er) => {
            if (options.status) {
                options.status.fetchRejected = true;
                options.status.fetchError = er;
            }
            return fetchFail(er);
        };
        const fetchFail = (er) => {
            const { aborted } = ac.signal;
            const allowStaleAborted = aborted && options.allowStaleOnFetchAbort;
            const allowStale = allowStaleAborted || options.allowStaleOnFetchRejection;
            const noDelete = allowStale || options.noDeleteOnFetchRejection;
            const bf = p;
            if (this.#valList[index] === p) {
                // if we allow stale on fetch rejections, then we need to ensure that
                // the stale value is not removed from the cache when the fetch fails.
                const del = !noDelete || bf.__staleWhileFetching === undefined;
                if (del) {
                    this.delete(k);
                }
                else if (!allowStaleAborted) {
                    // still replace the *promise* with the stale value,
                    // since we are done with the promise at this point.
                    // leave it untouched if we're still waiting for an
                    // aborted background fetch that hasn't yet returned.
                    this.#valList[index] = bf.__staleWhileFetching;
                }
            }
            if (allowStale) {
                if (options.status && bf.__staleWhileFetching !== undefined) {
                    options.status.returnedStale = true;
                }
                return bf.__staleWhileFetching;
            }
            else if (bf.__returned === bf) {
                throw er;
            }
        };
        const pcall = (res, rej) => {
            const fmp = this.#fetchMethod?.(k, v, fetchOpts);
            if (fmp && fmp instanceof Promise) {
                fmp.then(v => res(v === undefined ? undefined : v), rej);
            }
            // ignored, we go until we finish, regardless.
            // defer check until we are actually aborting,
            // so fetchMethod can override.
            ac.signal.addEventListener('abort', () => {
                if (!options.ignoreFetchAbort ||
                    options.allowStaleOnFetchAbort) {
                    res(undefined);
                    // when it eventually resolves, update the cache.
                    if (options.allowStaleOnFetchAbort) {
                        res = v => cb(v, true);
                    }
                }
            });
        };
        if (options.status)
            options.status.fetchDispatched = true;
        const p = new Promise(pcall).then(cb, eb);
        const bf = Object.assign(p, {
            __abortController: ac,
            __staleWhileFetching: v,
            __returned: undefined,
        });
        if (index === undefined) {
            // internal, don't expose status.
            this.set(k, bf, { ...fetchOpts.options, status: undefined });
            index = this.#keyMap.get(k);
        }
        else {
            this.#valList[index] = bf;
        }
        return bf;
    }
    #isBackgroundFetch(p) {
        if (!this.#hasFetchMethod)
            return false;
        const b = p;
        return (!!b &&
            b instanceof Promise &&
            b.hasOwnProperty('__staleWhileFetching') &&
            b.__abortController instanceof AC);
    }
    async fetch(k, fetchOptions = {}) {
        const { 
        // get options
        allowStale = this.allowStale, updateAgeOnGet = this.updateAgeOnGet, noDeleteOnStaleGet = this.noDeleteOnStaleGet, 
        // set options
        ttl = this.ttl, noDisposeOnSet = this.noDisposeOnSet, size = 0, sizeCalculation = this.sizeCalculation, noUpdateTTL = this.noUpdateTTL, 
        // fetch exclusive options
        noDeleteOnFetchRejection = this.noDeleteOnFetchRejection, allowStaleOnFetchRejection = this.allowStaleOnFetchRejection, ignoreFetchAbort = this.ignoreFetchAbort, allowStaleOnFetchAbort = this.allowStaleOnFetchAbort, context, forceRefresh = false, status, signal, } = fetchOptions;
        if (!this.#hasFetchMethod) {
            if (status)
                status.fetch = 'get';
            return this.get(k, {
                allowStale,
                updateAgeOnGet,
                noDeleteOnStaleGet,
                status,
            });
        }
        const options = {
            allowStale,
            updateAgeOnGet,
            noDeleteOnStaleGet,
            ttl,
            noDisposeOnSet,
            size,
            sizeCalculation,
            noUpdateTTL,
            noDeleteOnFetchRejection,
            allowStaleOnFetchRejection,
            allowStaleOnFetchAbort,
            ignoreFetchAbort,
            status,
            signal,
        };
        let index = this.#keyMap.get(k);
        if (index === undefined) {
            if (status)
                status.fetch = 'miss';
            const p = this.#backgroundFetch(k, index, options, context);
            return (p.__returned = p);
        }
        else {
            // in cache, maybe already fetching
            const v = this.#valList[index];
            if (this.#isBackgroundFetch(v)) {
                const stale = allowStale && v.__staleWhileFetching !== undefined;
                if (status) {
                    status.fetch = 'inflight';
                    if (stale)
                        status.returnedStale = true;
                }
                return stale ? v.__staleWhileFetching : (v.__returned = v);
            }
            // if we force a refresh, that means do NOT serve the cached value,
            // unless we are already in the process of refreshing the cache.
            const isStale = this.#isStale(index);
            if (!forceRefresh && !isStale) {
                if (status)
                    status.fetch = 'hit';
                this.#moveToTail(index);
                if (updateAgeOnGet) {
                    this.#updateItemAge(index);
                }
                if (status)
                    this.#statusTTL(status, index);
                return v;
            }
            // ok, it is stale or a forced refresh, and not already fetching.
            // refresh the cache.
            const p = this.#backgroundFetch(k, index, options, context);
            const hasStale = p.__staleWhileFetching !== undefined;
            const staleVal = hasStale && allowStale;
            if (status) {
                status.fetch = isStale ? 'stale' : 'refresh';
                if (staleVal && isStale)
                    status.returnedStale = true;
            }
            return staleVal ? p.__staleWhileFetching : (p.__returned = p);
        }
    }
    /**
     * Return a value from the cache. Will update the recency of the cache
     * entry found.
     *
     * If the key is not found, get() will return `undefined`.
     */
    get(k, getOptions = {}) {
        const { allowStale = this.allowStale, updateAgeOnGet = this.updateAgeOnGet, noDeleteOnStaleGet = this.noDeleteOnStaleGet, status, } = getOptions;
        const index = this.#keyMap.get(k);
        if (index !== undefined) {
            const value = this.#valList[index];
            const fetching = this.#isBackgroundFetch(value);
            if (status)
                this.#statusTTL(status, index);
            if (this.#isStale(index)) {
                if (status)
                    status.get = 'stale';
                // delete only if not an in-flight background fetch
                if (!fetching) {
                    if (!noDeleteOnStaleGet) {
                        this.delete(k);
                    }
                    if (status && allowStale)
                        status.returnedStale = true;
                    return allowStale ? value : undefined;
                }
                else {
                    if (status &&
                        allowStale &&
                        value.__staleWhileFetching !== undefined) {
                        status.returnedStale = true;
                    }
                    return allowStale ? value.__staleWhileFetching : undefined;
                }
            }
            else {
                if (status)
                    status.get = 'hit';
                // if we're currently fetching it, we don't actually have it yet
                // it's not stale, which means this isn't a staleWhileRefetching.
                // If it's not stale, and fetching, AND has a __staleWhileFetching
                // value, then that means the user fetched with {forceRefresh:true},
                // so it's safe to return that value.
                if (fetching) {
                    return value.__staleWhileFetching;
                }
                this.#moveToTail(index);
                if (updateAgeOnGet) {
                    this.#updateItemAge(index);
                }
                return value;
            }
        }
        else if (status) {
            status.get = 'miss';
        }
    }
    #connect(p, n) {
        this.#prev[n] = p;
        this.#next[p] = n;
    }
    #moveToTail(index) {
        // if tail already, nothing to do
        // if head, move head to next[index]
        // else
        //   move next[prev[index]] to next[index] (head has no prev)
        //   move prev[next[index]] to prev[index]
        // prev[index] = tail
        // next[tail] = index
        // tail = index
        if (index !== this.#tail) {
            if (index === this.#head) {
                this.#head = this.#next[index];
            }
            else {
                this.#connect(this.#prev[index], this.#next[index]);
            }
            this.#connect(this.#tail, index);
            this.#tail = index;
        }
    }
    /**
     * Deletes a key out of the cache.
     * Returns true if the key was deleted, false otherwise.
     */
    delete(k) {
        let deleted = false;
        if (this.#size !== 0) {
            const index = this.#keyMap.get(k);
            if (index !== undefined) {
                deleted = true;
                if (this.#size === 1) {
                    this.clear();
                }
                else {
                    this.#removeItemSize(index);
                    const v = this.#valList[index];
                    if (this.#isBackgroundFetch(v)) {
                        v.__abortController.abort(new Error('deleted'));
                    }
                    else if (this.#hasDispose || this.#hasDisposeAfter) {
                        if (this.#hasDispose) {
                            this.#dispose?.(v, k, 'delete');
                        }
                        if (this.#hasDisposeAfter) {
                            this.#disposed?.push([v, k, 'delete']);
                        }
                    }
                    this.#keyMap.delete(k);
                    this.#keyList[index] = undefined;
                    this.#valList[index] = undefined;
                    if (index === this.#tail) {
                        this.#tail = this.#prev[index];
                    }
                    else if (index === this.#head) {
                        this.#head = this.#next[index];
                    }
                    else {
                        const pi = this.#prev[index];
                        this.#next[pi] = this.#next[index];
                        const ni = this.#next[index];
                        this.#prev[ni] = this.#prev[index];
                    }
                    this.#size--;
                    this.#free.push(index);
                }
            }
        }
        if (this.#hasDisposeAfter && this.#disposed?.length) {
            const dt = this.#disposed;
            let task;
            while ((task = dt?.shift())) {
                this.#disposeAfter?.(...task);
            }
        }
        return deleted;
    }
    /**
     * Clear the cache entirely, throwing away all values.
     */
    clear() {
        for (const index of this.#rindexes({ allowStale: true })) {
            const v = this.#valList[index];
            if (this.#isBackgroundFetch(v)) {
                v.__abortController.abort(new Error('deleted'));
            }
            else {
                const k = this.#keyList[index];
                if (this.#hasDispose) {
                    this.#dispose?.(v, k, 'delete');
                }
                if (this.#hasDisposeAfter) {
                    this.#disposed?.push([v, k, 'delete']);
                }
            }
        }
        this.#keyMap.clear();
        this.#valList.fill(undefined);
        this.#keyList.fill(undefined);
        if (this.#ttls && this.#starts) {
            this.#ttls.fill(0);
            this.#starts.fill(0);
        }
        if (this.#sizes) {
            this.#sizes.fill(0);
        }
        this.#head = 0;
        this.#tail = 0;
        this.#free.length = 0;
        this.#calculatedSize = 0;
        this.#size = 0;
        if (this.#hasDisposeAfter && this.#disposed) {
            const dt = this.#disposed;
            let task;
            while ((task = dt?.shift())) {
                this.#disposeAfter?.(...task);
            }
        }
    }
}
//# sourceMappingURL=index.js.map
;// CONCATENATED MODULE: ./domain-whois.ts





function daysToMilliseconds(days) {
    return days * 86400000;
}
function daysBetweenDates(d1, d2) {
    return Math.round(Math.abs(d1.getTime() - d2.getTime()) / (1000 * 3600 * 24));
}
function daysFromDateToNow(date) {
    const now = new Date();
    return daysBetweenDates(now, date);
}
class domain_whois_TenuredDomainCache {
    constructor(ttlDaysArg, maxSizeArg) {
        this.ttlDaysArg = ttlDaysArg;
        this.maxSizeArg = maxSizeArg;
        let maxSize = 4096;
        let ttlDays = 7;
        if (ttlDaysArg !== undefined) {
            ttlDays = ttlDaysArg;
        }
        if (maxSizeArg !== undefined) {
            maxSize = maxSizeArg;
        }
        this.cache = new LRUCache({
            max: maxSize,
            ttl: daysToMilliseconds(ttlDays)
        });
        log(`Created TenuredDomainCache with size ${maxSize}, TTL: ${ttlDays} days`);
    }
    clear() {
        this.cache.clear();
    }
    has(domain) {
        return this.cache.has(domain);
    }
    add(domain) {
        this.cache.set(domain, true);
    }
}
const domainWhoisPath = "/identity-protection/domain-whois/";
class domain_whois_DomainWhoisRequester {
    constructor(configNotifier) {
        configNotifier.addConfigListenerForKey(config => this.onConfigChanged(config), ConfigKey.config);
    }
    onConfigChanged(config) {
        if (some(config.threatCloudOrigin) && some(config.threatCloudAuthParam)) {
            this.requestUrlBase = config.threatCloudOrigin + domainWhoisPath + config.threatCloudAuthParam;
        }
        else {
            this.requestUrlBase = undefined;
        }
    }
    async getCreatedDateAgeDays(url) {
        return new Promise((resolve, reject) => {
            if (none(this.requestUrlBase)) {
                logError("DomainWhoisRequester: request URL is undefined");
                reject();
            }
            const urlObject = new URL(url);
            const requestUrl = this.requestUrlBase + "&domains=" + encodeURIComponent(urlObject.hostname) + "&fields=createddate&validate=1";
            fetch(requestUrl).then(response => {
                switch (response.status) {
                    case 200:
                        return response.json();
                    default:
                        throw new Error(`DomainWhoisRequester: server status: ${response.status}`);
                }
            }).then(responseJson => {
                var _a;
                const domainsData = responseJson.domains;
                if (Object.keys(domainsData).length < 1) {
                    logError(`DomainWhoisRequester: bad data (no domains) returned for ${requestUrl}`);
                    reject();
                    return;
                }
                const domainName = Object.keys(domainsData)[0];
                if (!domainsData[domainName].hasOwnProperty('createddate')) {
                    logError(`DomainWhoisRequester: bad data (no createddate) returned for ${requestUrl}`);
                    reject();
                    return;
                }
                const domainData = domainsData[domainName];
                const domainInfo = {
                    createddate: (_a = domainData.createddate) !== null && _a !== void 0 ? _a : null,
                };
                if (domainInfo.createddate === null) {
                    logError(`No createddate for ${url}`);
                    reject();
                    return;
                }
                const domainAgeCreatedDate = new Date(domainInfo.createddate);
                if (isNaN(domainAgeCreatedDate.getTime())) {
                    logError(`${domainInfo.createddate} is not a valid createddate for ${url}`);
                    reject();
                    return;
                }
                else {
                    const days = daysFromDateToNow(domainAgeCreatedDate);
                    log(`Domain ${urlObject.hostname} (URL ${url}) createddate: ${domainInfo.createddate}`);
                    resolve(days);
                }
            }).catch(error => {
                logError(`DomainWhoisRequester: fetch error: ${toString(error)}`);
                reject();
            });
        });
    }
}

;// CONCATENATED MODULE: ../lib/common/sorting-list-label-machine.ts



class BlockedPattern {
    constructor(pattern) {
        try {
            this.regex = new RegExp(pattern, "i");
        }
        catch (e) {
            logError(e);
        }
    }
    test(urlSpec) {
        if (some(this.regex)) {
            return this.regex.test(urlSpec);
        }
        else {
            return false;
        }
    }
}
class DomainFilter {
    constructor(listEntry) {
        this.blockedPatterns = [];
        this.isAllowed = false;
        this.isAllowed = listEntry.whitelisted;
        this.blockedPatterns = listEntry.blacklistedPatterns.filter(pattern => pattern.length > 0)
            .map(pattern => new BlockedPattern(pattern));
    }
    categorise(url) {
        for (const blockedPattern of this.blockedPatterns) {
            if (blockedPattern.test(url.href)) {
                return IPPageCategory.Blocked;
            }
        }
        return this.isAllowed ? IPPageCategory.Allowed : IPPageCategory.Unknown;
    }
}
class sorting_list_label_machine_CloudSortingListLabelMachine {
    constructor(cloudList) {
        this.domainFilters = new Map();
        this.add(cloudList);
    }
    add(cloudList) {
        cloudList.domains.forEach(domainEntry => {
            this.domainFilters.set(domainEntry.domain, new DomainFilter(domainEntry));
        });
    }
    delete(hostname) {
        this.domainFilters.delete(hostname);
    }
    runFilter(hostname, url) {
        var _a, _b;
        return (_b = (_a = this.domainFilters.get(hostname)) === null || _a === void 0 ? void 0 : _a.categorise(url)) !== null && _b !== void 0 ? _b : IPPageCategory.Unknown;
    }
    categorise(url) {
        let hostnameParts = url.hostname.split(".");
        let hasBeenAllowed = false;
        while (hostnameParts.length > 0) {
            const hostnameToCheck = hostnameParts.join(".");
            hostnameParts.shift();
            const category = this.runFilter(hostnameToCheck, url);
            switch (category) {
                case IPPageCategory.Blocked:
                    return category;
                case IPPageCategory.Allowed:
                    hasBeenAllowed = true;
                    break;
                case IPPageCategory.Unknown:
                    break;
                default:
                    break;
            }
        }
        return hasBeenAllowed ? IPPageCategory.Allowed : IPPageCategory.Unknown;
    }
}

;// CONCATENATED MODULE: ../lib/common/phishing-sorting-lists.ts














var IPSortingList;
(function (IPSortingList) {
    IPSortingList[IPSortingList["HTTPBlocker"] = 0] = "HTTPBlocker";
    IPSortingList[IPSortingList["CustomerBEC"] = 1] = "CustomerBEC";
    IPSortingList[IPSortingList["HPCloud"] = 2] = "HPCloud";
    IPSortingList[IPSortingList["Endpoint"] = 3] = "Endpoint";
    IPSortingList[IPSortingList["User"] = 4] = "User";
    IPSortingList[IPSortingList["FileUrl"] = 5] = "FileUrl";
    IPSortingList[IPSortingList["DomainAge"] = 6] = "DomainAge";
})(IPSortingList || (IPSortingList = {}));
const IPSortingListcount = Object.keys(IPSortingList).filter(k => !isNaN(Number(k))).length;
class SortingListBase {
    constructor(type, onCategorisedCallback) {
        this.type = type;
        this.onCategorisedCallback = onCategorisedCallback;
    }
    onCategorised(categoriesOrUrl, urlInfo) {
        if (categoriesOrUrl instanceof Map) {
            for (const [urlSpec, category] of categoriesOrUrl) {
                this.onCategorisedCallback({ category, list: this.type, urlSpec });
            }
        }
        else if (some(urlInfo)) {
            const category = urlInfo.category;
            const domainAgeDays = urlInfo.domainAgeDays;
            const domainAgeDaysThreshold = urlInfo.domainAgeDaysThreshold;
            this.onCategorisedCallback({ category, list: this.type, urlSpec: categoriesOrUrl, domainAgeDays, domainAgeDaysThreshold });
        }
    }
}
class HTTPBlockerSortingList extends (/* unused pure expression or super */ null && (SortingListBase)) {
    constructor(configNotifier, onCategorisedCallback) {
        super(IPSortingList.HTTPBlocker, onCategorisedCallback);
        this.treatHttpAsBlocked = false;
        configNotifier.addConfigListenerForKey(config => this.onConfigChanged(config), ConfigKey.config);
    }
    onConfigChanged(config) {
        if (config.identityProtection.enabled) {
            this.treatHttpAsBlocked = config.identityProtection.config.treatHttpAsBlocked;
        }
        else {
            this.treatHttpAsBlocked = false;
        }
    }
    categorise(url) {
        if (this.treatHttpAsBlocked && url.protocol === Scheme.HTTP) {
            return IPPageCategory.Blocked;
        }
        else {
            return IPPageCategory.Unknown;
        }
    }
    clearWaitingList() { }
}
class DomainAgeSortingList extends (/* unused pure expression or super */ null && (SortingListBase)) {
    constructor(configNotifier, onCategorisedCallback) {
        super(IPSortingList.DomainAge, onCategorisedCallback);
        this.idGenerator = new IdGenerator();
        this.waitingList = new Map();
        this.enabled = false;
        this.minDays = 30;
        this.domainWhoisRequester = new DomainWhoisRequester(configNotifier);
        this.tenuredDomainCache = new TenuredDomainCache();
        configNotifier.addConfigListenerForKey(config => this.onConfigChanged(config), ConfigKey.config);
    }
    onConfigChanged(config) {
        if (config.identityProtection.enabled) {
            const ipConfig = config.identityProtection.config;
            if (this.minDays != ipConfig.domainAgeCheckMinDays) {
                log('DomainAgeSortingList clearing tenured domain cache due to change in domain age threshold');
                this.tenuredDomainCache.clear();
            }
            this.enabled = ipConfig.domainAgeCheckEnabled;
            this.minDays = ipConfig.domainAgeCheckMinDays;
            if (!this.enabled) {
                log('Domain age checking for identity protection explicitly disabled');
            }
            else {
                log(`Domain age checking for identity protection enabled, threshold: ${this.minDays} days`);
            }
        }
        else {
            log('Identity protection disabled; disabling domain age checking');
            this.tenuredDomainCache.clear();
            this.enabled = false;
        }
    }
    categorise(url) {
        if (isFileUrl(url) || !this.enabled) {
            return IPPageCategory.Unknown;
        }
        const domain = url.hostname;
        if (this.tenuredDomainCache.has(domain)) {
            return IPPageCategory.Unknown;
        }
        const id = this.idGenerator.generateId();
        this.waitingList.set(id, url.href);
        this.domainWhoisRequester.getCreatedDateAgeDays(url.toString()).then(domainAgeDays => {
            const domainAgeDaysThreshold = this.minDays;
            log(`Domain ${domain} (url ${url}) is ${domainAgeDays} days old; configured minimum threshold: ${domainAgeDaysThreshold}`);
            if (domainAgeDays < domainAgeDaysThreshold) {
                this.onCategorised(url.href, { category: IPPageCategory.Blocked, domainAgeDays, domainAgeDaysThreshold });
            }
            else {
                this.tenuredDomainCache.add(domain);
                this.onCategorised(url.href, { category: IPPageCategory.Unknown, domainAgeDays, domainAgeDaysThreshold });
            }
            this.waitingList.delete(id);
        }).catch(() => {
            logError(`Failed to lookup creation date for ${domain} (url ${url})`);
        });
        return undefined;
    }
    clearWaitingList() {
        this.waitingList.clear();
    }
}
class EndpointSortingList extends (/* unused pure expression or super */ null && (SortingListBase)) {
    constructor(messageRouter, hostHelperMessageSender, onCategorisedCallback) {
        super(IPSortingList.Endpoint, onCategorisedCallback);
        this.hostHelperMessageSender = hostHelperMessageSender;
        this.idGenerator = new IdGenerator();
        this.waitingList = new Map();
        messageRouter.registerMessagePayloadHandler(MessageType.phishingCategoryResponseV22, message => this.onCategoryResponse(message));
    }
    onCategoryResponse(payload) {
        const urlSpec = this.waitingList.get(payload.id);
        if (some(urlSpec)) {
            this.onCategorised(urlSpec, { category: payload.category });
            this.waitingList.delete(payload.id);
        }
    }
    categorise(url) {
        if (isFileUrl(url)) {
            return IPPageCategory.Unknown;
        }
        const queryUrl = url.href;
        const id = this.idGenerator.generateId();
        this.waitingList.set(id, queryUrl);
        this.hostHelperMessageSender.sendMessage(MessageType.phishingCategoryRequestV22, new PhishingCategoryRequestV22(id, queryUrl));
        return undefined;
    }
    clearWaitingList() {
        this.waitingList.clear();
    }
}
class UserSortingList extends (/* unused pure expression or super */ null && (SortingListBase)) {
    constructor(configNotifier, hostHelperMessageSender, onCategorisedCallback) {
        super(IPSortingList.User, onCategorisedCallback);
        this.hostHelperMessageSender = hostHelperMessageSender;
        this.allowUserToEnableInput = false;
        this.userAllowedHosts = new Set();
        configNotifier.addConfigListenerForKey(config => this.onConfigChanged(config), ConfigKey.config);
    }
    onConfigChanged(config) {
        if (config.identityProtection.enabled) {
            const ipConfig = config.identityProtection.config;
            this.allowUserToEnableInput = ipConfig.allowUserToEnableInput;
            this.operationMode = ipConfig.operationMode;
            this.userAllowedHosts = new Set(ipConfig.userAllowedHosts);
        }
        else {
            this.allowUserToEnableInput = false;
        }
    }
    categorise(url) {
        if (isFileUrl(url)) {
            return IPPageCategory.Unknown;
        }
        const isUserListActive = this.allowUserToEnableInput && isInputAllowableOpMode(this.operationMode);
        if (isUserListActive && this.userAllowedHosts.has(url.hostname)) {
            return IPPageCategory.UserAllowed;
        }
        else {
            return IPPageCategory.Unknown;
        }
    }
    clearWaitingList() { }
    allowHostnames(toAllow) {
        this.changeHostStatus(toAllow, true);
    }
    disallowHostnames(toDisallow) {
        this.changeHostStatus(toDisallow, false);
    }
    changeHostStatus(items, allowInput) {
        const hostnames = items.map(item => isURL(item) ? item.hostname : item);
        if (allowInput) {
            log(`UserSortingList: User added ${toString(hostnames)} to list`);
            hostnames.forEach(hostname => this.userAllowedHosts.add(hostname));
        }
        else {
            log(`UserSortingList: User removed ${toString(hostnames)} from list`);
            hostnames.forEach(hostname => this.userAllowedHosts.delete(hostname));
        }
        this.hostHelperMessageSender.sendMessage(MessageType.phishingHostStatusChangeV22, new PhishingHostStatusChangeV22(hostnames, allowInput));
    }
}
const credentialProtectionUrlListPath = "/deviceapi/credential-protection-url-list/";
const urlClassificationPath = "/identity-protection/url-classification/";
var Classification;
(function (Classification) {
    Classification[Classification["unknown"] = 0] = "unknown";
    Classification[Classification["allowed"] = 1] = "allowed";
    Classification[Classification["blocked"] = 2] = "blocked";
})(Classification || (Classification = {}));
class CloudSortingListBase extends (/* unused pure expression or super */ null && (SortingListBase)) {
    constructor(type, onCategorisedCallback, serverOriginUrl, listPath, authParam) {
        super(type, onCategorisedCallback);
        this.authParam = authParam;
        this.identifier = `CloudSortingList ${IPSortingList[this.type]}`;
        this.requestUrlBase = serverOriginUrl.origin + listPath;
    }
    static get emptyList() {
        return {
            "version": "0.0.0",
            "lastUpdated": 0,
            "domains": [],
            "urls": {}
        };
    }
    get serverOrigin() { return new URL(this.requestUrlBase).origin; }
    fetch(listTimestamp, url) {
        let requestUrl = this.requestUrlBase;
        if (some(this.authParam)) {
            requestUrl += this.authParam;
        }
        if (some(url)) {
            log(`${this.identifier}: Fetching list for "${url}"`);
            requestUrl += "&urls=" + encodeURIComponent(url);
        }
        const listDate = new Date(listTimestamp);
        const options = { method: "GET" };
        if (!isNaN(listDate.getTime()) && 0 !== listDate.valueOf()) {
            options.headers = { "If-Modified-Since": listDate.toUTCString() };
        }
        fetch(requestUrl, options).then(response => {
            switch (response.status) {
                case 200:
                    log(`${this.identifier}: New list available from server`);
                    return response.json();
                case 304:
                    log(`${this.identifier}: Already have latest list`);
                    return undefined;
                default:
                    logError(`${this.identifier}: Server status: ${response.status}`);
                    return undefined;
            }
        }).then(responseJson => {
            if (some(responseJson)) {
                this.onListReceived(responseJson, url);
            }
            else {
                this.onListNotReceived(url);
            }
        }).catch(error => {
            logError(`${this.identifier}: Server error: ${toString(error)}`);
            this.onListNotReceived(url);
        });
    }
}
class CustomerBecSortingList extends (/* unused pure expression or super */ null && (CloudSortingListBase)) {
    constructor(serverOriginUrl, alarmManager, onCategorisedCallback) {
        super(IPSortingList.CustomerBEC, onCategorisedCallback, serverOriginUrl, credentialProtectionUrlListPath);
        this.rawList = CloudSortingListBase.emptyList;
        this.labelMachine = new CloudSortingListLabelMachine(CloudSortingListBase.emptyList);
        this.waitingList = new Set();
        this.hasList = false;
        const key = StorageKey.customerList;
        chrome.storage.local.get(key, result => {
            const storedValue = result[key];
            if (some(storedValue)) {
                this.rawList = storedValue;
                this.labelMachine = new CloudSortingListLabelMachine(this.rawList);
                this.processWaitingList();
            }
            this.fetch(this.rawList.lastUpdated);
            alarmManager.registerPeriodicAlarm(AlarmName.customerBecListFetch, 30, () => this.fetch(this.rawList.lastUpdated));
        });
    }
    onListReceived(newList) {
        this.rawList = newList;
        this.labelMachine = new CloudSortingListLabelMachine(this.rawList);
        chrome.storage.local.set({ [StorageKey.customerList]: this.rawList });
        this.processWaitingList();
    }
    onListNotReceived() {
        this.processWaitingList();
    }
    processWaitingList() {
        this.hasList = true;
        if (this.waitingList.size > 0) {
            const categories = new Map();
            this.waitingList.forEach(urlSpec => categories.set(urlSpec, this.categorise(new URL(urlSpec))));
            this.waitingList.clear();
            this.onCategorised(categories);
        }
    }
    categorise(url) {
        if (isFileUrl(url)) {
            return IPPageCategory.Unknown;
        }
        if (this.hasList) {
            return this.labelMachine.categorise(url);
        }
        else {
            this.waitingList.add(url.href);
            return undefined;
        }
    }
    clearWaitingList() {
        this.waitingList.clear();
    }
}
class HpCloudMetaData {
    constructor(timestamp) {
        this.timestamp = timestamp;
    }
}
class HpCloudSortingList extends (/* unused pure expression or super */ null && (CloudSortingListBase)) {
    constructor(authParam, alarmManager, onCategorisedCallback, overrideBrClServerUrl) {
        const serverOriginUrl = overrideBrClServerUrl !== null && overrideBrClServerUrl !== void 0 ? overrideBrClServerUrl : HpCloudSortingList.defaultOriginUrl;
        super(IPSortingList.HPCloud, onCategorisedCallback, serverOriginUrl, urlClassificationPath, authParam);
        alarmManager.registerPeriodicAlarm(AlarmName.hpCloudListClearDeadEntries, HpCloudSortingList.ttlMins, () => this.clearDeadEntries());
        this.cache = new Map();
        this.waitingUrlSpecs = new Set();
        this.waitingOriginAndPaths = new Set();
        this.lastVersion = CloudSortingListBase.emptyList.version;
    }
    static get ttlMins() { return 5; }
    static get ttl() { return HpCloudSortingList.ttlMins * 60 * 1000; }
    static get defaultOriginUrl() { return new URL("https://brcl-sureclick.bromium-online.com"); }
    get version() { return this.lastVersion; }
    isEntryAlive(entry) {
        if (some(entry)) {
            return HpCloudSortingList.ttl > (Date.now() - entry.metadata.timestamp);
        }
        return false;
    }
    getTimestamp(entry) {
        var _a;
        return (_a = entry === null || entry === void 0 ? void 0 : entry.metadata.timestamp) !== null && _a !== void 0 ? _a : 0;
    }
    clearDeadEntries() {
        const deadEntries = new Set();
        const now = Date.now();
        for (const [originAndPath, entry] of this.cache) {
            if (HpCloudSortingList.ttl < now - entry.metadata.timestamp && !this.waitingOriginAndPaths.has(originAndPath)) {
                deadEntries.add(originAndPath);
            }
        }
        for (const key of deadEntries) {
            this.cache.delete(key);
        }
    }
    onListReceived(newList, queriedOriginAndPath) {
        var _a;
        if (none(queriedOriginAndPath)) {
            logError("HpCloudSortingList: list recieved without a queried URL");
            return;
        }
        const metadata = new HpCloudMetaData(Date.now());
        let cacheEntry = this.cache.get(queriedOriginAndPath);
        const classification = (_a = newList.urls[queriedOriginAndPath]) !== null && _a !== void 0 ? _a : newList.urls[queriedOriginAndPath.toLowerCase()];
        if (some(classification)) {
            cacheEntry = { classification, metadata };
            this.cache.set(queriedOriginAndPath, cacheEntry);
        }
        else {
            if (some(cacheEntry)) {
                cacheEntry.metadata = metadata;
            }
            else {
                logError(`HpCloudSortingList: unexpected response missing the queried URL: ${toString(newList)}`);
            }
        }
        this.waitingOriginAndPaths.delete(queriedOriginAndPath);
        this.lastVersion = newList.version;
        const category = some(cacheEntry) ? this.getCategory(cacheEntry.classification) : IPPageCategory.Unknown;
        const categories = new Map();
        for (const urlSpec of this.waitingUrlSpecs) {
            const url = new URL(urlSpec);
            if (this.getOriginAndPath(url) !== queriedOriginAndPath) {
                continue;
            }
            categories.set(urlSpec, category);
        }
        for (let urlSpec of categories.keys()) {
            this.waitingUrlSpecs.delete(urlSpec);
        }
        this.onCategorised(categories);
    }
    onListNotReceived(queriedOriginAndPath) {
        this.onListReceived(CloudSortingListBase.emptyList, queriedOriginAndPath);
    }
    categorise(url) {
        if (isFileUrl(url)) {
            return IPPageCategory.Unknown;
        }
        const originAndPath = this.getOriginAndPath(url);
        const existingEntry = this.cache.get(originAndPath);
        if (this.isEntryAlive(existingEntry)) {
            return this.getCategory(existingEntry.classification);
        }
        this.waitingUrlSpecs.add(url.href);
        if (!this.waitingOriginAndPaths.has(originAndPath)) {
            this.waitingOriginAndPaths.add(originAndPath);
            this.fetch(this.getTimestamp(existingEntry), originAndPath);
        }
        return undefined;
    }
    clearWaitingList() {
        this.waitingOriginAndPaths.clear();
        this.waitingUrlSpecs.clear();
    }
    getCategory(classification) {
        switch (classification.classification) {
            case Classification.unknown:
                return IPPageCategory.Unknown;
            case Classification.allowed:
                return IPPageCategory.Allowed;
            case Classification.blocked:
                return IPPageCategory.Blocked;
            default:
                logError(`HpCloudSortingList: Invalid classification: ${toString(classification)}`);
                return IPPageCategory.Unknown;
        }
    }
    getOriginAndPath(url) {
        return url.origin + url.pathname;
    }
}
class FileUrlSortingList extends (/* unused pure expression or super */ null && (SortingListBase)) {
    constructor(configNotifier, fileUrlTracker, onCategorisedCallback) {
        super(IPSortingList.FileUrl, onCategorisedCallback);
        this.fileUrlTracker = fileUrlTracker;
        this.sbxSecureBrowserMode = false;
        this.treatFileUrlsAsBlocked = false;
        this.treatFileUrlsAsTrusted = false;
        this.waitingList = new Set();
        configNotifier.addConfigListenerForKey(config => this.onConfigChanged(config), ConfigKey.config);
    }
    onConfigChanged(config) {
        if (config.identityProtection.enabled) {
            this.treatFileUrlsAsBlocked = config.identityProtection.config.treatFileAsBlocked;
            this.treatFileUrlsAsTrusted = config.identityProtection.config.treatFileUrlsAsTrusted;
        }
        else {
            this.treatFileUrlsAsBlocked = false;
            this.treatFileUrlsAsTrusted = false;
        }
        this.sbxSecureBrowserMode = config.sbxSecureBrowserMode;
    }
    onQueryComplete(url, isTrusted) {
        const urlSpec = url.href;
        if (this.waitingList.has(urlSpec)) {
            this.onCategorised(urlSpec, { category: isTrusted ? IPPageCategory.Allowed : IPPageCategory.Blocked });
            this.waitingList.delete(urlSpec);
        }
    }
    categorise(url) {
        if (!isFileUrl(url)) {
            return IPPageCategory.Unknown;
        }
        if (this.treatFileUrlsAsBlocked) {
            return IPPageCategory.Blocked;
        }
        else if (this.treatFileUrlsAsTrusted) {
            log("Forcing file URL to be allowed by configuration.");
            return IPPageCategory.Allowed;
        }
        else if (this.sbxSecureBrowserMode) {
            return IPPageCategory.Blocked;
        }
        this.waitingList.add(url.href);
        this.fileUrlTracker.queryFileUrlTrustedness(url, (url, isTrusted) => this.onQueryComplete(url, isTrusted));
        return undefined;
    }
    clearWaitingList() {
        this.waitingList.clear();
    }
}

;// CONCATENATED MODULE: ./scripts/content-script/overlays.tsx













function insertSVG(svg) {
    return { __html: svg };
}
function OverlayBase({ name, sendMessage, strTitle, strWarning, shouldBlameAdmin, allowUserToEnableInput, isPhishingOverlay, origin, }) {
    const replaceTab = hooks_module_A(() => {
        log_log("Overlay: Replacing tab");
        sendMessage(OverlayAction.BackToSafety);
    }, []);
    const dismissWithInputDisabled = hooks_module_A(() => {
        log_log("Overlay: Dismissing overlay with input disabled");
        sendMessage(OverlayAction.ViewWithInputDisabled);
    }, []);
    const dismissWithInputEnabled = hooks_module_A(() => {
        log_log("Overlay: Dismissing overlay with input enabled");
        sendMessage(OverlayAction.EnableInput);
    }, []);
    return v("div", { id: "br-fullpage-overlay", className: `br-fullpage-overlay--${name}` },
        v("div", { className: "br-fullpage-overlay-content" },
            v("div", { className: "br-fullpage-branding" },
                v("div", { className: "logo-hp", dangerouslySetInnerHTML: insertSVG(logo_hp_lod) }),
                v("div", { className: "logo-wolf", dangerouslySetInnerHTML: insertSVG(logo_wolf_lod) }),
                v("div", { className: "logo-hp-ai", dangerouslySetInnerHTML: insertSVG(ai) })),
            v("div", { className: "br-fullpage-warning-box" },
                v("div", { className: "br-warning-title", "data-testid": "title" },
                    isPhishingOverlay &&
                        v("div", { className: "logo-cp", dangerouslySetInnerHTML: insertSVG(logo_credential_protection_lod) }),
                    strTitle),
                v("div", { className: "br-warning-description" },
                    v("p", { "data-testid": "origin" },
                        v("strong", null, origin)),
                    v("p", { "data-testid": "warning" }, strWarning)),
                v("div", { className: "br-warning-actions" },
                    v("button", { type: "button", className: "button button--safe", onClick: replaceTab }, getI18n(I18nMessages.ipOverlay_BackToSafetyButton)),
                    isPhishingOverlay &&
                        v("button", { type: "button", className: "button button--neutral", onClick: dismissWithInputDisabled }, getI18n(I18nMessages.ipOverlay_ViewPageLinkButton)),
                    allowUserToEnableInput &&
                        v("button", { type: "button", className: "button button--ghost button--with-icon", onClick: dismissWithInputEnabled },
                            v("div", { dangerouslySetInnerHTML: insertSVG(icon_warning_alt) }),
                            getI18n(I18nMessages.ipOverlay_AllowInputButton))),
                shouldBlameAdmin && v("p", null, getI18n(I18nMessages.ipOverlay_BlameAdmin)))));
}
function IPOverlay({ category, sendMessage, isFile, isHttp, treatHttpPagesAsBlocked, allowUserToEnableInput, origin, blockingCanonicalReason, logoAnalysis, }) {
    const strTitle = hooks_module_(() => {
        if (category === identity_protection_common_IPPageCategory.Blocked && isFile) {
            return getI18n(I18nMessages.ipOverlayBlocked_Title);
        }
        if (category === identity_protection_common_IPPageCategory.Blocked && isHttp && treatHttpPagesAsBlocked) {
            return getI18n(I18nMessages.ipOverlayBlockedHttp_Title);
        }
        if (category === identity_protection_common_IPPageCategory.Blocked) {
            return getI18n(I18nMessages.ipOverlayBlocked_Title);
        }
        if (!allowUserToEnableInput) {
            return getI18n(I18nMessages.ipOverlayManagedUnknown_Title);
        }
        return getI18n(I18nMessages.ipOverlayNormalUnknown_Title);
    }, [category, isFile, isHttp, treatHttpPagesAsBlocked, allowUserToEnableInput]);
    const strWarning = hooks_module_(() => {
        if (category === identity_protection_common_IPPageCategory.Blocked && isFile) {
            return getI18n(I18nMessages.ipOverlayBlockedFile_Description);
        }
        if (category === identity_protection_common_IPPageCategory.Blocked && isHttp && treatHttpPagesAsBlocked) {
            return getI18n(I18nMessages.ipOverlayBlockedHttp_Description);
        }
        if (category === identity_protection_common_IPPageCategory.Blocked) {
            if (blockingCanonicalReason === IPSortingList.DomainAge) {
                return getI18n(I18nMessages.ipOverlayBlockedDomainAge_Description);
            }
            else {
                return getI18n(I18nMessages.ipOverlayBlocked_Description);
            }
        }
        if (category === identity_protection_common_IPPageCategory.Unknown && maybe_some(logoAnalysis)) {
            const { protectedLogoFound, protectedBrandLogo, } = logoAnalysis;
            if (protectedLogoFound && maybe_some(protectedBrandLogo)) {
                const { brandName } = protectedBrandLogo;
                return getI18n(I18nMessagesWithSub.ipOverlayProtectedBrandLogo_Description, brandName);
            }
            else if (protectedBrandLogo) {
                return getI18n(I18nMessages.ipOverlayBrandLogo_Description);
            }
        }
        return getI18n(I18nMessages.ipOverlayNormalUnknown_Description);
    }, [category, isFile, isHttp, treatHttpPagesAsBlocked]);
    const shouldBlameAdmin = hooks_module_(() => {
        return !allowUserToEnableInput && (category === identity_protection_common_IPPageCategory.Unknown || isHttp);
    }, [category, isHttp, allowUserToEnableInput]);
    return v(OverlayBase, { name: identity_protection_common_IPPageCategory[category], sendMessage: sendMessage, strTitle: strTitle, strWarning: strWarning, shouldBlameAdmin: shouldBlameAdmin, allowUserToEnableInput: allowUserToEnableInput, isPhishingOverlay: true, origin: origin });
}
function CategoryUFOverlay({ blockingCategories, sendMessage, origin, }) {
    const strTitle = hooks_module_(() => {
        return getI18n(I18nMessages.ufOverlay_Title);
    }, []);
    const strWarning = hooks_module_(() => {
        if (blockingCategories.length > 1) {
            return getI18n(I18nMessagesWithSub.ufOverlay_DescriptionMany, blockingCategories.join(", "));
        }
        else {
            return getI18n(I18nMessagesWithSub.ufOverlay_DescriptionOne, blockingCategories[0]);
        }
    }, [blockingCategories]);
    return v(OverlayBase, { name: "URLFiltering", sendMessage: sendMessage, strTitle: strTitle, strWarning: strWarning, shouldBlameAdmin: true, allowUserToEnableInput: false, isPhishingOverlay: false, origin: origin });
}
function DAUFOverlay({ domainAgeDays, sendMessage, origin, }) {
    const strTitle = hooks_module_(() => {
        return getI18n(I18nMessages.ufOverlay_Title);
    }, []);
    const strWarning = hooks_module_(() => {
        return getI18n(I18nMessagesWithSub.daufOverlay_DescriptionDomainAgeDays, Math.floor(domainAgeDays).toString());
    }, [domainAgeDays]);
    return v(OverlayBase, { name: "URLFiltering", sendMessage: sendMessage, strTitle: strTitle, strWarning: strWarning, shouldBlameAdmin: true, allowUserToEnableInput: false, isPhishingOverlay: false, origin: origin });
}
function StatusMsgUFOverlay({ statusMsgs, sendMessage, origin, }) {
    const strTitle = hooks_module_(() => {
        return getI18n(I18nMessages.ufOverlay_Title);
    }, []);
    const strWarning = hooks_module_(() => {
        if (statusMsgs.length > 1) {
            return getI18n(I18nMessagesWithSub.ufStatusMsgOverlay_DescriptionMany, statusMsgs.join(", "));
        }
        else if (statusMsgs.length === 1) {
            return getI18n(I18nMessagesWithSub.ufStatusMsgOverlay_DescriptionOne, statusMsgs[0]);
        }
        else {
            return getI18n(I18nMessages.ufStatusMsgOverlay_DescriptionNone);
        }
    }, [statusMsgs]);
    return v(OverlayBase, { name: "URLFiltering", sendMessage: sendMessage, strTitle: strTitle, strWarning: strWarning, shouldBlameAdmin: true, allowUserToEnableInput: false, isPhishingOverlay: false, origin: origin });
}
function BrandLogoOverlay({ brandName, confidenceScore, logoCenterX, logoCenterY, logoWidth, logoHeight, }) {
    var dynamicLeft = `calc(${logoCenterX * 100}% - ${logoWidth / 2}px)`;
    var dynamicTop = `calc(${logoCenterY * 100}% - ${logoHeight / 2}px)`;
    return v("div", { className: "br-image-overlay", style: {
            background: 'rgb(255, 0, 0, 0.3)',
            borderRadius: '10px',
            borderColor: 'rgb(255, 0, 0)',
            borderWidth: '2px',
            borderStyle: 'solid',
            position: 'absolute',
            width: logoWidth,
            height: logoHeight,
            left: dynamicLeft,
            top: dynamicTop
        } });
}

// EXTERNAL MODULE: ./css/overlay.css
var overlay = __webpack_require__(326);
;// CONCATENATED MODULE: ./scripts/content-script/controller.tsx
















class IPUpdatingContentScriptData {
    constructor(config, portController) {
        this.config = config;
        this.onChanged = new EventDispatcher();
        portController.registerMessagePayloadHandler(message_types_MessageType.contentScriptDataV22, payload => {
            this.config = payload.ipConfig;
            this.onChanged.dispatchEvent({ linkProtectionWouldBlock: payload.linkProtectionWouldBlock, enabled: payload.ipEnabled });
        });
    }
    get operationMode() {
        return this.config.operationMode;
    }
    get onlyOnPageWithPasswordInput() {
        return this.config.onlyOnPageWithPasswordInput;
    }
    get onlyTriggerOnPasswordInput() {
        return this.config.onlyTriggerOnPasswordInput;
    }
    get trustPagesWithAutofilledPasswords() {
        return this.config.trustPagesWithAutofilledPasswords;
    }
    get useLinkAnalysisHeuristic() {
        return this.config.useLinkAnalysisHeuristic;
    }
    get treatHttpPagesAsBlocked() {
        return this.config.treatHttpPagesAsBlocked;
    }
    get treatFileUrlsAsBlocked() {
        return this.config.treatFileUrlsAsBlocked;
    }
    get allowUserToEnableInput() {
        return this.config.allowUserToEnableInput;
    }
    get blockedElementTags() {
        return this.config.blockedElementTags;
    }
    get blockedInputElementTypes() {
        return this.config.blockedInputElementTypes;
    }
    get treatFileUrlsAsTrusted() {
        return this.config.treatFileUrlsAsTrusted;
    }
}
class Controller {
    constructor() {
        this.linkProtectionWouldBlock = false;
        this.shouldShowBrandLogoOverlay = false;
        this.portController = new ExtensionPortController(hostConstants.identityProtectionPortName, undefined, () => this.onExtensionDisconnected());
        this.portController.registerMessagePayloadHandler(message_types_MessageType.frameLoadResponseV22, message => this.onFrameLoadResponse(message));
        this.portController.registerMessagePayloadHandler(message_types_MessageType.phishingDetectionTrippedV22, message => this.onPhishingDetectionTripped());
        this.portController.registerMessagePayloadHandler(message_types_MessageType.phishingDetectionSuppressedV22, message => this.onPhishingDetectionSuppressed());
        this.portController.registerMessagePayloadHandler(message_types_MessageType.onPhishingCategoryChangedV22, message => this.onPhishingCategoryInfoChanged(message));
        this.portController.registerMessagePayloadHandler(message_types_MessageType.onOverlayClickV22, message => this.onPhishingOverlayClick(message));
        this.portController.registerMessagePayloadHandler(message_types_MessageType.showUrlFilteringOverlayV26, message => this.showCategoryUrlFilteringOverlay(message));
        this.portController.registerMessagePayloadHandler(message_types_MessageType.showDomainAgeUrlFilteringOverlayV28, message => this.showDomainAgeUrlFilteringOverlay(message));
        this.portController.registerMessagePayloadHandler(message_types_MessageType.showStatusMsgUrlFilteringOverlayV29, message => this.showStatusMsgUrlFilteringOverlay(message));
        this.portController.registerMessagePayloadHandler(message_types_MessageType.onLogoAnalysisCompleteV31, message => this.onLogoAnalysisComplete(message));
        this.portController.connect();
    }
    onExtensionDisconnected() {
        var _a;
        (_a = this.ipPageManager) === null || _a === void 0 ? void 0 : _a.disable(this.linkProtectionWouldBlock);
    }
    onFrameLoadResponse(response) {
        this.ipConfig = new IPUpdatingContentScriptData(response.ipConfig, this.portController);
        this.ipConfig.onChanged.registerEventHandler(event => this.onIPDataChanged(event));
        this.frameId = response.frameId;
        this.linkProtectionWouldBlock = response.linkProtectionWouldBlock;
        if (response.ipEnabled) {
            this.ipPageManager = new PhishingPageManager(this.linkProtectionWouldBlock, this.ipConfig, this.portController);
        }
    }
    onIPDataChanged(event) {
        var _a;
        this.linkProtectionWouldBlock = event.linkProtectionWouldBlock;
        if (event.enabled) {
            if (maybe_none(this.ipPageManager)) {
                this.ipPageManager = new PhishingPageManager(this.linkProtectionWouldBlock, this.ipConfig, this.portController);
            }
            else {
                this.ipPageManager.enable(this.linkProtectionWouldBlock);
            }
        }
        else {
            (_a = this.ipPageManager) === null || _a === void 0 ? void 0 : _a.disable(this.linkProtectionWouldBlock);
        }
    }
    onPhishingDetectionTripped() {
        if (maybe_none(this.ipConfig) || maybe_none(this.ipPageManager)) {
            log_logError("onDetectionTripped: content script config or phishing page manager is undefined");
            return;
        }
        this.ipPageManager.handleDetectionTripped();
        let pageCategory = this.ipPageManager.pageCategory;
        if (shouldDisableInput(pageCategory, this.ipConfig.operationMode, this.linkProtectionWouldBlock)) {
            if (this.isTopLevelFrame) {
                if (maybe_none(pageCategory)) {
                    pageCategory = identity_protection_common_IPPageCategory.Unknown;
                }
                const { sendMessage, isFile, isHttp, origin, shadow } = this.prepareForOverlay(false);
                const allowUserToEnableInput = this.ipConfig.allowUserToEnableInput && pageCategory !== identity_protection_common_IPPageCategory.Blocked;
                const canonicalBlockingReason = this.ipPageManager.canonicalBlockingReason;
                S(v(IPOverlay, { category: pageCategory, sendMessage: sendMessage, isFile: isFile, isHttp: isHttp, treatHttpPagesAsBlocked: this.ipConfig.treatHttpPagesAsBlocked, allowUserToEnableInput: allowUserToEnableInput, origin: origin, blockingCanonicalReason: canonicalBlockingReason, logoAnalysis: this.ipPageManager.logoAnalysis }), shadow);
            }
        }
        else {
            if (this.isTopLevelFrame) {
                this.portController.sendMessage(message_types_MessageType.onOverlayClickV22, new OnOverlayClickV22(OverlayAction.OverlayNotShown));
            }
            this.ipPageManager.handleDetectionSuppressed();
        }
    }
    onPhishingDetectionSuppressed() {
        var _a;
        (_a = this.ipPageManager) === null || _a === void 0 ? void 0 : _a.handleDetectionSuppressed();
    }
    onPhishingCategoryInfoChanged(payload) {
        var _a, _b;
        if ((_a = this.ipPageManager) === null || _a === void 0 ? void 0 : _a.hasTripped) {
            log_log(`Ignoring category update to ${identity_protection_common_IPPageCategory[payload.category]} because detection has tripped.`);
            return;
        }
        (_b = this.ipPageManager) === null || _b === void 0 ? void 0 : _b.updatePageCategoryInfo(payload.category, payload.canonicalBlockingSource);
    }
    onPhishingOverlayClick(payload) {
        var _a;
        switch (payload.action) {
            case OverlayAction.EnableInput:
                log_log("Setting page category to UserAllowed because of overlay click");
                (_a = this.ipPageManager) === null || _a === void 0 ? void 0 : _a.updatePageCategoryInfo(identity_protection_common_IPPageCategory.UserAllowed);
        }
    }
    showCategoryUrlFilteringOverlay(payload) {
        const { sendMessage, origin, shadow } = this.prepareForOverlay(false);
        S(v(CategoryUFOverlay, { blockingCategories: payload.blockingCategories, sendMessage: sendMessage, origin: origin }), shadow);
    }
    showDomainAgeUrlFilteringOverlay(payload) {
        const { sendMessage, origin, shadow } = this.prepareForOverlay(false);
        S(v(DAUFOverlay, { domainAgeDays: payload.domainAgeDays, sendMessage: sendMessage, origin: origin }), shadow);
    }
    showStatusMsgUrlFilteringOverlay(payload) {
        const { sendMessage, origin, shadow } = this.prepareForOverlay(false);
        S(v(StatusMsgUFOverlay, { statusMsgs: payload.statusMsg, sendMessage: sendMessage, origin: origin }), shadow);
    }
    onLogoAnalysisComplete(payload) {
        var _a, _b;
        if ((_a = this.ipPageManager) === null || _a === void 0 ? void 0 : _a.hasTripped) {
            log_log(`Ignoring logo analysis because detection has tripped.`);
            return;
        }
        (_b = this.ipPageManager) === null || _b === void 0 ? void 0 : _b.updatePageLogoInfo(payload);
        const { protectedBrandLogo, } = payload;
        if (this.shouldShowBrandLogoOverlay && maybe_some(protectedBrandLogo)) {
            const { brandName, confidenceScore, centerX, centerY, width, height, } = protectedBrandLogo;
            const { sendMessage, origin, shadow } = this.prepareForOverlay(false);
            S(v(BrandLogoOverlay, { brandName: brandName, confidenceScore: confidenceScore, logoCenterX: centerX, logoCenterY: centerY, logoWidth: width, logoHeight: height }), shadow);
        }
    }
    prepareForOverlay(removeElementFirst) {
        const isFile = window.location.protocol === scheme_Scheme.FILE;
        const isHttp = window.location.protocol === scheme_Scheme.HTTP;
        const origin = `${window.location.protocol}//${isFile ? window.location.pathname : window.location.hostname}`;
        const shadowHost = document.createElement('com-br-cp');
        const style = document.createElement('style');
        const shadow = shadowHost.attachShadow({ mode: 'closed' });
        style.textContent = overlay/* default */.Z;
        document.body.append(shadowHost);
        shadow.appendChild(style);
        const sendMessage = removeElementFirst
            ? (action) => {
                shadowHost.remove();
                this.portController.sendMessage(message_types_MessageType.onOverlayClickV22, new OnOverlayClickV22(action));
            }
            : (action) => {
                this.portController.sendMessage(message_types_MessageType.onOverlayClickV22, new OnOverlayClickV22(action));
                shadowHost.remove();
            };
        return { sendMessage, isFile, isHttp, origin, shadow };
    }
    get isTopLevelFrame() {
        return this.frameId === TopLevelFrameId;
    }
}

;// CONCATENATED MODULE: ./scripts/content-script/main.ts

function initChromeRuntime() {
    const runtime = chrome.runtime;
}
initChromeRuntime();
const controller = new Controller();

})();

/******/ })()
;