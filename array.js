/**
 * @interface ArraySubscriber
 * Allows for fine grained updates
 *
 * @method append
 * @param {*} val
 *
 * @method set
 * @param {Array} newArray
 *
 * @method updateField
 * @param {*} data
 * @param {string} field
 * @param {Function} fn
 *
 * @method deleteRow
 * @param {*} data
 *
 * @method overwriteRow
 * @param {*} data
 * @param {*} newData
 */

// ArrayStore is a variant of a store that allows for fine grained updates to arrays and their elements. It allows for normal subscription and well as a fancy subscription that gets called at every specific update allows for efficient dom updates targeting what is changing
class ArrayStore {
  constructor(array) {
    /** @type {Array}*/
    this.array = array;
    /** @type {Array<Function>} */
    this.callbackSubscribers = [];
    /** @type {Array<ArraySubscriber>} */
    this.fancySubscribers = [];
  }

  get() {
    return this.array;
  }

  subscribe(subscriber) {
    const remove = (arr, item) => {
      const i = arr.findIndex((s) => s === item);
      if (i === -1) throw "array unsubscribe failed to find sub";
      arr.splice(i, 1);
    };

    // A subscriber has the same public interface as the array store (except for the subscribe function)
    switch (typeof subscriber) {
      case "function":
        // We keep functions with the simple callbacks
        this.callbackSubscribers.push(subscriber);
        // Run the subscriber callback immediately
        subscriber(this.array);
        // Return unsubscribe
        return () => remove(this.callbackSubscribers, subscriber);

      // More complex subscriber objects have hooks for each array function, so we keep them separate
      case "object":
        this.fancySubscribers.push(subscriber);
        subscriber.set(this.array);
        return () => remove(this.fancySubscribers, subscriber);

      default:
        throw "Invalid subscriber";
    }
  }

  set(newArray) {
    this.array = newArray;
    this.broadcastChange((s) => s.set(newArray));
  }

  append(val) {
    this.array.push(val);
    this.broadcastChange((s) => s.append(val));
  }

  /** Find a row in the store with the provided function, and wraps it with method to edit it reactively */
  getEditableRow(where) {
    const row = this.array.find(where);
    if (!row) return undefined;
    return new EditableRow(row, this);
  }

  // PRIVATE?
  broadcastChange(fancyCallback) {
    this.callbackSubscribers.forEach((c) => c(this.array));
    this.fancySubscribers.forEach(fancyCallback);
  }
}

class ArrayStoreUISubscriber {
  constructor(parentElement, transforms) {
    this.parent = parentElement;
    this.template = this.parent.querySelector("[re-template]");
    this.transforms = transforms;
  }

  append(val) {
    const el = this.cloneTemplate(val, this.template, this.transforms);
    this.parent.append(el);
  }

  set(newArray) {
    while (this.parent.firstChild) {
      this.parent.removeChild(this.parent.lastChild);
    }

    this.parent.append(
      ...newArray.map((val) =>
        this.cloneTemplate(val, this.template, this.transforms)
      )
    );
  }

