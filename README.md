# Reactinity

Reactinity is a lightweight reactivity framework. It is inspired by HTMX and Svelte, but with the goal of bringing state reactivity to html, with minimal javascript.

The library is still in its idea stage, feel free to submit PRs with your ideas or fixes. I want to keep the minified version as fully cacheable by browsers and under 5kB, so please keep your changes minimal.

## Using it

I'd suggest just copy-pasting the code into your project for now. It is tiny, and not ready for me to spend the time actually publishing it.

## How it works - Simple counter

The library will include methods for editing the contents of an html element, by connecting it to a _Store_. You first need to create and name a store with an initial value:

```
<script>
    const reactinity = new Reactinity();
    const countStore =
        reactinity.newStore("count", 0);
</script>
```

You can then subscribe to that state store directly from the HTML using the re-method attributes, like:

```
<div re-innerhtml="count"></div>
```

Lets add a button to modify the value of the store so we can watch it react:

```
<script>
    function addOne() {
        countStore.update((v) => v + 1);
    }
</script>

<button onclick="addOne()">Add one</button>
```

Now the code is all in place, we need to actually attach the DOM elements to the reactinity controller. I am using a single function for now, but you can also subscribe elements individually as they come.

```
reactinity.attachAllElements();
```

Run the example.html file locally to see it in action! You should see the value of value of the div start out a 0, and increase by one everytime the button is clicked

## TODOs:

- Fix and rename pre/postprocessing ideas
- Handle array stores.
  - Create some templating system, ideally in-file to keep it simple
  - React to changes in the array (append, remove)
  - React to changes in children
- Rename project, Reactinity is hard to say and spell
- Publish the example online so people can test it out without downloading it
- Turn this into a usable, downloadable/ importable library that people can actually use without copy pasting
