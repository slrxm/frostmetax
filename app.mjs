var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/@capacitor/core/dist/index.js
var ExceptionCode, CapacitorException, getPlatformId, createCapacitor, initCapacitorGlobal, Capacitor, registerPlugin, WebPlugin, encode, decode, CapacitorCookiesPluginWeb, CapacitorCookies, readBlobAsBase64, normalizeHttpHeaders, buildUrlParams, buildRequestInit, CapacitorHttpPluginWeb, CapacitorHttp;
var init_dist = __esm({
  "node_modules/@capacitor/core/dist/index.js"() {
    (function(ExceptionCode2) {
      ExceptionCode2["Unimplemented"] = "UNIMPLEMENTED";
      ExceptionCode2["Unavailable"] = "UNAVAILABLE";
    })(ExceptionCode || (ExceptionCode = {}));
    CapacitorException = class extends Error {
      constructor(message, code, data) {
        super(message);
        this.message = message;
        this.code = code;
        this.data = data;
      }
    };
    getPlatformId = (win) => {
      var _a, _b;
      if (win === null || win === void 0 ? void 0 : win.androidBridge) {
        return "android";
      } else if ((_b = (_a = win === null || win === void 0 ? void 0 : win.webkit) === null || _a === void 0 ? void 0 : _a.messageHandlers) === null || _b === void 0 ? void 0 : _b.bridge) {
        return "ios";
      } else {
        return "web";
      }
    };
    createCapacitor = (win) => {
      const capCustomPlatform = win.CapacitorCustomPlatform || null;
      const cap = win.Capacitor || {};
      const Plugins = cap.Plugins = cap.Plugins || {};
      const getPlatform = () => {
        return capCustomPlatform !== null ? capCustomPlatform.name : getPlatformId(win);
      };
      const isNativePlatform = () => getPlatform() !== "web";
      const isPluginAvailable = (pluginName) => {
        const plugin = registeredPlugins.get(pluginName);
        if (plugin === null || plugin === void 0 ? void 0 : plugin.platforms.has(getPlatform())) {
          return true;
        }
        if (getPluginHeader(pluginName)) {
          return true;
        }
        return false;
      };
      const getPluginHeader = (pluginName) => {
        var _a;
        return (_a = cap.PluginHeaders) === null || _a === void 0 ? void 0 : _a.find((h) => h.name === pluginName);
      };
      const handleError = (err) => win.console.error(err);
      const registeredPlugins = /* @__PURE__ */ new Map();
      const registerPlugin2 = (pluginName, jsImplementations = {}) => {
        const registeredPlugin = registeredPlugins.get(pluginName);
        if (registeredPlugin) {
          console.warn(`Capacitor plugin "${pluginName}" already registered. Cannot register plugins twice.`);
          return registeredPlugin.proxy;
        }
        const platform = getPlatform();
        const pluginHeader = getPluginHeader(pluginName);
        let jsImplementation;
        const loadPluginImplementation = async () => {
          if (!jsImplementation && platform in jsImplementations) {
            jsImplementation = typeof jsImplementations[platform] === "function" ? jsImplementation = await jsImplementations[platform]() : jsImplementation = jsImplementations[platform];
          } else if (capCustomPlatform !== null && !jsImplementation && "web" in jsImplementations) {
            jsImplementation = typeof jsImplementations["web"] === "function" ? jsImplementation = await jsImplementations["web"]() : jsImplementation = jsImplementations["web"];
          }
          return jsImplementation;
        };
        const createPluginMethod = (impl, prop) => {
          var _a, _b;
          if (pluginHeader) {
            const methodHeader = pluginHeader === null || pluginHeader === void 0 ? void 0 : pluginHeader.methods.find((m) => prop === m.name);
            if (methodHeader) {
              if (methodHeader.rtype === "promise") {
                return (options) => cap.nativePromise(pluginName, prop.toString(), options);
              } else {
                return (options, callback) => cap.nativeCallback(pluginName, prop.toString(), options, callback);
              }
            } else if (impl) {
              return (_a = impl[prop]) === null || _a === void 0 ? void 0 : _a.bind(impl);
            }
          } else if (impl) {
            return (_b = impl[prop]) === null || _b === void 0 ? void 0 : _b.bind(impl);
          } else {
            throw new CapacitorException(`"${pluginName}" plugin is not implemented on ${platform}`, ExceptionCode.Unimplemented);
          }
        };
        const createPluginMethodWrapper = (prop) => {
          let remove;
          const wrapper = (...args) => {
            const p = loadPluginImplementation().then((impl) => {
              const fn = createPluginMethod(impl, prop);
              if (fn) {
                const p2 = fn(...args);
                remove = p2 === null || p2 === void 0 ? void 0 : p2.remove;
                return p2;
              } else {
                throw new CapacitorException(`"${pluginName}.${prop}()" is not implemented on ${platform}`, ExceptionCode.Unimplemented);
              }
            });
            if (prop === "addListener") {
              p.remove = async () => remove();
            }
            return p;
          };
          wrapper.toString = () => `${prop.toString()}() { [capacitor code] }`;
          Object.defineProperty(wrapper, "name", {
            value: prop,
            writable: false,
            configurable: false
          });
          return wrapper;
        };
        const addListener = createPluginMethodWrapper("addListener");
        const removeListener = createPluginMethodWrapper("removeListener");
        const addListenerNative = (eventName, callback) => {
          const call = addListener({ eventName }, callback);
          const remove = async () => {
            const callbackId = await call;
            removeListener({
              eventName,
              callbackId
            }, callback);
          };
          const p = new Promise((resolve) => call.then(() => resolve({ remove })));
          p.remove = async () => {
            console.warn(`Using addListener() without 'await' is deprecated.`);
            await remove();
          };
          return p;
        };
        const proxy = new Proxy({}, {
          get(_, prop) {
            switch (prop) {
              // https://github.com/facebook/react/issues/20030
              case "$$typeof":
                return void 0;
              case "toJSON":
                return () => ({});
              case "addListener":
                return pluginHeader ? addListenerNative : addListener;
              case "removeListener":
                return removeListener;
              default:
                return createPluginMethodWrapper(prop);
            }
          }
        });
        Plugins[pluginName] = proxy;
        registeredPlugins.set(pluginName, {
          name: pluginName,
          proxy,
          platforms: /* @__PURE__ */ new Set([...Object.keys(jsImplementations), ...pluginHeader ? [platform] : []])
        });
        return proxy;
      };
      if (!cap.convertFileSrc) {
        cap.convertFileSrc = (filePath) => filePath;
      }
      cap.getPlatform = getPlatform;
      cap.handleError = handleError;
      cap.isNativePlatform = isNativePlatform;
      cap.isPluginAvailable = isPluginAvailable;
      cap.registerPlugin = registerPlugin2;
      cap.Exception = CapacitorException;
      cap.DEBUG = !!cap.DEBUG;
      cap.isLoggingEnabled = !!cap.isLoggingEnabled;
      return cap;
    };
    initCapacitorGlobal = (win) => win.Capacitor = createCapacitor(win);
    Capacitor = /* @__PURE__ */ initCapacitorGlobal(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
    registerPlugin = Capacitor.registerPlugin;
    WebPlugin = class {
      constructor() {
        this.listeners = {};
        this.retainedEventArguments = {};
        this.windowListeners = {};
      }
      addListener(eventName, listenerFunc) {
        let firstListener = false;
        const listeners = this.listeners[eventName];
        if (!listeners) {
          this.listeners[eventName] = [];
          firstListener = true;
        }
        this.listeners[eventName].push(listenerFunc);
        const windowListener = this.windowListeners[eventName];
        if (windowListener && !windowListener.registered) {
          this.addWindowListener(windowListener);
        }
        if (firstListener) {
          this.sendRetainedArgumentsForEvent(eventName);
        }
        const remove = async () => this.removeListener(eventName, listenerFunc);
        const p = Promise.resolve({ remove });
        return p;
      }
      async removeAllListeners() {
        this.listeners = {};
        for (const listener in this.windowListeners) {
          this.removeWindowListener(this.windowListeners[listener]);
        }
        this.windowListeners = {};
      }
      notifyListeners(eventName, data, retainUntilConsumed) {
        const listeners = this.listeners[eventName];
        if (!listeners) {
          if (retainUntilConsumed) {
            let args = this.retainedEventArguments[eventName];
            if (!args) {
              args = [];
            }
            args.push(data);
            this.retainedEventArguments[eventName] = args;
          }
          return;
        }
        listeners.forEach((listener) => listener(data));
      }
      hasListeners(eventName) {
        var _a;
        return !!((_a = this.listeners[eventName]) === null || _a === void 0 ? void 0 : _a.length);
      }
      registerWindowListener(windowEventName, pluginEventName) {
        this.windowListeners[pluginEventName] = {
          registered: false,
          windowEventName,
          pluginEventName,
          handler: (event) => {
            this.notifyListeners(pluginEventName, event);
          }
        };
      }
      unimplemented(msg = "not implemented") {
        return new Capacitor.Exception(msg, ExceptionCode.Unimplemented);
      }
      unavailable(msg = "not available") {
        return new Capacitor.Exception(msg, ExceptionCode.Unavailable);
      }
      async removeListener(eventName, listenerFunc) {
        const listeners = this.listeners[eventName];
        if (!listeners) {
          return;
        }
        const index = listeners.indexOf(listenerFunc);
        this.listeners[eventName].splice(index, 1);
        if (!this.listeners[eventName].length) {
          this.removeWindowListener(this.windowListeners[eventName]);
        }
      }
      addWindowListener(handle) {
        window.addEventListener(handle.windowEventName, handle.handler);
        handle.registered = true;
      }
      removeWindowListener(handle) {
        if (!handle) {
          return;
        }
        window.removeEventListener(handle.windowEventName, handle.handler);
        handle.registered = false;
      }
      sendRetainedArgumentsForEvent(eventName) {
        const args = this.retainedEventArguments[eventName];
        if (!args) {
          return;
        }
        delete this.retainedEventArguments[eventName];
        args.forEach((arg) => {
          this.notifyListeners(eventName, arg);
        });
      }
    };
    encode = (str) => encodeURIComponent(str).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape);
    decode = (str) => str.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent);
    CapacitorCookiesPluginWeb = class extends WebPlugin {
      async getCookies() {
        const cookies = document.cookie;
        const cookieMap = {};
        cookies.split(";").forEach((cookie) => {
          if (cookie.length <= 0)
            return;
          let [key, value] = cookie.replace(/=/, "CAP_COOKIE").split("CAP_COOKIE");
          key = decode(key).trim();
          value = decode(value).trim();
          cookieMap[key] = value;
        });
        return cookieMap;
      }
      async setCookie(options) {
        try {
          const encodedKey = encode(options.key);
          const encodedValue = encode(options.value);
          const expires = options.expires ? `; expires=${options.expires.replace("expires=", "")}` : "";
          const path = (options.path || "/").replace("path=", "");
          const domain = options.url != null && options.url.length > 0 ? `domain=${options.url}` : "";
          document.cookie = `${encodedKey}=${encodedValue || ""}${expires}; path=${path}; ${domain};`;
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async deleteCookie(options) {
        try {
          document.cookie = `${options.key}=; Max-Age=0`;
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async clearCookies() {
        try {
          const cookies = document.cookie.split(";") || [];
          for (const cookie of cookies) {
            document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, `=;expires=${(/* @__PURE__ */ new Date()).toUTCString()};path=/`);
          }
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async clearAllCookies() {
        try {
          await this.clearCookies();
        } catch (error) {
          return Promise.reject(error);
        }
      }
    };
    CapacitorCookies = registerPlugin("CapacitorCookies", {
      web: () => new CapacitorCookiesPluginWeb()
    });
    readBlobAsBase64 = async (blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result;
        resolve(base64String.indexOf(",") >= 0 ? base64String.split(",")[1] : base64String);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(blob);
    });
    normalizeHttpHeaders = (headers = {}) => {
      const originalKeys = Object.keys(headers);
      const loweredKeys = Object.keys(headers).map((k) => k.toLocaleLowerCase());
      const normalized = loweredKeys.reduce((acc, key, index) => {
        acc[key] = headers[originalKeys[index]];
        return acc;
      }, {});
      return normalized;
    };
    buildUrlParams = (params, shouldEncode = true) => {
      if (!params)
        return null;
      const output = Object.entries(params).reduce((accumulator, entry) => {
        const [key, value] = entry;
        let encodedValue;
        let item;
        if (Array.isArray(value)) {
          item = "";
          value.forEach((str) => {
            encodedValue = shouldEncode ? encodeURIComponent(str) : str;
            item += `${key}=${encodedValue}&`;
          });
          item.slice(0, -1);
        } else {
          encodedValue = shouldEncode ? encodeURIComponent(value) : value;
          item = `${key}=${encodedValue}`;
        }
        return `${accumulator}&${item}`;
      }, "");
      return output.substr(1);
    };
    buildRequestInit = (options, extra = {}) => {
      const output = Object.assign({ method: options.method || "GET", headers: options.headers }, extra);
      const headers = normalizeHttpHeaders(options.headers);
      const type = headers["content-type"] || "";
      if (typeof options.data === "string") {
        output.body = options.data;
      } else if (type.includes("application/x-www-form-urlencoded")) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(options.data || {})) {
          params.set(key, value);
        }
        output.body = params.toString();
      } else if (type.includes("multipart/form-data") || options.data instanceof FormData) {
        const form = new FormData();
        if (options.data instanceof FormData) {
          options.data.forEach((value, key) => {
            form.append(key, value);
          });
        } else {
          for (const key of Object.keys(options.data)) {
            form.append(key, options.data[key]);
          }
        }
        output.body = form;
        const headers2 = new Headers(output.headers);
        headers2.delete("content-type");
        output.headers = headers2;
      } else if (type.includes("application/json") || typeof options.data === "object") {
        output.body = JSON.stringify(options.data);
      }
      return output;
    };
    CapacitorHttpPluginWeb = class extends WebPlugin {
      /**
       * Perform an Http request given a set of options
       * @param options Options to build the HTTP request
       */
      async request(options) {
        const requestInit = buildRequestInit(options, options.webFetchExtra);
        const urlParams = buildUrlParams(options.params, options.shouldEncodeUrlParams);
        const url = urlParams ? `${options.url}?${urlParams}` : options.url;
        const response = await fetch(url, requestInit);
        const contentType = response.headers.get("content-type") || "";
        let { responseType = "text" } = response.ok ? options : {};
        if (contentType.includes("application/json")) {
          responseType = "json";
        }
        let data;
        let blob;
        switch (responseType) {
          case "arraybuffer":
          case "blob":
            blob = await response.blob();
            data = await readBlobAsBase64(blob);
            break;
          case "json":
            data = await response.json();
            break;
          case "document":
          case "text":
          default:
            data = await response.text();
        }
        const headers = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });
        return {
          data,
          headers,
          status: response.status,
          url: response.url
        };
      }
      /**
       * Perform an Http GET request given a set of options
       * @param options Options to build the HTTP request
       */
      async get(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "GET" }));
      }
      /**
       * Perform an Http POST request given a set of options
       * @param options Options to build the HTTP request
       */
      async post(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "POST" }));
      }
      /**
       * Perform an Http PUT request given a set of options
       * @param options Options to build the HTTP request
       */
      async put(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "PUT" }));
      }
      /**
       * Perform an Http PATCH request given a set of options
       * @param options Options to build the HTTP request
       */
      async patch(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "PATCH" }));
      }
      /**
       * Perform an Http DELETE request given a set of options
       * @param options Options to build the HTTP request
       */
      async delete(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "DELETE" }));
      }
    };
    CapacitorHttp = registerPlugin("CapacitorHttp", {
      web: () => new CapacitorHttpPluginWeb()
    });
  }
});

