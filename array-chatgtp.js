// TODO: Now we do this part!
class ArrayStoreUISubscriber {
  constructor(parentElement, stores, transforms) {
    this.parent = parentElement;
    this.stores = stores;
    this.transforms = transforms;
    this.storesISubscribeTo = [];
    this.template = this._getTemplate("[re-template]");
    if (!this.template) {
      console.error(`[re-template] does not have a child`);
    }
    this.emptyTemplate = this._getTemplate("[re-template-empty]");
  }

  set(newArray) {
    this._clearParent();
    newArray.forEach((row) => this.append(row));
  }

  append(row) {
    this.parent.append(this._cloneAndPopulate(row));
  }

  deleteRow(data) {
    const el = this._findElementWithPointer(
      data,
      "deleteRow element was not found"
    );
    this._removeChild(el);
  }

  overwriteRow(data, newData) {
    const el = this._findElementWithPointer(
      data,
      "overwriteRow element was not found"
    );
    const newNode = this._cloneAndPopulate(newData);
    this.parent.insertBefore(newNode, el);
    this._removeChild(el);
  }

  updateField(itemData, field, fn) {
    const el = this._findElementWithPointer(
      itemData,
      "updateField element was not found"
    );
    this._applyTransforms(el, field, itemData);
  }

  _findElementWithPointer(pointer, errorMsg) {
    const el = Array.from(this.parent.children).find(
      (el) => el.POINTER_TO_DATA === pointer
    );
    if (!el) throw new Error(errorMsg);
    return el;
  }

  _removeChild(el) {
    this.parent.removeChild(el);
    console.log("_removeChild", { el, unsubs: el._unsubs });
  }

  _cloneAndPopulate(itemData) {
    const clone = this.template.cloneNode(true);
    clone.removeAttribute("re-template");
    clone.POINTER_TO_DATA = itemData;
    this._populateClone(clone, itemData);
    return clone;
  }

  _populateClone(clone, itemData) {
    const attrs = ["re", "re-show", "re-class", "re-src", "re-click"];
    attrs.forEach((attr) => {
      clone
        .querySelectorAll(`[${attr}^="this."], [${attr}="this"]`)
        .forEach((el) => {
          const transform =
            this.transforms[el.getAttribute(`${attr}-transform`)] || ((v) => v);
          const newValue = transform(itemData[field]);
          this._updateElement(attr, el, newValue);
        });
    });
  }

  //   This might be a good idea for the global layer
  _updateElement(attr, el, value) {
    switch (attr) {
      case "re":
        el.innerText = value;
        break;
      case "re-show":
        el.style.display = value ? "block" : "none";
        break;
      case "re-class":
        el.className = value;
        break;
      case "re-src":
        el.src = value;
        break;
      default:
        break;
    }
  }

  _getTemplate(selector) {
    return this.parent.querySelector(selector);
  }

  _clearParent() {
    while (this.parent.firstChild) {
      this.parent.removeChild(this.parent.lastChild);
    }
  }

  _applyTransforms(el, field, itemData) {
    const transformSelectors = ["re", "re-show", "re-class", "re-src"];
    transformSelectors.forEach((selector) => {
      el.querySelectorAll(`[${selector}^="this.${field}"]`).forEach((child) => {
        const transform =
          this.transforms[child.getAttribute(`${selector}-transform`)];
        const newValue = transform
          ? transform(itemData[field])
          : itemData[field];
        this._updateElement(selector, child, newValue);
      });
    });
  }
}
