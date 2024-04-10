class ArrayStoreUISubscriber {
  constructor(parentElement) {
    this.parent = parentElement;
    this.template = parent.querySelector("[re-template]");
  }

  append(val) {
    const el = cloneTemplate(val, this.template, this.transforms);
    this.parent.appendChild(el);
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
}

class ArrayStore {
  constructor(array) {
    /** @type {Array}*/
    this.array = array;
    this.subscribers = [];
  }

  subscribe(subscriber) {
    // A subscriber has the same public interface as the array store (except for the subscribe function)
    this.subscribers.append(subscriber);
  }

  append(val) {
    this.array.push(val);
    this.subscribers.forEach((s) => s.append(val));
  }

  set(newArray) {
    this.array = newArray;
    this.subscribers.forEach((s) => s.overwrite(newArray));
  }
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

function cloneTemplate(item, template, transforms) {
  const clone = template.cloneNode(true);
  clone.removeAttribute("re-template");

  clone.querySelectorAll("[re-field]").forEach((el) => {
    const field = el.getAttribute("re-field");
    const transName = el.getAttribute("re-transform");

    const transform = transforms[transName] || ((v) => v);
    el.innerHTML = transform(item[field]);
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

  return clone;
}
