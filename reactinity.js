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
    this.attachAllElements2();
  }

  attachAllElements2() {
    Object.entries(INITIALIZATIONS).forEach(([tag, subscribeElement]) => {
      document.querySelectorAll(`[${tag}]`).forEach((el) => {
        const storeName = storeNameFromEl(el, tag);
        if (!storeName)
          throw new Error(
            `[iSCream] You need a store name to subscribe with '${tag}'`
          );

        // Ignore child listeners
        if (storeName === "_") {
          return;
        }

        const store = this.STORES[storeName];
        if (!store)
          throw new Error(
            `[iSCream] You are '${tag}' to subscribe to a store that does not exist: ${storeName} `
          );

        // Re-render the element when the store changes
        const unsub = subscribeElement(el, store, this.transforms, tag);

        // TODO: Should we be able to give ids to subscrptions? so that we can unsubscribe from the outsite? so when we delete the element that is subscribing we can unsub thorugh its pointer as id
        if (unsub) {
          if (el._unsubs) el._unsubs.push(unsub);
          else Object.assign(el, { _unsubs: [unsub] });
        }
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
    document
      .querySelectorAll('[re-array]:not([re-array^="_"])')
      .forEach((parent) => {
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
      if (v) {
        // Go down the children of the object
        for (let i = 0; i < fields.length; i++) {
          v = v[fields[i]];
        }
      }

      // Prettify the value for the UI
      if (transform) {
        v = transform(v);
      }

      // TODO: Transform to string since thats what the dom is going to do any way?

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
      let v = e.target.value || "";

      // The field may be in the form of abs
      const fields = field.split(".");
      // let currVal = fields.reduce((acc,field)=>acc[field],formData);
      let i = 0;
      let obj = formData;
      while (i < fields.length - 1) {
        obj = obj[fields[i]];
        i += 1;
      }

      if (obj[fields[i]] !== v) {
        obj[fields[i]] = v;
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
      formElement.value = fieldName
        .split(".")
        .reduce((acc, field) => acc[field], formData);
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
      console.log(
        "deleting",
        this.parent.lastChild,
        this.parent.lastChild._unsubs
      );
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

    console.log("deleting ROW", el, el._unsubs);
    this.parent.removeChild(el);
  }

  overwriteRow(data, newData) {
    const el = Array.from(this.parent.children).find((el) => {
      return el.DIRTYDATA === data;
    });

    const newNode = cloneTemplate(newData, this.template, this.transforms);
    this.parent.insertBefore(newNode, el);
    console.log("overwriteRow", el, el._unsubs);
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

  if (clone.hasAttribute("re-click")) {
    const original = clone.onclick;
    clone.onclick = null;
    clone.removeAttribute("onclick");
    // Now we write our event customization layer so that the user has easy access to the item in the array related to the button being clicked
    clone.addEventListener("click", (event) => {
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

const INITIALIZATIONS = {
  // The basic element binding simply listens to the store, and sets its innerText to a transform of its value
  re: (el, store, transforms, attr) => {
    return store.subscribe((val) => {
      UPDATES.innerText(el, val, transforms, attr);
    });
  },
  //
  "re-value": (el, store, transforms, attr) => {
    // Update the store at element input
    listenToValue(el, store, transforms, attr);

    // Update element value at store change
    return store.subscribe((val) => {
      UPDATES.value(el, val, transforms, attr);
    });
  },
};

const UPDATES = {
  innerText: (el, val, transforms, attr) => {
    if (val === null || val === undefined) {
      el.innerText = "";
      return;
    }
    // Read the field componsition from the element attribute
    const fields = el.getAttribute(attr);
    // ignoring first cus we already took care of the store name by this point
    let v = readField(val, fields, true, transforms);
    // To string makes it comparable to the dom
    v = v.toString();
    // Conditionally re-render. Since we use the DOM as our state manager we can only do this check after prepocessing
    if (el.innerText === v) return;
    el.innerText = v;
  },
  value: (el, val, transforms, attr) => {
    // Read the field componsition from the element attribute
    const fields = el.getAttribute(attr);
    // Ignore first cus we already took care of the store name by this point
    let v = readField(val, fields, true, transforms);
    // Update the value of element in the DOM
    if (el.value === v) return;
    el.value = v;
    // TODO: what if element is not a textbox? checkbox, radio, select. i need to do checked and such checks
  },
};

function listenToValue(el, store, transforms, attr) {
  // Update the store at element input
  // TODO: just input is not enough! need to listen to change, click, keyup, stuff like that
  el.addEventListener("input", () => {
    let v = el.value;
    const tag = el.getAttribute(attr);

    let firstComma = tag.indexOf(",");
    // There may be no transforms, so raw dog the value
    if (firstComma !== -1) {
      // Perform all transforms sequentially
      walkWord(
        tag,
        (field) => {
          if (transforms[field]) v = transforms[field](v);
        },
        ",",
        firstComma + 1,
        tag.length
      );
    } else {
      firstComma = tag.length;
    }

    // Update the value, or a field value
    const fields = tag.substr(0, firstComma).split(".");
    if (fields <= 1) {
      if (store.value !== v) {
        store.set(v);
      }
    } else {
      updateStoreField(store, fields, v);
    }
  });
}

// READ STRINGS -----
function storeNameFromEl(el, attributeName) {
  let attr = el.getAttribute(attributeName);

  if (!attr) return "";

  let end = attr.indexOf(",");
  if (end === -1) end = attr.length;

  let firstPeriod = attr.indexOf(".");
  if (firstPeriod === -1) firstPeriod = attr.length;

  if (end > firstPeriod) {
    end = firstPeriod;
  }

  return attr.substr(0, end);
}
// field strings can be like "asdf", "user.name", "user.mom.age","_.color.hex"
function readField(obj, fieldString, ignoreFirst, transforms) {
  fieldString = fieldString.trim();

  let ans = obj;

  let firstComma = fieldString.indexOf(",");
  if (firstComma === -1) firstComma = fieldString.length;

  // Get the value
  // The first parameter find the data node by doing down the fields in the data object
  walkWord(
    fieldString,
    (field, index) => {
      if (ignoreFirst && index === 0) {
        return;
      }
      ans = ans[field];
    },
    ".",
    0,
    firstComma
  );

  // Every remaining words are the names of transforms to be applied in order to the target value
  walkWord(
    fieldString,
    (field, index) => {
      const transform = transforms[field];
      if (transform) {
        ans = transform(ans);
      }
    },
    ",",
    firstComma + 1,
    fieldString.length
  );

  return ans;
}

function walkTransform(v, fieldString, tag, transforms) {
  let firstComma = fieldString.indexOf(",");
  // There may be no transforms, so raw dog the value
  if (firstComma !== -1) {
    // Perform all transforms sequentially
    walkWord(
      tag,
      (field) => transforms[field] && (v = transforms[field](v)),
      ",",
      firstComma + 1,
      tag.length
    );
  }

  return v;
}

// Helper string to walk a string from a start to an end, performing the provided function every time it finds a "separator" character, calling it with the string behind it
function walkWord(str, fn, separator, start = 0, end = null) {
  if (end === null) end = str.length;

  let i = start;
  while (i < end) {
    if (str[i] !== separator) {
      i++;
      continue;
    }
    // Reached a separator, so everything behind us is a field
    let field = str.substr(start, i - start);
    // Perform user action
    fn(field, start);
    // Move on to the next word
    i++;
    start = i;
  }

  let field = str.substr(start, i - start);
  fn(field, start);
}

function updateStoreField(store, fields, v) {
  store.update((storeVal) => {
    let i = 1;
    let obj = storeVal;
    // Go down to the last level
    while (i < fields.length - 1) {
      obj = obj[fields[i]];
      i++;
    }
    // Update last field value
    const f = fields[fields.length - 1];
    if (obj[f] !== v) {
      obj[f] = v;
    }
    return storeVal;
  });
}
