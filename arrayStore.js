class ArrayStore {
  constructor(initialValue) {
    this.arr = initialValue;
    this.subs = [];
    this.pushListeners = [];
  }

  subscribe(method) {
    this.subs.push(method);
    method(this.value); // Call it immediately
  }

  listenToPush(fn) {
    pushListeners.push(fn);
  }

  set(val) {
    this.value = val;
    this.subs.forEach((method) => method(val));
  }

  insert(val, index = 0) {
    this.arr.splice(index, 0, val);

    pushListeners.forEach((method) => method(val, index));
    this.subs.forEach((method) => method(val));
  }
}