  updateField(data, field, fn) {
    // Find the element that is pointing to this data
    const el = Array.from(this.parent.children).find((el) => {
      return el.POINTER_TO_DATA === data;
    });

    const attr = "re";

    el.querySelectorAll(`[${attr}="${field}"]`).forEach((el) => {
      console.log("set field thing", { data, el });
      DOMINATOR.innerText(data, el, attr, this.transforms);
    });

    // TODO: Should probably start here

    // TODO: basic.js has better functions for this
    const transformWithElement = (v, el) => {
      const transform = this.transforms[el.getAttribute("re-transform")];
      if (transform) return transform(v);
      return v;
    };

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
      return el.POINTER_TO_DATA === data;
    });

    // TODO: perform unsubscribe?
    console.log("deleting ROW", el, el._unsubs);
    this.parent.removeChild(el);
  }

  overwriteRow(data, newData) {
    const el = Array.from(this.parent.children).find((el) => {
      return el.POINTER_TO_DATA === data;
    });

    const newNode = this.cloneTemplate(newData, this.template, this.transforms);
    this.parent.insertBefore(newNode, el);

    // TODO: perform unsubscribe?
    console.log("overwriteRow", el, el._unsubs);
    this.parent.removeChild(el);
  }

  cloneTemplate(itemData) {
    const clone = this.template.cloneNode(true);
    clone.removeAttribute("re-template");

    // We will use the POINTER_TO_DATA field to find the this element later. In a way we are using the pointer value as the item/element id. So ideally we don't need any extra memory other than our extra pointer value in the clone element.
    Object.assign(clone, { POINTER_TO_DATA: itemData });

    // TODO: Just use [re], field is now dictated with "this" as the store name
    clone.querySelectorAll("[re-field]").forEach((el) => {
      // TODO: basic.js has better functions
      const field = el.getAttribute("re-field");
      const transName = el.getAttribute("re-transform");

      const transform = this.transforms[transName] || ((v) => v);
      el.innerHTML = transform(itemData[field]);
    });

    clone.querySelectorAll("[re-show-field]").forEach((el) => {
      // TODO: use updateClass or break this out into a better function for all classes
      const field = el.getAttribute("re-show-field");
      const transName = el.getAttribute("re-transform");
      const transform = this.transforms[transName];

      let v = itemData[field];
      if (transform) v = transform(v);
      v = !!v;
      if (v && !el.classList.contains("re-show")) {
        el.classList.add("re-show");
      } else if (!v && el.classList.contains("re-show")) {
        el.classList.remove("re-show");
      }
    });

    clone.querySelectorAll("[re-class-field]").forEach((el) => {
      updateClass(el, itemData, this.transforms);
    });

    // TODO: should re-clicks get a field value? maybe a "this" most of the time, but what if we want to pass this.ass ? may be way too much of a hassle, just let the user do it, we are already giving them the object so they can write the exact same thing in the receiver function instead
    clone.querySelectorAll("[re-click]").forEach((el) => {
      // Hijack the click behavior. We do this to allow the user to use good old html and then we come in and add the item data to the click event to make that easy-peasy
      const original = el.onclick;
      el.onclick = null;
      el.removeAttribute("onclick");
      // Now we write our event customization layer so that the user has easy access to the item in the array related to the button being clicked
      el.addEventListener("click", (event) => {
        event = Object.assign(event, { item: itemData });
        original(event);
      });
    });

    if (clone.hasAttribute("re-click")) {
      // TODO: Break this out into a general function
      const original = clone.onclick;
      clone.onclick = null;
      clone.removeAttribute("onclick");
      // Now we write our event customization layer so that the user has easy access to the item in the array related to the button being clicked
      clone.addEventListener("click", (event) => {
        event = Object.assign(event, { item: itemData });
        original(event);
      });
    }

    return clone;
  }
}

/**  Represents an editable row within a data store and provides methods to manipulate and track changes to a specific row. */
class EditableRow {
  constructor(row, arrayStore) {
    this.row = row;
    this.arrayStore = arrayStore;
  }

  get() {
    return this.val;
  }

  /** Updates a specified field in the row using a provided function and broadcasts the change. */
  updateField(field, updateFn) {
    // TODO: should i allow for field inside field? like a.b.c["d"]
    this.row[field] = updateFn(this.row[field]);

    this.arrayStore.broadcastChange((s) => {
      s.updateField(this.row, field, updateFn);
    });
  }

  /**  Deletes the current row from the array store and broadcasts the deletion. */
  delete() {
    const i = this.arrayStore.array.findIndex((r) => r === this.row);
    if (i === -1) return;
    this.arrayStore.array.splice(i, 1);

    this.arrayStore.broadcastChange((s) => {
      s.deleteRow(this.row);
    });
  }

  /** Replaces the current row with a new value in the array store and broadcasts the update. */
  overwrite(newVal) {
    const i = this.arrayStore.array.findIndex((r) => r === this.row);
    if (i === -1) return;
    this.arrayStore.array.splice(i, 1, newVal);

    this.arrayStore.broadcastChange((s) => {
      s.overwriteRow(this.row, newVal);
    });
  }
}
