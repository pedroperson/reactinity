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
    console.log("changedFields", changedFields);

    // TODO: This doesnt feel like the appropriate place for this
    // TODO: We should perform these actions immediately when change is found, lets just pass it in to the updateNonDirtyFields? that way we have the data value and the path immediately there. without having to search. then we can just find the elements, transform the one value for each element, set the value and done
    formEl
      .querySelectorAll(`[re-value="this.${changedFields[0]}"]`)
      .forEach((el) => {
        console.log("should update form element", el);
        el;
      });
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
        changedFields.push(currentPath);
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
        changedFields.push(currentPath);
      }
    }
  });

  return changedFields;
}
