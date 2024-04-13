class Reactinity {
  constructor() {
    /** Global map of stores you can search through when subscribing to stores at any point in the application life time. */
    this.STORES = {};
    /** Postprocessing functions to transform data before saving it to the store. */
    this.transforms = {};
  }

  defaultInit() {
    // Define your own data transforms to be used anywhere in the UI.
    this.useTransform("number", (val) => Number(val));
    this.useTransform("length", (val) => val.length);
    this.useTransform("mmddyy", (unix) => new Date(unix).toLocaleDateString());

    // Turn DOM elements reactive
    window.addEventListener("DOMContentLoaded", () => {
      this.attachAllElements();
      this.attachArrayElements();
    });
  }

  attachAllElements() {
    Object.entries(storeFunctions).forEach(([tag, fn]) => {
      document.querySelectorAll(`[${tag}]`).forEach((el) => {
        this.attachElement(el, tag, fn);
      });
    });
  }

  attachElement(el, tag, fn) {
    // The elemement itselt will contain the name of the store it wants to subscribe to in its "re-" attribute
    const id = el.getAttribute(tag);
    // The subscription may be to a specific inner field
    const levels = id.split(".");
    // The first name in the field list in the store name
    const store = this.STORES[levels[0]];
    if (!store)
      throw new Error(
        `[iSCream] You are attempting to subscribe to a store that is not in the global store: ${id} `
      );

    let transform = this.transforms[el.getAttribute("re-transform")];

    // Run the element's related storeFunctions to attach it to a store and other listeners
    const unsubscribe = fn(el, store, transform, levels.slice(1));

    // TODO: I dont even know what I am going to do with this but im goiong to leave it here for now
    Object.assign(el, { re_unsubscribe: unsubscribe });
  }

  /** Registers a data transformation function under a specific identifier. This allows you to use your own custom preprocessing to data before it is saved or updated in the store.*/
  useTransform(id, fun) {
    this.transforms[id] = fun;
  }

  getPostProcessor(id) {
    return this.transforms[id];
  }

  /** Creates and registers a new store with a unique identifier and an initial value.  If a store with the same identifier already exists, it throws an error to prevent overwriting.  */
  newStore(id, initialValue) {
    if (!this.STORES[id]) {
      this.STORES[id] = new Store(initialValue);
      return this.STORES[id];
    }
    throw new Error(`[iScream] a store with the id '${id}' already exists`);
  }

  newArrayStore(id, initialValue) {
    if (!this.STORES[id]) {
      this.STORES[id] = new ArrayStore(initialValue);
      return this.STORES[id];
    }
    throw new Error(`[iScream] a store with the id '${id}' already exists`);
  }

  attachArrayElements() {
    document.querySelectorAll("[re-array]").forEach((parent) => {
      const storeName = parent.getAttribute("re-array");
      const arrayStore = this.STORES[storeName];
      if (!arrayStore)
        throw new Error(
          `[iSCream] You are attempting to subscribe to an ArrayStore that does not exist: "${storeName}" `
        );

      // Fancy subscribe to respond to fine grained updates
      const sub = new ArrayStoreUISubscriber(parent, this.transforms);

      arrayStore.subscribe(sub);
    });
  }
}
/** Define the key functionality of the library, keyed by the attribute on the element to be updated. Reactinity will look for elements with the attributes in each of the keys and subscribe them accordingly */
const storeFunctions = {
  // Change the innerHTML of an element every time the related store changes
  "re-innerhtml": (el, store, transform, fields) => {
    return store.subscribe((val) => {
      let v = val;
      // Go down the children of the object
      for (let i = 0; i < fields.length; i++) {
        v = v[fields[i]];
      }

      // Prettify the value for the UI
      if (transform) {
        v = transform(v);
      }

      // Conditionally re-render. Using the DOM as our state manager here so can only do this check after prepocessing
      if (el.innerHTML !== v) {
        el.innerHTML = v;
      }
    });
  },
  // Edit the store value when its value changes, and change its value when the store changes
  "re-bind": (el, store, transform) => {
    // Update the store at element input
    el.addEventListener("input", () => {
      let v = el.value;
      if (transform) v = transform(v);
      store.set(v);
    });

    // Update element value at store change
    return store.subscribe((val) => {
      // FUTURE: Totes raw-doggin the value here, i guess this is why i wanted the preprocessor stuff. Maybe there is a better way to do this subscribing
      if (el.value !== val) {
        el.value = val;
      }
    });
  },

  "re-show": (el, store, transform) => {
    return store.subscribe((val) => {
      let v = val;
      if (transform) {
        v = transform(v);
      }
      // Force into a boolean
      v = !!v;
      if (v && !el.classList.contains("re-show")) {
        el.classList.add("re-show");
      } else if (!v && el.classList.contains("re-show")) {
        el.classList.remove("re-show");
      }
    });
  },
  // TODO: This is not done yet!
  "re-form": (el, store, transform) => {
    // TODO: SHOULD WE SUBSCRIBE TO THE STORE and update the form data accordingly? that sounds a little confusing but may be necessary. imagine multiple forms in a page showing the same field. w would need to update it. can update it only if havent changed it yet, cus maybe we are in the middle of filling out a form and dont want it ot get overwritten

    // Start the form data by cloning the object so we can safely modify it in the form fields
    // TODO: maybe we should start out not even cloning it, and the nif it changes we toggle a flag and clone it to change it.
    const formData = structuredClone(store.value);
    // TODO: ShOuld we highjack the onChange as well so that users can see everytime the form changes?
    // TODO: I think it could be useful to have a way to find out if a value has changed
    // highjack on submit
    const original = el.onsubmit;
    el.onsubmit = null;
    el.removeAttribute("onsubmit");
    // Now we write our event customization layer so that the user has easy access to the item in the array related to the button being clicked
    el.addEventListener("submit", (event) => {
      event = Object.assign(event, { reData: formData });
      original(event);
    });

    // listen to values, set defaults
    const updateField = (field) => (e) => {
      // TODO: transform this value first, but need access to all the transforms or to pass the transform into the element and read it from it, idk whats worse
      let v = e.target.value;
      if (formData[field] !== v) {
        formData[field] = v;
      }
      // TODO: check things like "checked" for checkboxes, there is a lot of work to be done here, but its enough for the text thingy
    };

    let attributeName = "re-value";

    let tag = "[" + attributeName + "^=_]"; // starts with _
    const elements = document.querySelectorAll(tag);

    elements.forEach((formElement) => {
      let fieldName = formElement.getAttribute(attributeName);
      const prefix = "_.";
      if (!fieldName.startsWith(prefix)) throw (`invalid shit`, fieldName);

      const firstComma = fieldName.indexOf(",");
      fieldName = fieldName.slice(
        prefix.length,
        firstComma !== -1 ? firstComma : fieldName.length
      );

      const update = updateField(fieldName);
      // Update now!
      // TODO: transform this value first, but need access to all the transforms or to pass the transform into the element and read it from it, idk whats worse
      formElement.value = formData[fieldName];
      // Update when anything in the form potentially changes
      formElement.addEventListener("input", update);
      formElement.addEventListener("change", update);
      formElement.addEventListener("click", update);
      formElement.addEventListener("keyup", update);
      formElement.addEventListener("paste", update);
    });
  },
};

