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
    if (name === "this") {
      throw new Error(`Calling a store "this" is not allowed.`);
    }

    this.stores[name] = new Store(initialValue);
    return this.stores[name];
  }

  // TODO: IDK: Should the newStore just check for array type and automatically create an aray store? the worry there is what is the value starts out as undefined or null, then we wont know. For now I am going to keep newArrayStore as a separate function for clarity, joining them later will be trivial
  newArrayStore(name, initialValue) {
    if (this.stores.hasOwnProperty(name)) {
      throw new Error(`[iScream] a store with the id '${name}' already exists`);
    }

    this.stores[name] = new ArrayStore(initialValue);
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
  attachBasic: (stores, transforms, parent = null) => {
    const attr = "re";

    if (!parent) {
      parent = document;
    }
    // TODO: The question is: what happens if a template has a re="loggedIn" subscription? Answer: we need to call this exact function from the array, and initialize the subscription from there, but instead of using document for the search, we use the array parent element. One can see how this could cause performance issue if there are 1000s of elements subscribing to a store that is changing often, but lets keep going for now.

    // Avoiding subscribing elements inside a template, as they will be initialized after cloning by re-array.
    parent
      .querySelectorAll(`[${attr}]:not([re-template] [${attr}])`)
      .forEach((el) => {
        const storeName = elementStoreName(el, attr);
        if (!storeName || !stores.hasOwnProperty(storeName))
          throw "ERROR invalid store name " + storeName;

        const store = stores[storeName];

        store.subscribe((newVal) => {
          DOMINATOR.innerText(newVal, el, attr, transforms);
        });
      });
  },
  attachArray: (stores, transforms) => {
    const tag = "re-array";

    document
      // TODO: Dont do the not array, use a starts with "this." check instead?
      .querySelectorAll(`[${tag}]:not([re-array] [${tag}])`)
      .forEach((el) => {
        const store = elementStore(el, tag, stores);
        // TODO: when look for the template, make sure its using a direct child selector
        // Fancy subscribe to respond to fine grained updates
        const sub = new ArrayStoreUISubscriber(el, transforms);
        store.subscribe(sub);
      });
  },
};

const DOMINATOR = {
  innerText: function (newVal, el, tag, transforms) {
    // Drill down to the desired field in the object
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
  highjackClick: (itemData, el) => {
    // Hijack the click behavior. We do this to allow the user to use good old html and then we come in and add the item data to the click event to make that easy-peasy
    const original = el.onclick;
    el.onclick = null;
    el.removeAttribute("onclick");
    // Now we write our event customization layer so that the user has easy access to the item in the array related to the button being clicked
    el.addEventListener("click", (event) => {
      event = Object.assign(event, { item: itemData });
      original(event);
    });
  },
  updateClass: (el, item, allTransforms, className, attr = "re") => {
    // Drill down to field in object
    let shouldShow = traverseElementFields(item, el, attr);
    // Transform value according to "re-class-transform" attribute
    elementTransforms(el, allTransforms, "re-class-transform").forEach(
      (t) => (shouldShow = t(shouldShow))
    );
    // Force it into a boolean to avoid weird bugs
    shouldShow = !!shouldShow;
    // Conditionally add/remove the class
    if (shouldShow) {
      // Handle multiple classes spaced by " " space character
      className.split(" ").forEach((c) => el.classList.add(c));
    } else {
      className.split(" ").forEach((c) => el.classList.remove(c));
    }
  },
};

function elementStoreName(el, attr) {
  const str = el.getAttribute(attr);
  let firstPeriod = str.indexOf(".");
  firstPeriod = firstPeriod === -1 ? str.length : firstPeriod;
  return str.substring(0, firstPeriod);
}

function elementTransformNames(el, attr = "re-transform") {
  const attribute = el.getAttribute(attr);
  if (!attribute) return [];

  return attribute
    .split(",")
    .map((s) => s.trim())
    .filter((v) => !!v);
}

function elementStore(el, tag, stores) {
  const storeName = elementStoreName(el, tag);
  if (!storeName || !stores.hasOwnProperty(storeName))
    throw "ERROR invalid store name " + storeName;

  return stores[storeName];
}

function elementTransforms(el, transforms, attr) {
  const names = elementTransformNames(el, attr);

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
