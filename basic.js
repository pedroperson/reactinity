// THINKING: this will just manage the store and transforms, and maybe be a point of interaction, but lets keep it minimal for now
class Reactinity {
  constructor() {
    /** Global map of stores you can search through when subscribing to stores at any point in the application life time. */
    this.stores = {};
    /** Postprocessing functions to transform data before saving it to the store. */
    this.transforms = {};
  }

  newStore(name, initialValue) {
    if (this.stores.hasOwnProperty(name))
      throw new Error(`A store named '${name}' already exists.`);

    if (name === "this")
      throw new Error(`Calling a store "this" is not allowed.`);

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
    this.newTransform("not", (val) => !val);
    this.newTransform("number", (val) => Number(val));
    this.newTransform("length", (val) => val.length);
    this.newTransform("date", (unix) => new Date(unix).toLocaleDateString());
    this.newTransform("time", (unix) => new Date(unix).toLocaleTimeString());

    // Turn DOM elements reactive
    window.addEventListener("DOMContentLoaded", () => {
      ROOT_ATTRS.forEach((rootAttr) => {
        const attr = rootAttr.attr;
        // Avoiding subscribing elements inside a template, as they will be initialized after cloning by re-array.
        document.querySelectorAll(notInArray(attr)).forEach((el) => {
          const store = elementStore(el, attr, this.stores);
          rootAttr.fn(el, store, this.transforms, attr, this.stores);
        });
      });
    });
  }
}

// TODO: Consider an updateField store method for more fine-grained updates (instead of having to edit the whole object)
class Store {
  constructor(initialValue) {
    this.value = initialValue;
    this.subs = [];
  }
  get() {
    return this.value;
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

const ROOT_ATTRS = [
  {
    attr: "re",
    fn: (el, store, transforms, attr) => {
      store.subscribe((v) => {
        DOMINATOR.innerText(v, el, attr, transforms);
      });
    },
  },
  {
    attr: "re-show",
    fn: (el, store, transforms, attr) => {
      store.subscribe((v) => {
        DOMINATOR.updateClass(el, v, transforms, "re-show", attr);
      });
    },
  },
  {
    attr: "re-class",
    fn: (el, store, transforms, attr) => {
      const className = elementClassName(el);
      store.subscribe((v) => {
        DOMINATOR.updateClass(el, v, transforms, className, attr);
      });
    },
  },
  {
    attr: "re-array",
    fn: (el, store, transforms, attr, stores) => {
      // Fancy subscribe to respond to fine grained updates
      const sub = new ArrayStoreUISubscriber(el, stores, transforms);
      store.subscribe(sub);
    },
  },
];

const DOMINATOR = {
  innerText: function (newVal, el, tag, transforms) {
    // TODO: should we copy this value before editing it? cus if we are modifying an object, the transforms may end upmodifying the actual object. One solution here is to not allow objects, but thats shit. what if i what the length of an array of something, or the object.keys.length ? So I guess the only way out if to make a copy of the data. alternatively I can CHECK if its a simple type and then we dont need to copy, but if its an object we need some sort of deep(?) copy.
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
  updateClass: (el, item, allTransforms, className, attr = "re") => {
    // Handle multiple classes spaced by " " space character
    const classes = className.split(" ").filter((v) => v);
    if (classes.length === 0) return;

    // Drill down to field in object
    let shouldShow = traverseElementFields(item, el, attr);
    // Transform value according to "re-class-transform" attribute
    elementTransforms(el, allTransforms, "re-class-transform").forEach(
      (t) => (shouldShow = t(shouldShow))
    );
    // Force it into a boolean to avoid weird bugs
    shouldShow = !!shouldShow;
    // Conditionally add/remove the class
    const fn = shouldShow ? "add" : "remove";
    classes.forEach((c) => el.classList[fn](c));
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
  updateSRC: (el, newVal, transforms) => {
    // Drill down to the desired field in the object
    newVal = traverseElementFields(newVal, el, "re-src");
    // Transform the value before rendering
    elementTransforms(el, transforms).forEach((t) => (newVal = t(newVal)));
    // Turn to string since the dom is gonna do this anyway.
    newVal = newVal.toString();
    // Conditially rerender
    if (newVal !== el.src) {
      el.src = newVal;
    }
  },
  updateAlt: (el, newVal, transforms) => {
    console.log("HEY re-alt", newVal);
    // Drill down to the desired field in the object
    newVal = traverseElementFields(newVal, el, "re-alt");
    console.log("re-alt", newVal);
    // Transform the value before rendering
    elementTransforms(el, transforms).forEach((t) => (newVal = t(newVal)));
    // Turn to string since the dom is gonna do this anyway.
    newVal = newVal.toString();
    // Conditially rerender
    if (newVal !== el.alt) {
      el.alt = newVal;
    }
  },
};

function elementStore(el, attr, stores) {
  const storeName = elementStoreName(el, attr);
  if (!storeName || !stores.hasOwnProperty(storeName))
    throw "invalid store name " + storeName;

  return stores[storeName];
}

function elementClassName(el) {
  const className = el.getAttribute("re-class-name");
  if (!className)
    throw new Error(
      "re-class must be acompanied by a re-class-name attribute with the name of the class in it"
    );
  return className;
}

function elementTransforms(el, transforms, attr = "re-transform") {
  const attribute = el.getAttribute(attr);
  if (!attribute) return [];

  const names = attribute
    .split(",")
    .map((s) => s.trim())
    .filter((v) => !!v);

  if (names.some((t) => !transforms.hasOwnProperty(t)))
    throw "ERROR Invalid transform " + attr;

  return names.map((name) => transforms[name]);
}

// ex: <re="storeName.field"> => storeName
function elementStoreName(el, attr) {
  const attrStr = el.getAttribute(attr);
  let firstPeriod = attrStr.indexOf(".");
  if (firstPeriod === -1) return attrStr;
  return attrStr.substring(0, firstPeriod);
}

function traverseElementFields(val, el, attr) {
  el.getAttribute(attr)
    .split(".")
    .slice(1) // skip the store's name
    .forEach((field) => (val = val[field]));

  return val;
}

// Some repeated queries
function notInArray(attr, query) {
  return `[${query || attr}]:not([re-array] [${attr}])`;
}

function notInArrayNotStartingWithThis(attr, query) {
  return `[${
    query || attr
  }]:not([re-array] [${attr}]):not([${attr}^="this."]):not([${attr}="this"])`;
}

function startsWithThis(attr) {
  return `[${attr}^="this."],[${attr}="this"]`;
}
