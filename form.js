function formUI(formEl, store, transforms) {
  const formData = {};
  const dirtyFields = new Set();

  // A form is bound in two ways. When the store changes we want the form to change accordingly, and when the form elements change we want to update the store

  store.subscribe((newValue) =>
    handleStoreUpdate(formEl, formData, dirtyFields, transforms, newValue)
  );

  formEl.addEventListener("change", (event) =>
    handleElementChange(event.target, formData, dirtyFields, transforms)
  );

  // Make input events trigger change events to that user can get up-to-date values as soon as the user types them
  formEl.addEventListener("input", (event) =>
    event.target.dispatchEvent(new window.Event("change", { bubbles: true }))
  );

  if (formEl.hasAttribute("re-submit")) {
    DOMINATOR.highjackEvent("submit", formEl, formData, (e) => {
      e.preventDefault();
      dirtyFields.clear();
    });
  }

  if (formEl.hasAttribute("re-change")) {
    DOMINATOR.highjackEvent("change", formEl, formData, (e) =>
      dirtyFields.clear()
    );
  }
}

function handleStoreUpdate(
  formEl,
  formData,
  dirtyFields,
  transforms,
  newValue
) {
  const changedFields = mergeNonDirtyFields(
    formData,
    dirtyFields,
    traverseElementFields(newValue, formEl, "re-form")
  );

  changedFields.forEach(([field, val]) => {
    updateAllWithAttr("re-value", field, val);
    updateAllWithAttr("re-checked", field, val);
  });

  function updateAllWithAttr(attr, field, value) {
    const tAttr = `${attr}-transform`;

    formEl.querySelectorAll(`[${attr}="this.${field}"]`).forEach((el) => {
      const v = applyTransformations(value, el, transforms, tAttr);
      updateFormElement(el, v);
    });
  }
}

function updateFormElement(el, value) {
  switch (el.type) {
    case "checkbox":
      const isChecked = !!value;
      if (el.checked !== isChecked) {
        el.checked = isChecked;
      }
      break;

    case "radio":
      if (el.value === value) {
        !el.checked && (el.checked = true);
      } else {
        el.checked && (el.checked = false);
      }
      break;

    default:
      if (el.value !== value) {
        el.value = value;
      }
      break;
  }
}

function applyTransformations(value, el, transforms, attr) {
  return elementTransforms(el, transforms, attr).reduce(
    (acc, t) => t(acc),
    value
  );
}

function handleElementChange(el, formData, dirtyFields, transforms) {
  let attr = ["re-value", "re-checked"].find((a) => el.getAttribute(a));
  if (!attr) {
    console.error("Non-reactive form element", el);
    return;
  }

  let value = el.type === "checkbox" ? el.checked : el.value;
  value = applyTransformations(value, el, transforms, `${attr}-transform-out`);

  const fields = el.getAttribute(attr).split(".").slice(1); // skip the store's name
  const fieldPath = fields.join(".");

  const lastField = fields.pop();

  let missingField;
  let lastObject = formData;
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (!lastObject || !lastObject.hasAttribute(f)) {
      missingField = f;
      break;
    }

    lastObject = lastObject[f];
  }
  if (missingField) {
    console.error(
      "REACTINITY-FORM: unable to handle element changed :",
      `unable to find field ${missingField} in form data.`
    );
    return;
  }

  if (lastObject[lastField] !== value) {
    lastObject[lastField] = value;
    // Tag field as dirty so that next time the store updates, we wont overwrite a field the user has changed.
    dirtyFields.add(fieldPath);
  }
}

// This function assumes that formData and store.value are objects and can have nested structures.
// It recursively updates formData with values from newValue that are not in dirtyFields.
function mergeNonDirtyFields(formData, dirtyFields, newValue, basePath = "") {
  let changedFields = [];

  Object.keys(newValue).forEach((key) => {
    const currentPath = basePath ? `${basePath}.${key}` : key;

    // We skip dirty fields because we don't want to overwrite data the user has already input in case they are changing the field that got changed under them. Imagine you are writing a super long article, and then a late fetch changes the store data and overwrites your form data. I think the user would rather keep their work in most situations
    if (dirtyFields.has(currentPath)) {
      return;
    }

    const newV = newValue[key];
    const oldV = formData[key];

    // Handling objects recursively
    if (isObject(newV)) {
      // Prepare the structure for nested updates if necessary.
      if (!isObject(oldV)) {
        formData[key] = {};
      }

      const nestedChanges = mergeNonDirtyFields(
        formData[key],
        dirtyFields,
        newV,
        currentPath
      );

      changedFields = changedFields.concat(nestedChanges);
      return;
    }

    // Simply replacing arrays for now
    if (Array.isArray(newV)) {
      if (!equalArrays(newV, oldV)) {
        formData[key] = structuredClone(newV);
        changedFields.push([currentPath, formData[key]]);
      }
      return;
    }

    // Update the value and note the change
    if (newV !== oldV) {
      formData[key] = newV;
      changedFields.push([currentPath, newV]);
    }
  });

  return changedFields;
}

function isObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function equalArrays(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
