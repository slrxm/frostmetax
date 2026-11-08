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

// node_modules/@capacitor/browser/dist/esm/web.js
var web_exports = {};
__export(web_exports, {
  Browser: () => Browser,
  BrowserWeb: () => BrowserWeb
});
var BrowserWeb, Browser;
var init_web = __esm({
  "node_modules/@capacitor/browser/dist/esm/web.js"() {
    init_dist();
    BrowserWeb = class extends WebPlugin {
      constructor() {
        super();
        this._lastWindow = null;
      }
      async open(options) {
        this._lastWindow = window.open(options.url, options.windowName || "_blank");
      }
      async close() {
        return new Promise((resolve, reject) => {
          if (this._lastWindow != null) {
            this._lastWindow.close();
            this._lastWindow = null;
            resolve();
          } else {
            reject("No active window to close!");
          }
        });
      }
    };
    Browser = new BrowserWeb();
  }
});

// node_modules/@capacitor/app/dist/esm/web.js
var web_exports2 = {};
__export(web_exports2, {
  AppWeb: () => AppWeb
});
var AppWeb;
var init_web2 = __esm({
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

// node_modules/@capacitor/browser/dist/esm/index.js
init_dist();
var Browser2 = registerPlugin("Browser", {
  web: () => Promise.resolve().then(() => (init_web(), web_exports)).then((m) => new m.BrowserWeb())
});

// node_modules/@capacitor/app/dist/esm/index.js
init_dist();
var App = registerPlugin("App", {
  web: () => Promise.resolve().then(() => (init_web2(), web_exports2)).then((m) => new m.AppWeb())
});

// src/app.mjs
var $ = (id) => document.getElementById(id);
var native = Capacitor.isNativePlatform();
if (native) document.body.classList.add("native");
var config = {};
var user = null;
var bearer = null;
var pending = null;
var googleConfigured = false;
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
async function api(path, { method = "GET", body } = {}) {
  if (native && !config.apiBase)
    throw Error("\u0421\u0435\u0440\u0432\u0438\u0441 \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u0430\u0446\u0438\u0438 \u0435\u0449\u0451 \u043D\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D");
  const r = await fetch((config.apiBase || "") + path, {
    method,
    credentials: native ? "omit" : "same-origin",
    headers: {
      ...body ? { "Content-Type": "application/json" } : {},
      ...bearer ? { Authorization: `Bearer ${bearer}` } : {}
    },
    body: body ? JSON.stringify(body) : void 0,
    signal: AbortSignal.timeout(2e4)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(data.error || "\u0421\u0435\u0440\u0432\u0438\u0441 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D");
  return { data, status: r.status };
}
var el = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text) n.textContent = text;
  if (cls) n.className = cls;
  return n;
};
function action(parent, label, fn, cls = "quiet") {
  const b = el("button", label, cls);
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
async function account() {
  const box = $("accountPanel");
  box.replaceChildren();
  box.append(el("h2", user ? "\u0422\u0432\u043E\u0439 FROSTMETA" : "\u0422\u0432\u043E\u0439 \u043F\u0440\u043E\u0444\u0438\u043B\u044C Dota 2"));
  if (!user) {
    box.append(
      el(
        "p",
        "\u0412\u043E\u0439\u0434\u0438 \u0447\u0435\u0440\u0435\u0437 Google \u0438 \u043F\u0440\u0438\u0432\u044F\u0436\u0438 Steam. \u0422\u0432\u043E\u0439 \u043F\u0440\u043E\u0444\u0438\u043B\u044C \u0438 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435 \u043C\u0430\u0442\u0447\u0438 \u0431\u0443\u0434\u0443\u0442 \u043F\u043E\u0434 \u0440\u0443\u043A\u043E\u0439."
      )
    );
    const b = action(box, "\u0412\u043E\u0439\u0442\u0438 \u0447\u0435\u0440\u0435\u0437 Google", () => login("google"), "btn");
    b.disabled = !googleConfigured;
    if (!googleConfigured)
      box.append(
        el(
          "p",
          "\u0412\u0445\u043E\u0434 \u043F\u043E\u044F\u0432\u0438\u0442\u0441\u044F \u043F\u043E\u0441\u043B\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u0441\u0435\u0440\u0432\u0438\u0441\u0430 \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u0430\u0446\u0438\u0438. \u041F\u043E\u0438\u0441\u043A \u0438\u0433\u0440\u043E\u043A\u043E\u0432 \u0438 \u043C\u0430\u0442\u0447\u0435\u0439 \u0443\u0436\u0435 \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u0431\u0435\u0437 \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0430.",
          "small-note"
        )
      );
    return;
  }
  box.append(el("p", `${user.name} \xB7 ${user.email}`, "account-email"));
  const row = el("div", null, "account-actions");
  box.append(row);
  if (user.accountId) {
    box.append(el("p", `Steam \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u043D \xB7 Dota ID ${user.accountId}`));
    action(
      row,
      "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043C\u043E\u0439 \u043F\u0440\u043E\u0444\u0438\u043B\u044C Dota 2",
      () => {
        window.view(2);
        $("pid").value = user.accountId;
        window.loadPlayer(user.accountId);
        box.hidden = true;
      },
      "btn"
    );
    action(row, "\u041E\u0442\u0432\u044F\u0437\u0430\u0442\u044C Steam", async () => {
      if (!confirm("\u041E\u0442\u0432\u044F\u0437\u0430\u0442\u044C \u043F\u0440\u043E\u0444\u0438\u043B\u044C Steam?")) return;
      await api("/api/steam", { method: "DELETE" });
      await me();
    });
  } else {
    box.append(
      el(
        "p",
        "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438 \u0441\u0432\u043E\u0439 \u043F\u0440\u043E\u0444\u0438\u043B\u044C \u043D\u0430 \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u043C \u0441\u0430\u0439\u0442\u0435 Steam. \u041F\u0430\u0440\u043E\u043B\u044C Steam \u0432 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u043D\u0435 \u043F\u0435\u0440\u0435\u0434\u0430\u0451\u0442\u0441\u044F."
      )
    );
    action(row, "\u041F\u0440\u0438\u0432\u044F\u0437\u0430\u0442\u044C Steam", () => login("steam"), "btn");
  }
  action(row, "\u0412\u044B\u0439\u0442\u0438", async () => {
    await api("/api/logout", { method: "POST" });
    bearer = null;
    await me();
  });
  action(
    row,
    "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0430\u043A\u043A\u0430\u0443\u043D\u0442",
    async () => {
      if (!confirm(
        "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0430\u043A\u043A\u0430\u0443\u043D\u0442 FROSTMETA \u0438 \u043F\u0440\u0438\u0432\u044F\u0437\u043A\u0443 Steam? \u042D\u0442\u043E \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043D\u0435\u043E\u0431\u0440\u0430\u0442\u0438\u043C\u043E."
      ))
        return;
      await api("/api/account", { method: "DELETE" });
      bearer = null;
      await me();
    },
    "quiet danger"
  );
  box.append(
    el(
      "p",
      "\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u043C\u0430\u0442\u0447\u0435\u0439 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430, \u0435\u0441\u043B\u0438 \u0432 Dota 2 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0430 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \xAB\u041E\u0431\u0449\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430\u044F \u0438\u0441\u0442\u043E\u0440\u0438\u044F \u043C\u0430\u0442\u0447\u0435\u0439\xBB.",
      "small-note"
    )
  );
}
async function me() {
  try {
    const { data } = await api("/api/me");
    user = data.user;
    googleConfigured = data.googleConfigured;
  } catch {
    user = null;
    googleConfigured = false;
  }
  $("accountButton").textContent = user ? "\u041C\u043E\u0439 \u043F\u0440\u043E\u0444\u0438\u043B\u044C" : "\u0412\u043E\u0439\u0442\u0438 / \u043C\u043E\u0439 \u043F\u0440\u043E\u0444\u0438\u043B\u044C";
  await account();
}
async function login(kind) {
  if (native) {
    const { data } = await api("/api/mobile/launch", {
      method: "POST",
      body: { kind }
    });
    pending = { ...data, expires: Date.now() + 6e5 };
    await Browser2.open({ url: data.url });
    startPoll();
  } else location.assign((config.apiBase || "") + "/auth/" + kind);
}
var polling = false;
async function poll() {
  if (!pending || polling) return;
  polling = true;
  try {
    if (Date.now() > pending.expires) {
      pending = null;
      toast("\u0412\u0440\u0435\u043C\u044F \u0432\u0445\u043E\u0434\u0430 \u0438\u0441\u0442\u0435\u043A\u043B\u043E. \u041F\u043E\u0432\u0442\u043E\u0440\u0438 \u043F\u043E\u043F\u044B\u0442\u043A\u0443.");
      return;
    }
    const { data, status } = await api("/api/mobile/exchange", {
      method: "POST",
      body: { id: pending.id, secret: pending.secret }
    });
    if (status !== 202) {
      bearer = data.token;
      pending = null;
      await Browser2.close().catch(() => {
      });
      await me();
      toast("\u041F\u0440\u043E\u0444\u0438\u043B\u044C \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D");
    }
  } catch (e) {
    pending = null;
    toast(e.message);
  } finally {
    polling = false;
  }
}
function startPoll() {
  const timer = setInterval(() => {
    if (!pending) clearInterval(timer);
    else poll();
  }, 2e3);
  poll();
}
if (native)
  App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) {
      poll();
      refreshMeta();
    }
  });
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
    const item = el(url ? "a" : "div", null, "store");
    item.append(
      el("b", label),
      el("span", url ? "\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435" : waiting)
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
        el("strong", "\u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u043D\u0435 \u043E\u0431\u043D\u043E\u0432\u043B\u044F\u0435\u0442\u0441\u044F"),
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
      el(
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
        el(
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
if (native && !config.apiBase) {
  googleConfigured = false;
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
