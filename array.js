// ArrayStore is a variant of a store that allows for fine grained updates to arrays and their elements. It allows for normal subscription and well as a fancy subscription that gets called at every specific update allows for efficient dom updates targeting what is changing
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
      return () => {
        const i = this.callbackSubscribers.findIndex((s) => s === subscriber);
        if (i === -1) throw "array unsubscribe failed to find sub";
        this.callbackSubscribers.splice(i, 1);
      };
    }

    this.fancySubscribers.push(subscriber);
    // run the overwrite function immediately
    subscriber.set(this.array);
    return () => {
      const i = this.fancySubscribers.findIndex((s) => s === subscriber);
      if (i === -1) throw "array unsubscribe failed to find sub";
      this.fancySubscribers.splice(i, 1);
    };
  }

  append(val) {
    this.array.push(val);
    this.callbackSubscribers.forEach((c) => c(this.array));
    this.fancySubscribers.forEach((s) => s.append(val));
  }

  set(newArray) {
    this.array = newArray;
    this.callbackSubscribers.forEach((c) => c(this.array));
    this.fancySubscribers.forEach((s) => s.set(newArray));
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

    const attr = "re-field";

    el.querySelectorAll(`[${attr}="${field}"]`).forEach((el) => {
      DOMINATOR.innerText(data, el, attr, this.transforms);
    });

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

    console.log("deleting ROW", el, el._unsubs);
    this.parent.removeChild(el);
  }

  overwriteRow(data, newData) {
    const el = Array.from(this.parent.children).find((el) => {
      return el.POINTER_TO_DATA === data;
    });

    const newNode = this.cloneTemplate(newData, this.template, this.transforms);
    this.parent.insertBefore(newNode, el);
    console.log("overwriteRow", el, el._unsubs);
    this.parent.removeChild(el);
  }

  cloneTemplate(itemData) {
    const clone = this.template.cloneNode(true);
    clone.removeAttribute("re-template");

    // We will use the POINTER_TO_DATA field to find the this element later. In a way we are using the pointer value as the item/element id. So ideally we don't need any extra memory other than our extra pointer value in the clone element.
    Object.assign(clone, { POINTER_TO_DATA: itemData });

    clone.querySelectorAll("[re-field]").forEach((el) => {
      const field = el.getAttribute("re-field");
      const transName = el.getAttribute("re-transform");

      const transform = this.transforms[transName] || ((v) => v);
      el.innerHTML = transform(itemData[field]);
    });

    clone.querySelectorAll("[re-show-field]").forEach((el) => {
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