/**
 * The Store class encapsulates a piece of state, providing methods to subscribe to state changes, set new state values, and apply transformations to the current state.
 * It serves as the core of the state management system, enabling reactive data binding and updates throughout the application.
 * - `subscribe` allows listening for changes to the state.
 * - `set` updates the state's value and notifies all subscribers.
 * - `update` applies a transformation function to the state and updates subscribers with the new value. Your function must return the new value.
 */
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

class ArrayStore {
  constructor(array) {
    /** @type {Array}*/
    this.array = array;
    this.callbackSubscribers = [];
    this.fancySubscribers = [];
  }

  get() {
    return this.array;
  }

  subscribe(subscriber) {
    // A subscriber has the same public interface as the array store (except for the subscribe function)
    if (typeof subscriber === "function") {
      this.callbackSubscribers.push(subscriber);
      subscriber(this.array);
      return;
    }

    this.fancySubscribers.push(subscriber);
    // run the overwrite function immediately
    subscriber.set(this.array);
  }

  append(val) {
    this.array.push(val);
    this.fancySubscribers.forEach((s) => s.append(val));
    this.callbackSubscribers.forEach((c) => c(this.array));
  }

  set(newArray) {
    this.array = newArray;
    this.fancySubscribers.forEach((s) => s.set(newArray));
    this.callbackSubscribers.forEach((c) => c(this.array));
  }

