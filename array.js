// ArrayStore is a variant of a store that allows for fine grained updates to arrays and their elements. It allows for normal subscription and well as a fancy subscription that gets called at every specific update allows for efficient dom updates.
class ArrayStore {
  constructor(array) {
    /** @type {Array}*/
    this.array = array;
    /** @type {Array<Function | ArraySubscriber>} */
    this.subscribers = [];
  }

  get() {
    return this.array;
  }

  subscribe(subscriber) {
    this.subscribers.push(subscriber);

    // Call the subscribe immediately
    if (typeof subscriber === "function") subscriber(this.array);
    else subscriber.set(this.array);

    // Return unsubscribe function
    return () => {
      const i = this.subscribers.findIndex((s) => s === subscriber);
      if (i === -1) throw "array unsubscribe failed to find sub";
      this.subscribers.splice(i, 1);
    };
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

  /** Alert subscribers the array has changed. Simple subscribers get a full item update, while the fancy subs get the finer grained update provided.
   * @param {function(ArraySubscriber)} fancyCallback
   */
  broadcastChange(fancyCallback) {
    this.subscribers.forEach((s) => {
      if (typeof subscriber === "function") s(this.array);
      fancyCallback(s);
    });
  }
}

/** Represents an editable row within a data store and provides methods to manipulate and track changes to a specific row. */
class EditableRow {
  /**  @param {ArrayStore} arrayStore  */
  constructor(row, arrayStore) {
    this.row = row;
    this.arrayStore = arrayStore;
  }

  get() {
    return this.row;
  }

  /** Updates a specified field in the row using a provided function and broadcasts the change. */
  updateField(field, updateFn) {
    this.row[field] = updateFn(this.row[field]);

    this.arrayStore.broadcastChange((s) => {
      s.updateField(this.row, field, updateFn);
    });
  }

  /** Deletes our row from the array store and broadcasts the deletion. */
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

// Just an interface
class ArraySubscriber {
  /**  @param {Array} newArray */
  set(newArray) {}
  append(val) {}
  deleteRow(data) {}
  overwriteRow(data, newData) {}
  /** @param {*} data @param {string} field @param {Function} fn */
  updateField(data, field, fn) {}
}

// TODO: Now we do this part!

class ArrayStoreUISubscriber {
  constructor(parentElement, stores, transforms) {
    this.parent = parentElement;
    this.stores = stores;
    this.transforms = transforms;

    this.storesISubscribeTo = [];
    // An array container will have a template to be repeated
    this.template = this.parent.querySelector("[re-template]");
    if (!this.template)
      console.error("re-array does not have a re-template child");
    // It may have an empty template for when the array in empty
    this.emptyTemplate = this.parent.querySelector("[re-template-empty]");
  }

  set(newArray) {
    while (this.parent.firstChild) {
      this._removeChild(this.parent.lastChild);
    }

    newArray.forEach((row) => this.append(row));
  }

  append(row) {
    const el = this._cloneTemplate(row);
    this.parent.append(el);
  }

  deleteRow(data) {
    const el = this._findElementWithPointer(data);
    if (!el) throw new Error("deleteRow element was not found");

    this._removeChild(el);
  }

  overwriteRow(data, newData) {
    const el = this._findElementWithPointer(data);
    if (!el) throw new Error("overwriteRow element was not found");

    const newNode = this._cloneTemplate(newData);
    this.parent.insertBefore(newNode, el);
    this._removeChild(el);
  }

  updateField(data, field, fn) {
    const el = this._findElementWithPointer(data);
    console.log("updateField", { el, data });
    if (!el) throw new Error("updateField element was not found");

    const attr = "re";
    console.log(
      "elements with re ",
      el.querySelectorAll(`[${attr}^="this.${field}"]`)
    );
    el.querySelectorAll(`[${attr}^="this.${field}"]`).forEach((el) => {
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

      newVal = traverseElementFields(newVal, el, tag);
      // Transform the value before rendering
      elementTransforms(el, transforms).forEach((t) => (newVal = t(newVal)));

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

  _findElementWithPointer(pointer) {
    for (let i = 0; i < this.parent.children.length; i++) {
      const el = this.parent.children[i];
      if (el.POINTER_TO_DATA === pointer) return el;
    }
  }

  _removeChild(el) {
    this.parent.removeChild(el);

    // TODO: Should i unsubscribe?
    console.log("_removeChild", { el, unsubs: el._unsubs });
  }

  _cloneTemplate(itemData) {
    const clone = this.template.cloneNode(true);
    clone.removeAttribute("re-template");

    // We will use the POINTER_TO_DATA field to find the this element later. In a way we are using the pointer value as the item/element id. So ideally we don't need any extra memory other than our extra pointer value in the clone element.
    Object.assign(clone, { POINTER_TO_DATA: itemData });

    // Populate field subscribers

    const update = (attr, fn, query = null) => {
      // Perform changes on the clone itself in case of simple data
      if (clone.hasAttribute(attr)) fn(clone);
      // Update targeted children with the provided function
      const els = clone.querySelectorAll(notInArray(attr, query));
      els.forEach(fn);
    };

    // TODO: what if the subscribing is to a different store, but we havent subscribed it yet because it was inside a template
    update(
      "re",
      (el) => DOMINATOR.innerText(itemData, el, "re", this.transforms),
      're^="this."'
    );

    // Modify the onclick event to include our item data
    update("re-click", (el) => DOMINATOR.highjackClick(itemData, el));

    // Conditionally reveal item listeners
    update(
      "re-show",
      (el) =>
        DOMINATOR.updateClass(
          el,
          itemData,
          this.transforms,
          "re-show",
          "re-show"
        ),
      're-show^="this."'
    );

    // Conditionally add class to item listeners
    update(
      "re-class",
      (el) => {
        let className = elementClassName(el);
        DOMINATOR.updateClass(
          el,
          itemData,
          this.transforms,
          className,
          "re-class"
        );
      },
      're-class^="this."'
    );

    // There might be buddies subscribing to a global store
    let attr = "re";

    clone
      .querySelectorAll(notInArrayNotStartingWithThis(attr))
      .forEach((el) => {
        const store = elementStore(el, attr, this.stores);
        // Update the contents based on the current store value
        DOMINATOR.innerText(store.get(), el, attr, this.transforms);

        if (this.storesISubscribeTo.includes(store)) {
          return;
        }
        // Subscribe to the store just once at the array level so we don't end up with thousands of subscriptions going for large arrays
        this.storesISubscribeTo.push(store);

        store.subscribe((v) => {
          const storeName = elementStoreName(el, attr);
          this.parent
            .querySelectorAll(`[${attr}^=${storeName}]`)
            .forEach((el) => DOMINATOR.innerText(v, el, attr, this.transforms));
        });
      });
    return clone;
  }
}
