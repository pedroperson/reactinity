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

  // TODO: IDK: Should the newStore just check for array type and automatically create an aray store? the worry there is what is the value starts out as undefined or null, then we wont know. For now I am going to keep newArrayStore as a separate function for clarity, joining them later will be trivial
  newArrayStore(name, initialValue) {
    if (!this.stores[name]) {
      this.stores[name] = new ArrayStore(initialValue);
      return this.stores[name];
    }
    throw new Error(`[iScream] a store with the id '${name}' already exists`);
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
      HTMSMELLER.attachArray(this.stores, this.transforms);
    });
  }
}

class Store {
  constructor(initialValue) {
    this.value = initialValue;
    this.subs = [];
  }

  subscribe(method) {
    this.subs.push(method);
    method(this.value); // Call it immediately

    // return an unsubscribe function
    return () => {
      const i = this.subs.findIndex((s) => s === method);
      if (i === -1) throw "unsubscribe failed to find sub";
      this.subs.splice(i, 1);
    };
  }

  set(val) {
    this.value = val;
    this.subs.forEach((method) => method(val));
  }

  update(fn) {
    this.set(fn(this.value));
  }
}

const HTMSMELLER = {
  attachBasic: (stores, transforms) => {
    const tag = "re";

    document.querySelectorAll(`[${tag}]`).forEach((el) => {
      const store = elementStore(el, tag, stores);
      store.subscribe((newVal) => {
        DOMINATOR.innerText(newVal, el, tag, transforms);
      });
    });
  },
  attachArray: (stores, transforms) => {
    const tag = "re-array";

    document.querySelectorAll(`[${tag}]`).forEach((el) => {
      const store = elementStore(el, tag, stores);
      // Fancy subscribe to respond to fine grained updates
      const sub = new ArrayStoreUISubscriber(el, transforms);

      store.subscribe(sub);
    });
  },
};

const DOMINATOR = {
  innerText: function (newVal, el, tag, transforms) {
    newVal = traverseElementFields(newVal, el, tag);
    // Transform the value before rendering
    elementTransforms(el, transforms).forEach((t) => (newVal = t(newVal)));
    // Turn to string since the dom is gonna do this anyway.
    newVal = newVal.toString();
    // Conditially rerender
    if (newVal !== el.innerText) {
      el.innerText = newVal;
    }
  },
  // class: function(item, el ,tag, transforms) {
  //     const attr = el.getAttribute(tag);
  //     const fields = attr.split(",").map((s) => s.trim());

  //     if (fields.length < 3)
  //       throw `invalid class field format "${attr}". Expected "className,field,transforms".`;
  //     const [className, field, ...transforms] = fields;
  //     let v = item[field];
  //     if (transforms && transforms.length > 0)
  //       transforms.forEach((transform) => {
  //         v = transforms[transform](v);
  //       });
  //     v = !!v;
  //     if (v && !el.classList.contains(className)) {
  //       el.classList.add(className);
  //     } else if (!v && el.classList.contains(className)) {
  //       el.classList.remove(className);
  //     }
  //   }
  // }
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