// node_modules/@capacitor/app/dist/esm/web.js
var web_exports = {};
__export(web_exports, {
  AppWeb: () => AppWeb
});
var AppWeb;
var init_web = __esm({
  "node_modules/@capacitor/app/dist/esm/web.js"() {
    init_dist();
    AppWeb = class extends WebPlugin {
      constructor() {
        super();
        this.handleVisibilityChange = () => {
          const data = {
            isActive: document.hidden !== true
          };
          this.notifyListeners("appStateChange", data);
          if (document.hidden) {
            this.notifyListeners("pause", null);
          } else {
            this.notifyListeners("resume", null);
          }
        };
        document.addEventListener("visibilitychange", this.handleVisibilityChange, false);
      }
      exitApp() {
        throw this.unimplemented("Not implemented on web.");
      }
      async getInfo() {
        throw this.unimplemented("Not implemented on web.");
      }
      async getLaunchUrl() {
        return { url: "" };
      }
      async getState() {
        return { isActive: document.hidden !== true };
      }
      async minimizeApp() {
        throw this.unimplemented("Not implemented on web.");
      }
      async toggleBackButtonHandler() {
        throw this.unimplemented("Not implemented on web.");
      }
    };
  }
});

// src/app.mjs
init_dist();

// src/hero-data.mjs
function matchups(rows, minimum = 30) {
  return rows.filter(
    (x) => Number.isFinite(x.games_played) && x.games_played >= minimum && Number.isFinite(x.wins) && x.wins >= 0 && x.wins <= x.games_played
  ).map((x) => ({ ...x, winrate: x.wins / x.games_played * 100 }));
}
function popularItems(counts, items) {
  const byId = new Map(
    Object.entries(items).map(([key, value]) => [
      String(value.id),
      { ...value, key }
    ])
  );
  return Object.entries(counts || {}).map(([id, count]) => ({ item: byId.get(id), count })).filter(
    (x) => x.item && !x.item.key.startsWith("recipe_") && Number.isFinite(x.count) && x.count > 0
  ).sort((a, b) => b.count - a.count).slice(0, 8);
}
function matchSummary(match) {
  const lines = [];
  const p = (match.players || []).filter(
    (x) => Number.isFinite(x.gold_per_min)
  );
  if (p.length) {
    const top = p.reduce((a, b) => a.gold_per_min >= b.gold_per_min ? a : b);
    lines.push({
      type: "farm",
      heroId: top.hero_id,
      text: `\u041B\u0438\u0434\u0435\u0440 \u043F\u043E \u0437\u043E\u043B\u043E\u0442\u0443 \u0432 \u043C\u0438\u043D\u0443\u0442\u0443: ${top.gold_per_min} GPM.`
    });
  }
  const adv = match.radiant_gold_adv;
  if (Array.isArray(adv) && adv.length > 1 && adv.every(Number.isFinite)) {
    let at = 1;
    for (let i = 2; i < adv.length; i++)
      if (Math.abs(adv[i] - adv[i - 1]) > Math.abs(adv[at] - adv[at - 1]))
        at = i;
    const swing = adv[at] - adv[at - 1];
    if (swing)
      lines.push({
        type: "swing",
        text: `\u0421\u0430\u043C\u043E\u0435 \u0431\u043E\u043B\u044C\u0448\u043E\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u043F\u0440\u0435\u0438\u043C\u0443\u0449\u0435\u0441\u0442\u0432\u0430 \u043F\u043E \u0437\u043E\u043B\u043E\u0442\u0443: ${at}-\u044F \u043C\u0438\u043D\u0443\u0442\u0430, ${Math.abs(swing).toLocaleString("ru-RU")} \u0432 \u043F\u043E\u043B\u044C\u0437\u0443 ${swing > 0 ? "\u0421\u0432\u0435\u0442\u0430" : "\u0422\u044C\u043C\u044B"}. \u042D\u0442\u043E \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u0431\u0430\u043B\u0430\u043D\u0441\u0430 \u0437\u0430 \u043C\u0438\u043D\u0443\u0442\u0443, \u0430 \u043D\u0435 \u0437\u0430\u0440\u0430\u0431\u043E\u0442\u043E\u043A \u043A\u043E\u043C\u0430\u043D\u0434\u044B.`
      });
    const loserWasAhead = match.radiant_win === true ? Math.min(...adv) < -5e3 : match.radiant_win === false ? Math.max(...adv) > 5e3 : false;
    if (loserWasAhead)
      lines.push({
        type: "comeback",
        text: "\u041F\u043E\u0431\u0435\u0434\u0438\u0442\u0435\u043B\u044C \u043E\u0442\u044B\u0433\u0440\u0430\u043B \u043F\u0440\u0435\u0438\u043C\u0443\u0449\u0435\u0441\u0442\u0432\u043E \u0441\u043E\u043F\u0435\u0440\u043D\u0438\u043A\u0430 \u0431\u043E\u043B\u0435\u0435 5 000 \u0437\u043E\u043B\u043E\u0442\u0430."
      });
  }
  if (!Array.isArray(adv) || adv.length < 2)
    lines.push({
      type: "missing",
      text: "\u041D\u0435\u0442 \u043F\u043E\u043C\u0438\u043D\u0443\u0442\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445: \u0434\u043B\u044F \u043F\u043E\u0434\u0440\u043E\u0431\u043D\u043E\u0433\u043E \u0440\u0430\u0437\u0431\u043E\u0440\u0430 \u0437\u0430\u043F\u0440\u043E\u0441\u0438 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0443 \u043C\u0430\u0442\u0447\u0430 \u0432 OpenDota."
    });
  return lines;
}

