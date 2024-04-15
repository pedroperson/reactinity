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
    this.newTransform("mmddyy", (unix) => new Date(unix).toLocaleDateString());

    // Turn DOM elements reactive
    window.addEventListener("DOMContentLoaded", () => {
      HTMSMELLER.attachBasic(this.stores, this.transforms);
    });
  }
}

const HTMSMELLER = {
  attachBasic: (stores, transforms) => {
    const tag = "re";
    const els = document.querySelectorAll(`[${tag}]`);

    els.forEach((el) => {
      const trans = el.getAttribute(`[re-transform]`) || "";
      const transformNames = trans
        .split(",")
        .map((s) => s.trim())
        .filter((v) => v);

      if (transformNames.some((t) => !transforms.hasOwnProperty(t)))
        throw "ERROR Invalid transform";

      const storeName = el.getAttribute(`[${tag}]`);
      if (!storeName || !stores.hasOwnProperty(storeName))
        throw "ERROR invalid store name " + storeName;

      const store = stores[storeName];
      store.subscribe((v) => {
        transformNames.forEach((t) => (v = transforms[t](v)));
        // Since the dom is gonna do this anyway, we turn to a string for a last miute comparison to potentially avoid a DOM manipulation
        v = v.toString();
        if (v !== el.innerText) {
          el.innerText = v;
        }
      });
    });
  },
};

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
