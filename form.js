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

    changedFields.forEach(([field, value]) =>
      formEl.querySelectorAll(`[re-value="this.${field}"]`).forEach((el) => {
        elementTransforms(el, transforms, "re-value-transform").forEach(
          (t) => (value = t(value))
        );
        if (el.value !== value) {
          el.value = value;
        }
      })
    );
  });

  formEl.addEventListener("change", (event) => {
    console.log("change!", event.target);
    const el = event.target;
    let val = el.value;

    if (el.getAttribute("re-value")) {
      elementTransforms(el, transforms, "re-value-transform-out").forEach(
        (t) => (val = t(val))
      );

      const fields = el.getAttribute("re-value").split(".").slice(1); // skip the store's name

      let field = fields.slice(0, -1).reduce((child, f) => child[f], formData);

      field[fields[fields.length - 1]] = val;
    } else {
      console.log("non-reactive form element", el);
      return;
    }

    console.log("NOW THE DATA", formData);
  });

  formEl.addEventListener("submit", (event) => {
    event.preventDefault();
    console.log("submit!", formData);
  });
}

// This function assumes that formData and store.value are objects and can have nested structures.
// It recursively updates formData with values from newValue that are not in dirtyFields.
function updateNonDirtyFields(formData, dirtyFields, newValue, basePath = "") {
  let changedFields = [];

  Object.keys(newValue).forEach((key) => {
    const currentPath = basePath ? `${basePath}.${key}` : key;
    console.log("currentPath", currentPath);
    // Check if the field is dirty and should be skipped.
    if (dirtyFields.has(currentPath)) {
      return;
    }

    // Handling objects recursively, ensuring arrays and non-object values are updated directly.
    if (Array.isArray(newValue[key])) {
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
