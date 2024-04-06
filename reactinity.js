class Reactinity {
  constructor() {
    /** Global map of stores you can search through when subscribing to stores at any point in the application life time. */
    this.STORES = {};
    /** Postprocessing functions to transform data before saving it to the store. */
    this.POSTPROCESSORS = {};
  }

  attachAllElements() {
    Object.entries(storeFunctions).forEach(([tag, fn]) => {
      document.querySelectorAll(`[${tag}]`).forEach((el) => {
        this.attachElement(el, tag, fn);
      });
    });
  }

  attachElement(el, tag, fn) {
    // The elemement itselt will contain the name of the store it wants to subscribe to in its "re-" attribute
    const id = el.getAttribute(tag);
    // The subscription may be to a specific inner field
    const levels = id.split(".");
    // The first name in the field list in the store name
    const store = this.STORES[levels[0]];
    if (!store)
      throw new Error(
        `[iSCream] You are attempting to subscribe to a store that is not in the global store: ${id} `
      );

    let preprocess = (val) => val;
    // console.log("attachElement", el, tag);
    let postprocess =
      this.POSTPROCESSORS[el.getAttribute("re-post")] || ((val) => val);

    console.log("attachElement", el, tag, postprocess);
    // Run the element's related storeFunctions to attach it to a store and other listeners
    fn(el, store, preprocess, postprocess, levels.slice(1));
  }

  /** Registers a data transformation function under a specific identifier. This allows you to use your own custom preprocessing to data before it is saved or updated in the store.*/
  usePostprocessor(id, fun) {
    this.POSTPROCESSORS[id] = fun;
  }

  getPostProcessor(id) {
    return this.POSTPROCESSORS[id];
  }

  /** Creates and registers a new store with a unique identifier and an initial value.  If a store with the same identifier already exists, it throws an error to prevent overwriting.  */
  newStore(id, initialValue) {
    if (!this.STORES[id]) {
      this.STORES[id] = new Store(initialValue);
      return this.STORES[id];
    }
    throw new Error(`[iScream] a store with the id '${id}' already exists`);
  }
}

/** Define the key functionality of the library, keyed by the attribute on the element to be updated. Reactinity will look for elements with the attributes in each of the keys and subscribe them accordingly */
const storeFunctions = {
  // Change the innerHTML of an element every time the related store changes
  "re-innerhtml": (el, store, preprocess, postprocess, fields) => {
    store.subscribe((val) => {
      let v = val;
      // TODO: Maybe we should check if the specific field has changed?
      for (let i = 0; i < fields.length; i++) {
        // TODO: check for property existance and print pretty error if its doesnt!
        v = v[fields[i]];
      }
      const process = postprocess || preprocess;
      el.innerHTML = process(v);
    });
  },
  // Edit the store value when its value changes, and change its value when the store changes
  "re-bind": (el, store, preprocess, postprocess) => {
    // Update element value at store change
    store.subscribe((val) => {
      const v = preprocess(val);
      if (el.value !== v) {
        el.value = v;
      }
    });
    // Update the store at element input
    el.addEventListener("input", (e) => store.set(postprocess(e.target.value)));
  },
  // TODO: List subscribe, imagine a list of users, or a TODO list
  "re-list": (el, store, preprocess, postprocess) => {
    // This one is a little more complicated. I need to add/remove entire rows. but i also need to update each field in each of the existing rows as they get edited. Maybe the store behavior needs to account for the intial value being an array? but then its bad if they value starts as null or something and then becomes an array, i don't think i want to check at every update.
    // Maybe instead I can create a different type of store for arrays. One that has array functionality attached to it, and then index based updating! Then we can measure deltas more properly? Idk if its that worth to make each field only update exactly what uses it, or if better to just do the whole row. In terms of dom manipulation it is certainly more efficient to just update the field itself, but that may incur too much complexity on my end
    // Then maybe the ideal thing is not to a have a general subscribe. maybe its better to have on push, on edit field, on remove, or whatever that get called by the array store, when the user calls those methods on the stores them selves. Like i have an array store, i call myStore.push({v}), which is a custom push function that edits the val, the calls push subscribers.
    // That sounds a bit convoluted,but the alternative is to do some sort of diffing, which is a can of worms.
    // Also, it might just be an issue of this being a completely different problem, so lets keep it out of this context and let it be its own things for now. Simple values and single objects can get handled by this format, but the arrays are a whole diffent thing.
    store.subscribe((val) => {
      console.log("This list has changed", val);
    });
  },
};

/**
 * The Store class encapsulates a piece of state, providing methods to subscribe to state changes, set new state values, and apply transformations to the current state.
 * It serves as the core of the state management system, enabling reactive data binding and updates throughout the application.
 * - `subscribe` allows listening for changes to the state.
 * - `set` updates the state's value and notifies all subscribers.
 * - `update` applies a transformation function to the state and updates subscribers with the new value. Your function must return the new value.
 */
class Store {
  constructor(initialValue) {
    this.value = initialValue;
    this.subs = [];
  }

  subscribe(method) {
    this.subs.push(method);
    method(this.value); // Call it immediately
  }

  set(val) {
    this.value = val;
    this.subs.forEach((method) => method(val));
  }

  update(fn) {
    this.set(fn(this.value));
  }
}
