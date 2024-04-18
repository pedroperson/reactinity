// THINKING: this will just manage the store and transforms, and maybe be a point of interaction, but lets keep it minimal for now
class Reactinity {
  constructor() {
    /** Global map of stores you can search through when subscribing to stores at any point in the application life time. */
    this.stores = {};
    /** Postprocessing functions to transform data before saving it to the store. */
    this.transforms = {};
  }

  newStore(name, initialValue) {
    if (this.stores.hasOwnProperty(name)) {
      throw new Error(`A store named '${name}' already exists.`);
    }

    this.stores[name] = new Store(initialValue);
    return this.stores[name];
  }

  newTransform(name, fun) {
    if (this.transforms.hasOwnProperty(name)) {
      throw new Error(`A transform named '${name}' already exists.`);
    }

    this.transforms[name] = fun;
  }

  defaultInit() {
    // Define your own data transforms to be used anywhere in the UI.
    this.newTransform("number", (val) => Number(val));
    this.newTransform("length", (val) => val.length);
    this.newTransform("date", (unix) => new Date(unix).toLocaleDateString());
    this.newTransform("time", (unix) => new Date(unix).toLocaleTimeString());

    // Turn DOM elements reactive
    window.addEventListener("DOMContentLoaded", () => {
      HTMSMELLER.attachBasic(this.stores, this.transforms);
    });
  }
}

const HTMSMELLER = {
  attachBasic: (stores, transforms) => {
    const tag = "re";

    document.querySelectorAll(`[${tag}]`).forEach((el) => {
      elementStore(el, tag, stores).subscribe((newVal) => {
        // reach the value in case user wants an inner field of an object
        newVal = traverseElementFields(newVal, el, tag);
        // Transform the value before rendering
        elementTransforms(el, transforms).forEach((t) => (newVal = t(newVal)));

        // Turn to string since the dom is gonna do this anyway.
        newVal = newVal.toString();
        // Conditially rerender
        if (newVal !== el.innerText) {
          el.innerText = newVal;
        }
      });
    });
  },
};

function elementStore(el, tag, stores) {
  // Find the store related to the element
  const attr = el.getAttribute(tag);
  let firstPeriod = attr.indexOf(".");
  firstPeriod = firstPeriod === -1 ? attr.length : firstPeriod;

  const storeName = attr.substring(0, firstPeriod);
  if (!storeName || !stores.hasOwnProperty(storeName))
    throw "ERROR invalid store name " + storeName;

  return stores[storeName];
}
function elementTransforms(el, transforms) {
  // Transform names are stored in the element attribute, separated by commas
  const attribute = el.getAttribute("re-transform");
  if (!attribute) return [];

  const names = attribute
    .split(",")
    .map((s) => s.trim())
    .filter((v) => !!v);

  if (names.some((t) => !transforms.hasOwnProperty(t)))
    throw "ERROR Invalid transform " + attribute;

  return names.map((name) => transforms[name]);
}

function traverseElementFields(val, el, tag) {
  el.getAttribute(tag)
    .split(".")
    .slice(1) // skip the store's name
    .forEach((field) => (val = val[field]));

  return val;
}

class Store {
  constructor(initialValue) {
    this.value = initialValue;
    this.subs = [];
  }

  subscribe(method) {
    this.subs.push(method);
    method(this.value); // Call it immediately
  }

  set(val) {
    this.value = val;
    this.subs.forEach((method) => method(val));
  }

  update(fn) {
    this.set(fn(this.value));
  }
}