  // An idea for how to interact with a specific row in a way that sort of fits the normal flow of logic anyway, of checkforpresence->do something if some value if somethimg->update the data accordingly. I don't knwo that we need this to be a separate logic layer like this but it feels kinda good to use!
  GETROW(where) {
    const row = this.array.find(where);
    if (!row) return undefined;
    return {
      updateField: (field, fn) => {
        row[field] = fn(row[field]);

        this.callbackSubscribers.forEach((c) => c(this.array));

        this.fancySubscribers.forEach((s) => {
          s.updateField(row, field, fn);
        });
      },
      delete: () => {
        const i = this.array.findIndex((r) => r === row);
        if (i === -1) return;
        this.array.splice(i, 1);

        // TODO: Do we have to unsubscribe??

        this.callbackSubscribers.forEach((c) => c(this.array));

        this.fancySubscribers.forEach((s) => {
          s.deleteRow(row);
        });
      },
      overwrite: (newVal) => {
        const i = this.array.findIndex((r) => r === row);
        if (i === -1) return;
        this.array.splice(i, 1, newVal);

        // TODO: Do we have to unsubscribe??

        this.callbackSubscribers.forEach((c) => c(this.array));

        this.fancySubscribers.forEach((s) => {
          s.overwriteRow(row, newVal);
        });
      },
      data: row,
    };
  }

  // TODO: rewrite
  // insert(val, index = 0) {
  //   this.arr.splice(index, 0, val);

  //   pushListeners.forEach((method) => method(val, index));
  //   this.subs.forEach((method) => method(val));
  // }
}
/* subscribe: subscribeAsArray,
    subscribeAsMap: subscribe,
    // Allow the setting to come as arrays to match the subscribe
    set: overwrite,
    overwrite,
    overwriteItem,
    remove,
    append,
    appendAtStart,
    concat,
    getAll,
    getByID,
    getByField,
    getField,
    setField,
    updateField,*/

class ArrayStoreUISubscriber {
  constructor(parentElement, transforms) {
    this.parent = parentElement;
    this.template = this.parent.querySelector("[re-template]");
    this.transforms = transforms;
  }

  append(val) {
    const el = cloneTemplate(val, this.template, this.transforms);
    this.parent.append(el);
  }

  set(newArray) {
    while (this.parent.firstChild) {
      this.parent.removeChild(this.parent.lastChild);
    }

    this.parent.append(
      ...newArray.map((val) =>
        cloneTemplate(val, this.template, this.transforms)
      )
    );
  }

