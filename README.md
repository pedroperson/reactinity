# Reactinity

Reactinity is a lightweight reactivity framework. It is inspired by HTMX and Svelte, but with the goal of bringing state reactivity to html, with minimal javascript.

The library is still in its idea stage, feel free to submit PRs with your ideas or fixes. I want to keep the minified version as fully cacheable by browsers and under 5kB, so please keep your changes minimal.

One thing that turned out to be cool is that you never lose the pointer, so search is super easy. there is ideally one object per item in the whole code, and we can pass it around and save it everywhere instead of having to use ids and such. the pointer is the id so comparisson are just comparing two ints and its fast af

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

## Ideas? idk

- if there is a whay to check if an element is being diplayed, we can save the updates for when it is ? Like if the cart list is hidden, can we hold off on the dom updates until it is not? Looks like you can with el.checkVisibility(), but then we need extra memory to store the state while we wait. but since its just the value we are going to add to the dom anyway it should be ok. so what would htat lok like?
  when an update to the dom comes in we check ofr visibility (what about those we have have hidden and show now be shown?). if not visible we store the value and the element in a queue. then when that elment becomes visible is there a cheap way to check this? maybe since we control the hide and show we have send a signal out of something, but i think intersection observer is way too slow.

## Scripts

Running this in the console helped me find memory leaks.

```
function monkeypress(){
    const btns = document.querySelectorAll("button");
    const i = Math.round(Math.random() * (btns.length-1));
    btns[i].click();
    // console.log("clicked",btns[i]);
}

const sleep = async (delay) =>new Promise((resolve) => setTimeout(resolve, delay));
const loops = 1000;
const sleepDelay = 1;
const fn = async function() {
for (let i = 0 ; i <loops; i++){
    monkeypress();
    await sleep(sleepDelay);
}}
fn();
```
