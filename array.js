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

  // Sooo much duplicated logic here and in _populateClone. Need to consolidate the stuff. Probably just the function itself can be taken out, like we did ROOT_ATTRS, since the query is so specific to this case and the array case
  updateField(itemData, field, fn) {
    const el = this._findElementWithPointer(itemData);
    if (!el) throw new Error("updateField element was not found");

    const attr = "re";
    el.querySelectorAll(`[${attr}^="this.${field}"]`).forEach((el) => {
      DOMINATOR.innerText(itemData, el, attr, this.transforms);
    });

    el.querySelectorAll(`[re-show^="this.${field}"]`).forEach((el) => {
      DOMINATOR.updateClass(
        el,
        itemData,
        this.transforms,
        "re-show",
        "re-show"
      );
    });

    el.querySelectorAll(`[re-class]`).forEach((el) => {
      if (field !== el.getAttribute("re-class").split(",")[1].trim()) {
        console.log("looking at the wrong class field");
        return;
      }
      DOMINATOR.updateClass(
        el,
        itemData,
        this.transforms,
        elementClassName(el),
        "re-class"
      );
    });

    el.querySelectorAll(`[re-src]`).forEach((el) => {
      DOMINATOR.updateSRC(el, itemData, this.transforms);
      console.log("LETS GO ALT!?!?!?!?!?!?");
      DOMINATOR.updateAlt(el, itemData, this.transforms);
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

    this._populateClone(clone, itemData);

    return clone;
  }

  _populateClone(clone, itemData) {
    const update = (attr, fn, query = null, otherQuery = null) => {
      // Perform changes on the clone itself in case of simple data
      if (clone.hasAttribute(attr)) fn(clone);
      // Update targeted children with the provided function
      const els = clone.querySelectorAll(notInArray(attr, query));
      els.forEach(fn);
      if (otherQuery) {
        const els = clone.querySelectorAll(notInArray(attr, otherQuery));
        els.forEach(fn);
      }
    };

    update(
      "re",
      (el) => DOMINATOR.innerText(itemData, el, "re", this.transforms),
      're^="this."',
      're="this"'
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
      're-show^="this."',
      're-show="this"'
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
      're-class^="this."',
      're-class="this"'
    );

    // TODO: what if the re-src is subscribing to a global store?
    update(
      "re-src",
      (el) => {
        DOMINATOR.updateSRC(el, itemData, this.transforms);
        DOMINATOR.updateAlt(el, itemData, this.transforms);
      },
      're-src^="this."',
      're-src="this"'
    );

    // There might be buddies subscribing to a global store
    {
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
              .forEach((el) =>
                DOMINATOR.innerText(v, el, attr, this.transforms)
              );
          });
        });
    }

    // There can be an array inside this array.
    {
      let attr = "re-array";
      clone.querySelectorAll(notInArray(attr)).forEach((el) => {
        const storeName = elementStoreName(el, attr);
        console.log("INNER ARRAY", el, storeName);
        // TODO: The store name can be a global array store or "this"
        if (storeName === "this") {
          let v = traverseElementFields(itemData, el, attr);
          console.log("traversed", itemData, v);
          // IDK about this
          if (!v || v.length === 0) return;

          if (!Array.isArray(v))
            throw new Error(
              "a 're-array' needs to reference to an array, not a type of:" +
                typeof v
            );

          // Now we want to clone the template and fill it out with our data
          // At least the template is guaranteed to still be there
          const template = el.querySelector("[re-template]");
          if (!template)
            throw new Error("a 're-array' needs a template as its first child");

          while (el.firstChild) {
            el.removeChild(el.lastChild);
          }

          v.forEach((item) => {
            const clone = template.cloneNode(true);
            clone.removeAttribute("re-template");
            console.log("populate clone");
            this._populateClone(clone, item);

            el.appendChild(clone);
          });

          // TODO: this is
        }
      });
    }

    return clone;
  }
}

// Just an interface
class ArraySubscriber {
  /**  @param {Array} newArray */
  set(newArray) {}
  append(val) {}
  deleteRow(data) {}
  overwriteRow(data, newData) {}
  /** @param {string} field @param {Function} fn */
  updateField(data, field, fn) {}
}
