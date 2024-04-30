function formUI(formEl, store, transforms) {
  // TODO: Need a mechanism to mark fields dirty

  const formData = {};

  // Sample dirtyFields Set, which contains the names of the fields marked as dirty.
  const dirtyFields = new Set();

  const storeFields = formEl.getAttribute("re-form").split(".").slice(1);
  const traverseStoreFields = (val) => {
    storeFields.forEach((f) => (val = val[f]));
    return val;
  };

  store.subscribe((v) => {
    const changedFields = updateNonDirtyFields(
      formData,
      dirtyFields,
      traverseStoreFields(v)
    );

    changedFields.forEach(([field, value]) => {
      formEl.querySelectorAll(`[re-value="this.${field}"]`).forEach((el) => {
        elementTransforms(el, transforms, "re-value-transform").forEach(
          (t) => (value = t(value))
        );
        if (el.value !== value) {
          el.value = value;
        }
      });

      formEl.querySelectorAll(`[re-checked="this.${field}"]`).forEach((el) => {
        elementTransforms(el, transforms, "re-checked-transform").forEach(
          (t) => (value = t(value))
        );

        if (el.type === "checkbox") {
          // force a boolean
          value = !!value;
          if (el.checked !== value) {
            el.checked = value;
          }
        }

        // ASSUMING radios have values and checkboxes don't, that is not very clear... Maybe unreasonable, need to test with more form configurations, cus this works for ours at least
        if (el.type === "radio") {
          if (el.value === value) {
            if (el.checked !== true) {
              el.checked = true;
            }
          }
        }
      });
    });
  });

  // Update formData as the user changes the form elements
  formEl.addEventListener("change", (event) => {
    const el = event.target;
    if (el.getAttribute("re-value")) {
      let val = el.value;

      elementTransforms(el, transforms, "re-value-transform-out").forEach(
        (t) => (val = t(val))
      );

      const fields = el.getAttribute("re-value").split(".").slice(1); // skip the store's name
      dirtyFields.add(fields.join("."));

      const lastObject = fields
        .slice(0, -1)
        .reduce((child, f) => child[f], formData);

      const lastField = fields[fields.length - 1];
      if (lastObject[lastField] !== val) {
        lastObject[lastField] = val;
      }
    } else if (el.getAttribute("re-checked")) {
      let val = el.value;
      // TODO: assuming checkboxes won't have values, probably not reasonable but idk
      if (el.type === "checkbox") {
        val = !!el.checked;
      }
      console.log("CEHCKED", el, el.checked, val);

      elementTransforms(el, transforms, "re-checked-transform-out").forEach(
        (t) => (val = t(val))
      );

      const fields = el.getAttribute("re-checked").split(".").slice(1); // skip the store's name
      dirtyFields.add(fields.join("."));

      const lastObject = fields
        .slice(0, -1)
        .reduce((child, f) => child[f], formData);

      const lastField = fields[fields.length - 1];
      if (lastObject[lastField] !== val) {
        lastObject[lastField] = val;
      }
    } else {
      console.log("non-reactive form element", el);
      return;
    }

    console.log("NOW THE DATA", formData);
  });

  if (formEl.hasAttribute("re-submit")) {
    DOMINATOR.highjackEvent("submit", formEl, formData, () =>
      dirtyFields.clear()
    );
  }

  if (formEl.hasAttribute("re-change")) {
    DOMINATOR.highjackEvent(
      "change",
      formEl,
      formData
      //,  () => dirtyFields.clear()
    );
    // I with there was a callback attached where i could clear the dirty fields array
  }
}

// This function assumes that formData and store.value are objects and can have nested structures.
// It recursively updates formData with values from newValue that are not in dirtyFields.
// TODO: there seems to be a bug here. When I update and submit a change from blue to red in color and then click the change mother name, nothing happens
// Its weird, cus it works the first time flawlessly, but then after i submit some shit happens
function updateNonDirtyFields(formData, dirtyFields, newValue, basePath = "") {
  let changedFields = [];

  Object.keys(newValue).forEach((key) => {
    const currentPath = basePath ? `${basePath}.${key}` : key;
    // console.log("currentPath", currentPath);
    // Check if the field is dirty and should be skipped.
    if (dirtyFields.has(currentPath)) {
      console.log("not updating dirty field", currentPath);
      return;
    }

    // Handling objects recursively, ensuring arrays and non-object values are updated directly.
    if (Array.isArray(newValue[key])) {
      console.log(
        "arraycomp:",
        formData[key],
        newValue[key],
        JSON.stringify(formData[key]) !== JSON.stringify(newValue[key])
      );
      // Simply replace the array if it's not marked as dirty
      if (JSON.stringify(formData[key]) !== JSON.stringify(newValue[key])) {
        formData[key] = [...newValue[key]]; // Creates a shallow copy of the array // TODO: Why shallow? what if there are objects in there?
        // TODO: Should call the element changer from here
        changedFields.push([currentPath, formData[key]]);
      }
    } else if (
      typeof newValue[key] === "object" &&
      newValue[key] !== null &&
      !Array.isArray(newValue[key])
    ) {
      if (
        typeof formData[key] !== "object" ||
        formData[key] === null ||
        Array.isArray(formData[key])
      ) {
        formData[key] = {}; // Prepare the structure for nested updates if necessary.
      }
      const nestedChanges = updateNonDirtyFields(
        formData[key],
        dirtyFields,
        newValue[key],
        currentPath
      );
      changedFields = changedFields.concat(nestedChanges);
    } else {
      console.log(
        "comp:",
        formData[key],
        newValue[key],
        formData[key] !== newValue[key]
      );
      // Update the value and note the change if the value is indeed different.
      if (formData[key] !== newValue[key]) {
        formData[key] = newValue[key];
        // TODO: Should call the element changer from here
        changedFields.push([currentPath, formData[key]]);
      }
    }
  });

  return changedFields;
}