// src/request-json.mjs
function createJSONClient({
  baseUrl,
  ttl = 6e5,
  timeout = 15e3,
  fetchImpl = fetch,
  now = Date.now
}) {
  const cache = /* @__PURE__ */ new Map(), pending = /* @__PURE__ */ new Map();
  return async function get2(path) {
    const hit = cache.get(path);
    if (hit && now() - hit.at < ttl) return hit.value;
    if (pending.has(path)) return pending.get(path);
    const task = (async () => {
      const response = await fetchImpl(new URL(path, baseUrl), {
        signal: AbortSignal.timeout(timeout)
      });
      if (!response.ok)
        throw Error(
          response.status === 429 ? "OpenDota \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0438\u043B \u0437\u0430\u043F\u0440\u043E\u0441\u044B. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0447\u0435\u0440\u0435\u0437 \u043C\u0438\u043D\u0443\u0442\u0443." : "OpenDota \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D."
        );
      const value = await response.json();
      cache.set(path, { value, at: now() });
      return value;
    })();
    pending.set(path, task);
    try {
      return await task;
    } finally {
      pending.delete(path);
    }
  };
}

// src/hero-insights.mjs
var get = createJSONClient({ baseUrl: "https://api.opendota.com/api/" });
var el = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (cls) n.className = cls;
  return n;
};
function section(root, title, note) {
  const s = el("section", null, "insight-section");
  s.append(el("h3", title));
  if (note) s.append(el("p", note, "small-note"));
  root.append(s);
  return s;
}
function initInsights() {
  const dialog = document.getElementById("heroDialog"), body = document.getElementById("heroBody");
  let version = 0;
  document.getElementById("closeHero").onclick = () => {
    version++;
    dialog.close();
  };
  dialog.addEventListener("close", () => version++);
  async function open(name, id) {
    const current = ++version;
    document.getElementById("heroTitle").textContent = name;
    body.replaceChildren();
    if (!dialog.open) dialog.showModal();
    const meta = window.getHeroContext(name);
    if (meta) {
      const s = section(
        body,
        "\u041C\u0435\u0442\u0430 \u0432 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u043C \u0444\u0438\u043B\u044C\u0442\u0440\u0435",
        `${meta.rank} \xB7 ${meta.role} \xB7 STRATZ \xB7 ${meta.sourceWindow === "day" ? "\u0441\u0443\u0442\u043E\u0447\u043D\u0430\u044F" : "\u043D\u0435\u0434\u0435\u043B\u044C\u043D\u0430\u044F"} \u0432\u044B\u0431\u043E\u0440\u043A\u0430`
      );
      s.append(
        el(
          "p",
          `\u0412\u0438\u043D\u0440\u0435\u0439\u0442 ${meta.wr.toFixed(1)}% \xB7 \u043F\u0438\u043A\u0440\u0435\u0439\u0442 ${meta.pr.toFixed(1)}%${meta.matches ? ` \xB7 ${meta.matches.toLocaleString("ru-RU")} \u043C\u0430\u0442\u0447\u0435\u0439` : ""}`
        )
      );
    }
    const loading2 = el("p", "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0441\u0431\u043E\u0440\u043A\u0438 \u0438 \u0441\u043E\u043F\u0435\u0440\u043D\u0438\u043A\u043E\u0432\u2026", "small-note");
    body.append(loading2);
    try {
      const heroes = await get("heroes");
      if (current !== version) return;
      const hero = heroes.find((x) => Number(x.id) === id) || heroes.find((x) => x.localized_name === name);
      if (!hero) throw Error("\u0413\u0435\u0440\u043E\u0439 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u0432 OpenDota.");
      id = hero.id;
      const names = new Map(heroes.map((x) => [x.id, x.localized_name]));
      const results = await Promise.allSettled([
        get(`heroes/${id}/matchups`),
        get(`heroes/${id}/itemPopularity`),
        get("constants/items")
      ]);
      if (current !== version) return;
      loading2.remove();
      const counter = section(
        body,
        "\u041A\u043E\u043D\u0442\u0440\u043F\u0438\u043A\u0438: \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B \u043F\u0440\u043E\u0442\u0438\u0432 \u0441\u043E\u043F\u0435\u0440\u043D\u0438\u043A\u043E\u0432",
        "OpenDota \xB7 \u043F\u0440\u043E\u0444\u0435\u0441\u0441\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0435 \u043C\u0430\u0442\u0447\u0438 \u0437\u0430 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u0433\u043E\u0434. \u041F\u043E\u043A\u0430\u0437\u0430\u043D \u0432\u0438\u043D\u0440\u0435\u0439\u0442 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E \u0433\u0435\u0440\u043E\u044F \u043F\u0440\u043E\u0442\u0438\u0432 \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u0441\u043E\u043F\u0435\u0440\u043D\u0438\u043A\u0430, \u043C\u0438\u043D\u0438\u043C\u0443\u043C 30 \u0438\u0433\u0440. \u0412\u044B\u0431\u043E\u0440\u043A\u0430 \u0432\u043A\u043B\u044E\u0447\u0430\u0435\u0442 \u0440\u0430\u0437\u043D\u044B\u0435 \u043F\u0430\u0442\u0447\u0438; \u0444\u0438\u043B\u044C\u0442\u0440\u044B \u0440\u0435\u0439\u0442\u0438\u043D\u0433\u0430 \u0438 \u043F\u043E\u0437\u0438\u0446\u0438\u0438 \u0437\u0434\u0435\u0441\u044C \u043D\u0435 \u043F\u0440\u0438\u043C\u0435\u043D\u044F\u044E\u0442\u0441\u044F."
      );
      if (results[0].status === "fulfilled") {
        const rows = matchups(results[0].value);
        if (!rows.length)
          counter.append(
            el("p", "\u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u043C\u0430\u0442\u0447\u0435\u0439 \u0434\u043B\u044F \u0441\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u044F.", "small-note")
          );
        else {
          for (const [label, list] of [
            [
              "\u0421\u043B\u043E\u0436\u043D\u044B\u0435 \u0441\u043E\u043F\u0435\u0440\u043D\u0438\u043A\u0438",
              rows.filter((x) => x.winrate < 50).sort((a, b) => a.winrate - b.winrate).slice(0, 6)
            ],
            [
              "\u0423\u0434\u043E\u0431\u043D\u044B\u0435 \u0441\u043E\u043F\u0435\u0440\u043D\u0438\u043A\u0438",
              rows.filter((x) => x.winrate >= 50).sort((a, b) => b.winrate - a.winrate).slice(0, 6)
            ]
          ]) {
            counter.append(el("h4", label));
            if (!list.length)
              counter.append(
                el(
                  "p",
                  "\u041D\u0435\u0442 \u0441\u043E\u043F\u0435\u0440\u043D\u0438\u043A\u043E\u0432 \u0441 \u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E\u0439 \u0432\u044B\u0431\u043E\u0440\u043A\u043E\u0439 \u0432 \u044D\u0442\u043E\u0439 \u0433\u0440\u0443\u043F\u043F\u0435.",
                  "small-note"
                )
              );
            for (const row of list) {
              const r = el("div", null, "insight-row");
              const b = el(
                "button",
                names.get(row.hero_id) || `\u0413\u0435\u0440\u043E\u0439 ${row.hero_id}`,
                "hero-link"
              );
              b.onclick = () => {
                open(
                  names.get(row.hero_id) || `\u0413\u0435\u0440\u043E\u0439 ${row.hero_id}`,
                  row.hero_id
                );
              };
              r.append(
                b,
                el(
                  "span",
                  `${row.winrate.toFixed(1)}% \xB7 ${row.games_played} \u0438\u0433\u0440`
                )
              );
              counter.append(r);
            }
          }
        }
      } else counter.append(el("p", results[0].reason.message, "small-note"));
      const builds = section(
        body,
        "\u041F\u0440\u0435\u0434\u043C\u0435\u0442\u044B \u043F\u043E \u0441\u0442\u0430\u0434\u0438\u044F\u043C \u0438\u0433\u0440\u044B",
        "OpenDota \xB7 \u0434\u043E 100 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0445 \u0440\u0430\u0437\u043E\u0431\u0440\u0430\u043D\u043D\u044B\u0445 \u043F\u0440\u043E\u0444\u0435\u0441\u0441\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445 \u043C\u0430\u0442\u0447\u0435\u0439. \u0427\u0438\u0441\u043B\u0430 \u2014 \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u043F\u043E\u043A\u0443\u043F\u043E\u043A, \u043D\u0435 \u0432\u0438\u043D\u0440\u0435\u0439\u0442 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430. \u041F\u043E\u043F\u0443\u043B\u044F\u0440\u043D\u044B\u0435 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u044B \u043D\u0435 \u043E\u0431\u0440\u0430\u0437\u0443\u044E\u0442 \u0433\u043E\u0442\u043E\u0432\u0443\u044E \u0441\u0431\u043E\u0440\u043A\u0443: \u0432\u044B\u0431\u043E\u0440 \u0437\u0430\u0432\u0438\u0441\u0438\u0442 \u043E\u0442 \u0440\u043E\u043B\u0438 \u0438 \u0441\u043E\u043F\u0435\u0440\u043D\u0438\u043A\u043E\u0432."
      );
      if (results[1].status === "fulfilled" && results[2].status === "fulfilled") {
        for (const [key, label] of [
          ["start_game_items", "\u0421\u0442\u0430\u0440\u0442"],
          ["early_game_items", "\u0420\u0430\u043D\u043D\u044F\u044F \u0438\u0433\u0440\u0430 \xB7 \u0434\u043E 10 \u043C\u0438\u043D\u0443\u0442"],
          ["mid_game_items", "\u0421\u0435\u0440\u0435\u0434\u0438\u043D\u0430 \u0438\u0433\u0440\u044B \xB7 10\u201325 \u043C\u0438\u043D\u0443\u0442"],
          ["late_game_items", "\u041F\u043E\u0437\u0434\u043D\u044F\u044F \u0438\u0433\u0440\u0430 \xB7 \u043F\u043E\u0441\u043B\u0435 25 \u043C\u0438\u043D\u0443\u0442"]
        ]) {
          builds.append(el("h4", label));
          const list = popularItems(results[1].value[key], results[2].value);
          if (!list.length) builds.append(el("p", "\u041D\u0435\u0442 \u0434\u0430\u043D\u043D\u044B\u0445.", "small-note"));
          for (const x of list) {
            const r = el("div", null, "insight-row");
            r.append(
              el("span", x.item.dname || x.item.key),
              el("span", `${x.count} \u043F\u043E\u043A\u0443\u043F\u043E\u043A`)
            );
            builds.append(r);
          }
        }
      } else
        builds.append(
          el(
            "p",
            "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B. \u0417\u0430\u043A\u0440\u043E\u0439 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443 \u0438 \u043F\u043E\u0432\u0442\u043E\u0440\u0438 \u043F\u043E\u043F\u044B\u0442\u043A\u0443.",
            "small-note"
          )
        );
      const recent = section(
        body,
        "\u041C\u0430\u0442\u0447\u0438 \u043D\u0430 \u0433\u0435\u0440\u043E\u0435",
        "\u041F\u0440\u043E\u0444\u0435\u0441\u0441\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0435 \u043C\u0430\u0442\u0447\u0438 \u0438\u0437 \u0432\u044B\u0431\u043E\u0440\u043A\u0438 OpenDota. \u041E\u0442\u043A\u0440\u043E\u0439 \u043C\u0430\u0442\u0447 \u0434\u043B\u044F \u0442\u0430\u0431\u043B\u0438\u0446\u044B \u0438\u0433\u0440\u043E\u043A\u043E\u0432, \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432 \u0438 \u0440\u0430\u0437\u0431\u043E\u0440\u0430."
      );
      const button = el("button", "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435 \u043C\u0430\u0442\u0447\u0438", "quiet");
      recent.append(button);
      button.onclick = async () => {
        button.disabled = true;
        try {
          const rows = await get(`heroes/${id}/matches`);
          if (current !== version) return;
          for (const m of rows.slice(0, 10)) {
            const b = el(
              "button",
              `\u041C\u0430\u0442\u0447 ${m.match_id} \xB7 ${new Date(m.start_time * 1e3).toLocaleDateString("ru-RU")}`,
              "quiet match-shortcut"
            );
            b.onclick = () => {
              dialog.close();
              window.openMatch(m.match_id);
            };
            recent.append(b);
          }
          if (!rows.length) recent.append(el("p", "\u041C\u0430\u0442\u0447\u0435\u0439 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442."));
          button.remove();
        } catch (e) {
          button.disabled = false;
          button.textContent = e.message + " \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C";
        }
      };
    } catch (e) {
      if (current === version) {
        loading2.textContent = e.message;
        if (!loading2.isConnected) body.append(loading2);
        const retry = el("button", "\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C", "quiet");
        retry.onclick = () => {
          open(name, id);
        };
        body.append(retry);
      }
    }
  }
  document.getElementById("list").addEventListener("click", (event) => {
    const b = event.target.closest("[data-hero-name]");
    if (b) open(b.dataset.heroName, Number(b.dataset.heroId));
  });
  window.addEventListener("frostmeta:match", (event) => {
    const { match, heroes } = event.detail;
    const target = document.getElementById("matchAnalysis");
    if (!target) return;
    target.replaceChildren(el("h3", "\u041A\u0440\u0430\u0442\u043A\u0438\u0439 \u0440\u0430\u0437\u0431\u043E\u0440"));
    for (const row of matchSummary(match)) {
      target.append(
        el(
          "p",
          (row.heroId ? `${heroes[row.heroId] || "\u0413\u0435\u0440\u043E\u0439"}: ` : "") + row.text
        )
      );
    }
    target.append(
      el(
        "p",
        "\u0412\u044B\u0432\u043E\u0434\u044B \u0440\u0430\u0441\u0441\u0447\u0438\u0442\u0430\u043D\u044B \u043F\u043E \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u043C \u0446\u0438\u0444\u0440\u0430\u043C \u043C\u0430\u0442\u0447\u0430. \u041E\u043D\u0438 \u043D\u0435 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u044F\u044E\u0442 \u043F\u0440\u0438\u0447\u0438\u043D\u044B \u043F\u043E\u0431\u0435\u0434\u044B \u0438\u043B\u0438 \u043A\u0430\u0447\u0435\u0441\u0442\u0432\u043E \u0440\u0435\u0448\u0435\u043D\u0438\u0439 \u0438\u0433\u0440\u043E\u043A\u0430.",
        "small-note"
      )
    );
  });
}

