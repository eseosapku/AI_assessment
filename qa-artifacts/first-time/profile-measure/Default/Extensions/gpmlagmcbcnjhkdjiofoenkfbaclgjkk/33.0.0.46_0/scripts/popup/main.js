/*! Copyright (c) 2025 HP Development Company, L.P. */
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
var __webpack_exports__ = {};

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
function isURL(value) {
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
    if (isURL(urlOrSpec)) {
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
function isFileUrl(url) {
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
function URLToString(url) {
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
        return URLToString(value);
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
function string_utils_toJSONString(value) {
    return JSON.stringify(value, undefined, 4);
}

;// CONCATENATED MODULE: ../lib/common/number-utils.ts
function number_utils_isInRange(value, min, max) {
    return (value >= min) && (value <= max);
}
function number_utils_isNumber(value) {
    return typeof value === "number";
}

;// CONCATENATED MODULE: ../lib/host/message-types.ts

var MessageType;
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
})(MessageType || (MessageType = {}));
function isMessageType(type) {
    return number_utils_isInRange(type, MessageType.minMessageType, MessageType.maxMessageType);
}
const frequentlySentMessageTypes = new Set([
    MessageType.logMessageV1,
    MessageType.pageEventV1,
    MessageType.heartbeatV1,
    MessageType.extensionReadyV1,
    MessageType.heartbeatV10,
    MessageType.phishingDetectionTrippedV22,
    MessageType.phishingDetectionSuppressedV22,
    MessageType.phishingInformationSubmittedV22,
    MessageType.frameLoadResponseV22,
    MessageType.contentScriptDataV22,
    MessageType.onFrameDomUpdateV22,
    MessageType.freezeScreenshotV22,
    MessageType.onOverlayClickV22,
    MessageType.onPhishingCategoryChangedV22,
    MessageType.blockedFileRequestV1,
    MessageType.blockedFileResponseV1,
    MessageType.externalAppLinkRequestV16,
    MessageType.externalAppLinkResponseV1,
    MessageType.showUrlFilteringOverlayV26,
    MessageType.showDomainAgeUrlFilteringOverlayV28,
    MessageType.showStatusMsgUrlFilteringOverlayV29,
    MessageType.analyseWebsiteScreenshotOpportunityEventV31,
    MessageType.analyseWebsiteScreenshotRequestV31,
    MessageType.analyseWebsiteScreenshotResponseV31,
    MessageType.onLogoAnalysisCompleteV31,
    MessageType.preparePhishingReportV22,
    MessageType.preparePhishingReportV28,
    MessageType.preparePhishingReportV32,
]);
function message_types_isFrequentlySentMessageType(type) {
    return frequentlySentMessageTypes.has(type);
}

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
class PhishingCategoryRequestV22 {
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
class PhishingHostStatusChangeV22 {
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

;// CONCATENATED MODULE: ../lib/common/id-generator.ts


class IdGenerator {
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
        [ProtocolVersion.v1, new Range(MessageType.handshakeV1, MessageType.heartbeatV1)],
        [ProtocolVersion.v2, new Range(MessageType.handshakeV1, MessageType.enabledFeaturesResponseV2)],
        [ProtocolVersion.v3, new Range(MessageType.handshakeV1, MessageType.reputationChangedV3)],
        [ProtocolVersion.v4, new Range(MessageType.handshakeV1, MessageType.blockedPageDataResponseV4)],
        [ProtocolVersion.v5, new Range(MessageType.handshakeV1, MessageType.popupDataResponseV5)],
        [ProtocolVersion.v6, new Range(MessageType.handshakeV1, MessageType.trustUrlV6)],
        [ProtocolVersion.v7, new Range(MessageType.handshakeV1, MessageType.configChangedV7)],
        [ProtocolVersion.v8, new Range(MessageType.handshakeV1, MessageType.configChangedV8)],
        [ProtocolVersion.v9, new Range(MessageType.handshakeV1, MessageType.configChangedV9)],
        [ProtocolVersion.v10, new Range(MessageType.handshakeV1, MessageType.heartbeatV10)],
        [ProtocolVersion.v11, new Range(MessageType.handshakeV1, MessageType.configChangedV11)],
        [ProtocolVersion.v12, new Range(MessageType.handshakeV1, MessageType.configChangedV12)],
        [ProtocolVersion.v13, new Range(MessageType.handshakeV1, MessageType.configChangedV13)],
        [ProtocolVersion.v14, new Range(MessageType.handshakeV1, MessageType.configChangedV14)],
        [ProtocolVersion.v15, new Range(MessageType.handshakeV1, MessageType.configChangedV15)],
        [ProtocolVersion.v16, new Range(MessageType.handshakeV1, MessageType.externalAppLinkRequestV16)],
        [ProtocolVersion.v17, new Range(MessageType.handshakeV1, MessageType.configChangedV17)],
        [ProtocolVersion.v18, new Range(MessageType.handshakeV1, MessageType.popupDataResponseV18)],
        [ProtocolVersion.v19, new Range(MessageType.handshakeV1, MessageType.configChangedV19)],
        [ProtocolVersion.v20, new Range(MessageType.handshakeV1, MessageType.configChangedV20)],
        [ProtocolVersion.v21, new Range(MessageType.handshakeV1, MessageType.configChangedV21)],
        [ProtocolVersion.v22, new Range(MessageType.handshakeV1, MessageType.configChangedV22)],
        [ProtocolVersion.v23, new Range(MessageType.handshakeV1, MessageType.configChangedV23)],
        [ProtocolVersion.v24, new Range(MessageType.handshakeV1, MessageType.configChangedV24)],
        [ProtocolVersion.v25, new Range(MessageType.handshakeV1, MessageType.popupDataResponseV25)],
        [ProtocolVersion.v26, new Range(MessageType.handshakeV1, MessageType.configChangedV26)],
        [ProtocolVersion.v27, new Range(MessageType.handshakeV1, MessageType.makeUrlFilteringAlertV27)],
        [ProtocolVersion.v28, new Range(MessageType.handshakeV1, MessageType.makeUrlFilteringAlertV28)],
        [ProtocolVersion.v29, new Range(MessageType.handshakeV1, MessageType.showStatusMsgUrlFilteringOverlayV29)],
        [ProtocolVersion.v30, new Range(MessageType.handshakeV1, MessageType.downloadCreatedV30)],
        [ProtocolVersion.v31, new Range(MessageType.handshakeV1, MessageType.onLogoAnalysisCompleteV31)],
        [ProtocolVersion.v32, new Range(MessageType.handshakeV1, MessageType.preparePhishingReportV32)],
        [ProtocolVersion.v33, new Range(MessageType.handshakeV1, MessageType.configChangedV33)],
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
    return !isMessageTypeSupported(MessageType.heartbeatV10, protocolVersion);
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
var StorageKey;
(function (StorageKey) {
    StorageKey["configMessage"] = "configMessage";
    StorageKey["reputableSites"] = "reputableSites";
    StorageKey["enabledFeatures"] = "enabledFeatures";
    StorageKey["failedReloadAttempts"] = "failedReloadAttempts";
    StorageKey["historySeeder"] = "historySeeder";
    StorageKey["customerList"] = "customerList";
    StorageKey["userEnabledLogging"] = "userEnabledLogging";
})(StorageKey || (StorageKey = {}));

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
        return StorageKey.userEnabledLogging;
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
    return string_utils_toJSONString({
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
                const message = encodeMessage(MessageType.handshakeV1, handshake);
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
            else if (message.type !== MessageType.handshakeV1) {
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
            this.sendMessage(MessageType.logMessageV1, { level, message });
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
        this.registerMessagePayloadHandler(MessageType.extensionReadyV1, (message) => this.handleExtensionReady(message));
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

;// CONCATENATED MODULE: ./scripts/popup/popup-controller.ts







class PopupController {
    constructor() {
        this.showClearRememberedDecisionsInfo = false;
        this.showSecureBrowserWindowButton = false;
        this.productType = ProductTypes.Unknown;
        this.popupMessageChangedListeners = [];
        this.idGenerator = new IdGenerator();
        this.extensionPortController = new ExtensionPortController(hostConstants.popupPortName, tabId => this.onExtensionReady());
        this.extensionPortController.registerMessagePayloadHandler(MessageType.popupDataResponseV25, (message) => this.handleResponse(message));
        this.extensionPortController.connect();
    }
    clearAllRememberedDecisions() {
        this.extensionPortController.sendMessage(MessageType.clearRememberedDecisionsV1, new ClearRememberedDecisionsV1());
    }
    launchNewSecureBrowserWindow() {
        this.extensionPortController.sendMessage(MessageType.launchBrowserRequestV1, new LaunchBrowserRequestV1(TabsAPIChromeNewTabSpec, this.idGenerator.generateId()));
    }
    onExtensionReady() {
        this.extensionPortController.sendMessage(MessageType.popupDataRequestV1, new PopupDataRequestV1());
    }
    addPopupMessageChangedListener(listener) {
        this.popupMessageChangedListeners.push(listener);
        if (maybe_some(this.popupMessage)) {
            listener(this.popupMessage, this.showClearRememberedDecisionsInfo, this.showSecureBrowserWindowButton, this.productType, this.helpLinkURL);
        }
    }
    onPopupMessageChanged() {
        if (maybe_some(this.popupMessage)) {
            for (const listener of this.popupMessageChangedListeners) {
                listener(this.popupMessage, this.showClearRememberedDecisionsInfo, this.showSecureBrowserWindowButton, this.productType, this.helpLinkURL);
            }
        }
    }
    handleResponse(response) {
        if (response.showClearRememberedDecisionsInfo !== this.showClearRememberedDecisionsInfo ||
            response.showSecureBrowserWindowButton !== this.showSecureBrowserWindowButton ||
            response.popupMessage !== this.popupMessage ||
            response.productType !== this.productType ||
            response.helpLinkURL !== this.helpLinkURL) {
            this.showClearRememberedDecisionsInfo = response.showClearRememberedDecisionsInfo;
            this.showSecureBrowserWindowButton = response.showSecureBrowserWindowButton;
            this.popupMessage = response.popupMessage;
            this.productType = response.productType;
            this.helpLinkURL = response.helpLinkURL;
            this.onPopupMessageChanged();
        }
    }
}

;// CONCATENATED MODULE: ../lib/common/view-utils.ts
function addButtonClickHandler(window, id, handleClick) {
    const button = window.document.getElementById(id);
    if (button !== null) {
        button.onclick = handleClick;
    }
}
function addCheckboxChangeHandler(window, id, handleCheck) {
    const element = window.document.getElementById(id);
    if (element !== null) {
        element.onchange = (event) => {
            const checkbox = event.target;
            handleCheck(checkbox.checked);
        };
    }
}
function setCheckbox(window, id, checked) {
    const element = window.document.getElementById(id);
    if (element !== null) {
        element.checked = checked;
    }
}
function setElementTextContent(window, id, text) {
    const element = window.document.getElementById(id);
    if (element !== null) {
        element.textContent = text;
    }
}
function clearElementTextContent(window, id) {
    setElementTextContent(window, id, "");
}
function setElementHref(window, id, url) {
    const element = window.document.getElementById(id);
    if (element !== null) {
        element.href = url;
    }
}
function populateParagraphElement(window, paragraphElement, messageText) {
    for (const line of messageText) {
        const textNode = window.document.createTextNode(line);
        paragraphElement.appendChild(textNode);
        const linebreak = window.document.createElement("br");
        paragraphElement.appendChild(linebreak);
    }
}
function makeVisible(window, id) {
    const element = window.document.getElementById(id);
    if (element !== null) {
        element.style.visibility = "visible";
    }
}
function makeNotVisible(window, id) {
    const element = window.document.getElementById(id);
    if (element !== null) {
        element.style.visibility = "hidden";
    }
}
function doDisplay(window, id) {
    const element = window.document.getElementById(id);
    if (element !== null) {
        element.style.display = "block";
    }
}
function doNotDisplay(window, id) {
    const element = window.document.getElementById(id);
    if (element !== null) {
        element.style.display = "none";
    }
}
function createAndAppendCell(window, text, row) {
    const cell = window.document.createElement("td");
    cell.textContent = text;
    row.appendChild(cell);
}
function createHeader(window, text) {
    const header = window.document.createElement("th");
    header.textContent = text;
    return header;
}
function createAndAppendRow(window, table, ...cells) {
    const row = window.document.createElement("tr");
    for (const cell of cells) {
        row.appendChild(cell);
    }
    table.appendChild(row);
}
function setDisabled(window, id, disabled) {
    const element = window.document.getElementById(id);
    if (element !== null) {
        element.disabled = disabled;
    }
}
function greyOutText(window, id, greyOut) {
    const element = window.document.getElementById(id);
    if (element !== null) {
        const greyTextClass = "has-text-grey-light";
        if (greyOut) {
            element.classList.add(greyTextClass);
        }
        else {
            element.classList.remove(greyTextClass);
        }
    }
}
function setTooltipText(window, id, text) {
    const element = window.document.getElementById(id);
    if (element != null) {
        element.setAttribute("data-tooltip", text);
    }
}
function setImageSource(window, id, source) {
    const element = window.document.getElementById(id);
    if (element != null) {
        element.src = source;
    }
}

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

;// CONCATENATED MODULE: ./scripts/popup/popup-view.ts




var PopupIds;
(function (PopupIds) {
    PopupIds["brandLogo"] = "brand-logo";
    PopupIds["proBrandLogo"] = "pro-brand-logo";
    PopupIds["enterpriseBrandLogo"] = "enterprise-brand-logo";
    PopupIds["popupMessage"] = "popup-message";
    PopupIds["secureBrowserWindowButton"] = "secure-browser-window-button";
    PopupIds["clearRememberedDecisionsDiv"] = "clear-remembered-decisions-div";
    PopupIds["clearRememberedDecisionsText"] = "clear-remembered-decisions-text";
    PopupIds["clearRememberedDecisionsButton"] = "clear-remembered-decisions-button";
    PopupIds["helpLink"] = "help-link";
})(PopupIds || (PopupIds = {}));
class PopupView {
    constructor(window, controller) {
        this.window = window;
        this.controller = controller;
        this.controller.addPopupMessageChangedListener(this.onPopupMessageChanged.bind(this));
        this.addButtonClickHandlers();
    }
    onPopupMessageChanged(i18nMessage, showClearRememberedDecisionsInfo, showSecureBrowserWindowButton, productType, helpLinkURL) {
        this.clear();
        this.show(i18nMessage, showClearRememberedDecisionsInfo, showSecureBrowserWindowButton, productType, helpLinkURL);
    }
    addButtonClickHandlers() {
        addButtonClickHandler(this.window, PopupIds.clearRememberedDecisionsButton, () => this.controller.clearAllRememberedDecisions());
        addButtonClickHandler(this.window, PopupIds.secureBrowserWindowButton, () => this.controller.launchNewSecureBrowserWindow());
    }
    show(i18nMessage, showClearRememberedDecisionsInfo, showSecureBrowserWindowButton, productType, helpLinkURL) {
        const noError = i18nMessage === I18nMessages.popupNoError;
        let brandLogoId;
        switch (productType) {
            case ProductTypes.Unbundled:
            case ProductTypes.LegacyEnterprise:
                brandLogoId = PopupIds.enterpriseBrandLogo;
                break;
            case ProductTypes.DaaS:
            case ProductTypes.Kodiak:
                brandLogoId = PopupIds.proBrandLogo;
                break;
            default:
                brandLogoId = PopupIds.brandLogo;
                break;
        }
        const brandLogo = window.document.getElementById(brandLogoId);
        if (brandLogo !== null) {
            brandLogo.style.backgroundImage = "url('icons/icon48.png')";
        }
        doDisplay(this.window, brandLogoId);
        this.setPopupMessage(i18nMessage);
        if (showSecureBrowserWindowButton && noError) {
            setElementTextContent(this.window, PopupIds.secureBrowserWindowButton, getI18n(I18nMessages.popupSecureBrowserWindowButton));
            doDisplay(this.window, PopupIds.secureBrowserWindowButton);
        }
        if (helpLinkURL) {
            setElementHref(this.window, PopupIds.helpLink, helpLinkURL);
            setElementTextContent(this.window, PopupIds.helpLink, getI18n(I18nMessages.helpLinkText));
        }
        if (showClearRememberedDecisionsInfo && noError) {
            log_log("PopupView: Showing the clear remembered decisions button and text.");
            setElementTextContent(this.window, PopupIds.clearRememberedDecisionsText, getI18n(I18nMessages.popupClearRememberedDecisionsText));
            setElementTextContent(this.window, PopupIds.clearRememberedDecisionsButton, getI18n(I18nMessages.popupClearRememberedDecisionsButton));
            doDisplay(this.window, PopupIds.clearRememberedDecisionsDiv);
        }
    }
    clear() {
        doNotDisplay(this.window, PopupIds.brandLogo);
        doNotDisplay(this.window, PopupIds.proBrandLogo);
        doNotDisplay(this.window, PopupIds.enterpriseBrandLogo);
        this.clearPopupMessage();
        doNotDisplay(this.window, PopupIds.secureBrowserWindowButton);
        clearElementTextContent(this.window, PopupIds.helpLink);
        doNotDisplay(this.window, PopupIds.clearRememberedDecisionsDiv);
    }
    setPopupMessage(i18nMessage) {
        log_log(`PopupView: Setting popup-message to "${getI18n(i18nMessage)}"`);
        const messageText = getI18n(i18nMessage).split("\n");
        let element = this.window.document.getElementById(PopupIds.popupMessage);
        if (element !== null) {
            populateParagraphElement(window, element, messageText);
            if (i18nMessage === I18nMessages.popupNoError) {
                element.style.whiteSpace = "nowrap";
            }
            else {
                element.style.removeProperty("white-space");
            }
        }
    }
    clearPopupMessage() {
        let element = this.window.document.getElementById(PopupIds.popupMessage);
        if (element !== null) {
            const children = [];
            element.childNodes.forEach(child => children.push(child));
            for (const child of children) {
                element.removeChild(child);
            }
        }
    }
}

;// CONCATENATED MODULE: ./scripts/popup/main.ts


function initChromeRuntime() {
    const runtime = chrome.runtime;
}
function main(window) {
    initChromeRuntime();
    const controller = new PopupController();
    const view = new PopupView(window, controller);
}
window.onload = (event) => {
    main(window);
};

/******/ })()
;