  updateField(data, field, fn) {
    const el = Array.from(this.parent.children).find((el) => {
      return el.DIRTYDATA === data;
    });

    const transformWithElement = (v, el) => {
      const transform = this.transforms[el.getAttribute("re-transform")];
      if (transform) return transform(v);
      return v;
    };

    const els = el.querySelectorAll(`[re-field="${field}"]`);
    els.forEach((el) => {
      let v = transformWithElement(data[field], el);
      if (v !== el.innerHTML) {
        el.innerHTML = v;
      }
    });

    el.querySelectorAll(`[re-show-field="${field}"]`).forEach((el) => {
      let v = transformWithElement(data[field], el);
      // Coerse into a boolean to avoid some javascript edge cases
      v = !!v;

      const isShowing = el.classList.contains("re-show");
      if (v && !isShowing) {
        el.classList.add("re-show");
      } else if (!v && isShowing) {
        el.classList.remove("re-show");
      }
    });

    el.querySelectorAll(`[re-class-field]`).forEach((el) => {
      if (field !== el.getAttribute("re-class-field").split(",")[1].trim()) {
        console.log("looking at the wrong class field");
        return;
      }
      updateClass(el, data, this.transforms);
    });
  }

  deleteRow(data) {
    const el = Array.from(this.parent.children).find((el) => {
      return el.DIRTYDATA === data;
    });

    this.parent.removeChild(el);
  }

  overwriteRow(data, newData) {
    const el = Array.from(this.parent.children).find((el) => {
      return el.DIRTYDATA === data;
    });

    const newNode = cloneTemplate(newData, this.template, this.transforms);
    this.parent.insertBefore(newNode, el);
    this.parent.removeChild(el);
  }
}

function cloneTemplate(item, template, transforms) {
  const clone = template.cloneNode(true);
  clone.removeAttribute("re-template");

  // We will use the DIRTYDATA field to find the this element later. In a way we are using the pointer value as the item/element id. So ideally we don't need any extra memory other than our extra pointer value in the clone element.
  Object.assign(clone, { DIRTYDATA: item });

  clone.querySelectorAll("[re-field]").forEach((el) => {
    const field = el.getAttribute("re-field");
    const transName = el.getAttribute("re-transform");

    const transform = transforms[transName] || ((v) => v);
    el.innerHTML = transform(item[field]);
  });

  clone.querySelectorAll("[re-show-field]").forEach((el) => {
    const field = el.getAttribute("re-show-field");
    const transName = el.getAttribute("re-transform");
    const transform = transforms[transName];

    let v = item[field];
    if (transform) v = transform(v);
    v = !!v;
    if (v && !el.classList.contains("re-show")) {
      el.classList.add("re-show");
    } else if (!v && el.classList.contains("re-show")) {
      el.classList.remove("re-show");
    }
  });

  clone.querySelectorAll("[re-class-field]").forEach((el) => {
    updateClass(el, item, transforms);
  });

  clone.querySelectorAll("[re-click]").forEach((el) => {
    // Hijack the click behavior. We do this to allow the user to use good old html and then we come in and add the item data to the click event to make that easy-peasy
    const original = el.onclick;
    el.onclick = null;
    el.removeAttribute("onclick");
    // Now we write our event customization layer so that the user has easy access to the item in the array related to the button being clicked
    el.addEventListener("click", (event) => {
      event = Object.assign(event, { item });
      original(event);
    });
  });

  console.log("arrs?", clone.hasAttribute("re-click"));
  if (clone.hasAttribute("re-click")) {
    const original = clone.onclick;
    clone.onclick = null;
    clone.removeAttribute("onclick");
    // Now we write our event customization layer so that the user has easy access to the item in the array related to the button being clicked
    clone.addEventListener("click", (event) => {
      console.log("clicked", item);
      event = Object.assign(event, { item });
      original(event);
    });
  }

  return clone;
}

function updateClass(el, item, allTransforms) {
  const attr = el.getAttribute("re-class-field");
  const fields = attr.split(",").map((s) => s.trim());

  if (fields.length < 3)
    throw `invalid class field format "${attr}". Expected "className,field,transforms".`;
  const [className, field, ...transforms] = fields;
  let v = item[field];
  if (transforms && transforms.length > 0)
    transforms.forEach((transform) => {
      v = allTransforms[transform](v);
    });
  v = !!v;
  if (v && !el.classList.contains(className)) {
    el.classList.add(className);
  } else if (!v && el.classList.contains(className)) {
    el.classList.remove(className);
  }
}