// node_modules/@capacitor/app/dist/esm/index.js
init_dist();
var App = registerPlugin("App", {
  web: () => Promise.resolve().then(() => (init_web(), web_exports)).then((m) => new m.AppWeb())
});

// src/app.mjs
var $ = (id) => document.getElementById(id);
var native = Capacitor.isNativePlatform();
if (native) document.body.classList.add("native");
var config = {};
var toastTimer;
function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").hidden = true, 7e3);
}
function safeUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}
var el2 = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text) n.textContent = text;
  if (cls) n.className = cls;
  return n;
};
function action(parent, label, fn, cls = "quiet") {
  const b = el2("button", label, cls);
  b.onclick = async () => {
    b.disabled = true;
    try {
      await fn();
    } catch (e) {
      toast(e.message);
    } finally {
      b.disabled = false;
    }
  };
  parent.append(b);
  return b;
}
async function me() {
  const box = $("accountPanel");
  box.replaceChildren(el2("h2", "\u041C\u043E\u0439 \u043F\u0440\u043E\u0444\u0438\u043B\u044C Dota 2"));
  box.append(
    el2(
      "p",
      "\u0421\u043E\u0445\u0440\u0430\u043D\u0438 Dota ID \u0438\u043B\u0438 \u0447\u0438\u0441\u043B\u043E\u0432\u0443\u044E \u0441\u0441\u044B\u043B\u043A\u0443 Steam \u043D\u0430 \u044D\u0442\u043E\u043C \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0435. \u0412\u0445\u043E\u0434 \u0438 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435 \u0432\u043B\u0430\u0434\u0435\u043D\u0438\u044F \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u043E\u043C \u043D\u0435 \u0442\u0440\u0435\u0431\u0443\u044E\u0442\u0441\u044F."
    )
  );
  const input = el2("input");
  input.id = "localDotaId";
  input.placeholder = "Dota ID \u0438\u043B\u0438 \u0441\u0441\u044B\u043B\u043A\u0430 Steam /profiles/\u2026";
  input.setAttribute("aria-label", "Dota ID \u0438\u043B\u0438 \u0441\u0441\u044B\u043B\u043A\u0430 Steam");
  box.append(input);
  let saved = null;
  try {
    saved = localStorage.getItem("frostmeta.dotaId");
  } catch {
  }
  if (saved) input.value = saved;
  const valid = () => {
    const id = window.parseId(input.value.trim());
    if (!id || !/^[1-9]\d*$/.test(id) || BigInt(id) > 4294967295n)
      throw Error(
        "\u0412\u0432\u0435\u0434\u0438 Dota ID \u043E\u0442 1 \u0434\u043E 4294967295 \u0438\u043B\u0438 \u0447\u0438\u0441\u043B\u043E\u0432\u0443\u044E \u0441\u0441\u044B\u043B\u043A\u0443 Steam. \u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043D\u0438\u043A\u0443 \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u0432\u043E \u0432\u043A\u043B\u0430\u0434\u043A\u0435 \xAB\u0418\u0433\u0440\u043E\u043A\xBB."
      );
    return id;
  };
  const actions = el2("div", null, "account-actions");
  box.append(actions);
  action(
    actions,
    "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043F\u0440\u043E\u0444\u0438\u043B\u044C",
    async () => {
      const id = valid();
      localStorage.setItem("frostmeta.dotaId", id);
      toast("\u041F\u0440\u043E\u0444\u0438\u043B\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D \u043D\u0430 \u044D\u0442\u043E\u043C \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0435");
    },
    "btn"
  );
  action(actions, "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0443", async () => {
    const id = valid();
    window.view(2);
    $("pid").value = id;
    window.loadPlayer(id);
    box.hidden = true;
  });
  action(actions, "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 ID", async () => {
    localStorage.removeItem("frostmeta.dotaId");
    input.value = "";
    toast("\u0421\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 ID \u0443\u0434\u0430\u043B\u0451\u043D");
  });
  box.append(
    el2(
      "p",
      "\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u043C\u0430\u0442\u0447\u0435\u0439 \u0437\u0430\u0432\u0438\u0441\u0438\u0442 \u043E\u0442 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u043F\u0443\u0431\u043B\u0438\u0447\u043D\u043E\u0441\u0442\u0438 \u0432 Dota 2. \u0421\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 ID \u043D\u0435 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u043C\u0435\u0436\u0434\u0443 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430\u043C\u0438.",
      "small-note"
    )
  );
}
if (native)
  App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) refreshMeta();
  });
initInsights();
$("accountButton").onclick = () => {
  $("accountPanel").hidden = !$("accountPanel").hidden;
};
$("downloadApp").onclick = () => $("downloadDialog").showModal();
$("closeDownload").onclick = () => $("downloadDialog").close();
function stores() {
  const root = $("storeLinks");
  for (const [key, label, waiting] of [
    ["googlePlayUrl", "Google Play", "Android \xB7 \u0441\u043A\u043E\u0440\u043E"],
    ["appStoreUrl", "App Store", "iPhone \xB7 \u0441\u043A\u043E\u0440\u043E"],
    ["androidApkUrl", "\u0421\u043A\u0430\u0447\u0430\u0442\u044C APK", "\u0422\u0435\u0441\u0442\u043E\u0432\u0430\u044F \u0432\u0435\u0440\u0441\u0438\u044F Android"]
  ]) {
    const url = safeUrl(config[key]);
    if (key === "androidApkUrl" && !url) continue;
    const item = el2(url ? "a" : "div", null, "store");
    item.append(
      el2("b", label),
      el2("span", url ? "\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435" : waiting)
    );
    if (url) {
      item.href = url;
      item.target = "_blank";
      item.rel = "noopener";
    } else item.setAttribute("aria-disabled", "true");
    root.append(item);
  }
}
function date(value) {
  const d = new Date(value);
  return Number.isNaN(+d) ? "\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E" : d.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}
async function checkMetaHealth() {
  try {
    const source = native && safeUrl(config.metaUrl) ? new URL("meta-status.json", config.metaUrl) : new URL("./meta-status.json", location.href);
    const r = await fetch(source, {
      cache: "no-store",
      signal: AbortSignal.timeout(3e3)
    });
    if (!r.ok) return;
    const status = await r.json();
    if (status.ok === false) {
      $("metaStatus").classList.add("stale");
      $("metaStatus").querySelector("span").replaceChildren(
        el2("strong", "\u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u043D\u0435 \u043E\u0431\u043D\u043E\u0432\u043B\u044F\u0435\u0442\u0441\u044F"),
        document.createTextNode(
          " \xB7 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u044F\u044F \u043F\u043E\u043F\u044B\u0442\u043A\u0430 " + date(status.checkedAt)
        )
      );
      $("note").textContent += " \xB7 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430 \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0430\u044F \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430";
    }
  } catch {
  }
}
var loading = false;
async function refreshMeta() {
  if (loading) return;
  loading = true;
  $("refreshMeta").disabled = true;
  try {
    let offline = false;
    let r;
    try {
      r = await fetch(
        native ? safeUrl(config.metaUrl) || new URL("./data.json", location.href) : new URL("./data.json", location.href),
        { cache: "no-store", signal: AbortSignal.timeout(12e3) }
      );
      if (!r.ok) throw Error();
    } catch (e) {
      if (!native) throw e;
      offline = true;
      r = await fetch("./data.json");
    }
    const j = await r.json();
    if (!Array.isArray(j.ranks) || !Array.isArray(j.roles) || !j.data)
      throw Error();
    window.applyMeta(j);
    const stamp = j.dataUpdatedAt || j.updated, age = Date.now() - new Date(stamp).getTime();
    const stale = offline || j.demo || !Number.isFinite(age) || age > 48 * 36e5;
    const state = $("metaStatus");
    state.classList.toggle("stale", Boolean(stale));
    const span = state.querySelector("span");
    span.replaceChildren(
      el2(
        "strong",
        offline ? "\u0421\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u0430\u044F \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430 \xB7 \u043D\u0435\u0442 \u0441\u0432\u044F\u0437\u0438" : j.demo ? "\u0414\u0435\u043C\u043E-\u0434\u0430\u043D\u043D\u044B\u0435" : stale ? "\u0414\u0430\u043D\u043D\u044B\u0435 \u0442\u0440\u0435\u0431\u0443\u044E\u0442 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F" : "\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u0430"
      ),
      document.createTextNode(" \xB7 " + date(stamp))
    );
    $("note").textContent = j.demo ? "\u0414\u0435\u043C\u043E\u043D\u0441\u0442\u0440\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435." : `STRATZ \xB7 ${j.sourceWindow === "day" ? "\u0441\u0443\u0442\u043E\u0447\u043D\u0430\u044F" : "\u043D\u0435\u0434\u0435\u043B\u044C\u043D\u0430\u044F"} \u0432\u044B\u0431\u043E\u0440\u043A\u0430 \xB7 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E ${date(j.checkedAt || j.updated)}${j.unchanged ? " \xB7 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A \u043F\u043E\u043A\u0430 \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u0442 \u043F\u0440\u0435\u0436\u043D\u0438\u0435 \u0446\u0438\u0444\u0440\u044B" : ""}${j.failedSlices?.length ? " \xB7 \u0447\u0430\u0441\u0442\u044C \u0444\u0438\u043B\u044C\u0442\u0440\u043E\u0432 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0438\u0435 \u0434\u0430\u043D\u043D\u044B\u0435" : ""} \xB7 \u0442\u0440\u0435\u043D\u0434 \u043A \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0435\u043C\u0443 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044E`;
    checkMetaHealth();
  } catch {
    $("metaStatus").classList.add("stale");
    $("metaStatus").querySelector("span").textContent = "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F. \u041F\u0440\u043E\u0432\u0435\u0440\u044C \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435.";
    if (!$("list").children.length)
      $("list").append(
        el2(
          "div",
          "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0443. \u041D\u0430\u0436\u043C\u0438 \xAB\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C\xBB, \u0447\u0442\u043E\u0431\u044B \u043F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C.",
          "empty"
        )
      );
  } finally {
    loading = false;
    $("refreshMeta").disabled = false;
  }
}
$("refreshMeta").onclick = refreshMeta;
try {
  const r = await fetch("./app-config.json", { cache: "no-store" });
  config = await r.json();
  if (config.apiBase) config.apiBase = config.apiBase.replace(/\/$/, "");
} catch {
}
stores();
await Promise.all([me(), refreshMeta()]);
if (new URLSearchParams(location.search).has("account")) {
  $("accountPanel").hidden = false;
  history.replaceState(null, "", location.pathname);
}
setInterval(() => {
  if (!document.hidden) refreshMeta();
}, 5 * 6e4);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshMeta();
});
/*! Bundled license information:

@capacitor/core/dist/index.js:
  (*! Capacitor: https://capacitorjs.com/ - MIT License *)
*/
