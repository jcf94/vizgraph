importScripts("../../node_modules/viz.js/viz.js");
importScripts("../../node_modules/viz.js/full.render.js");

onmessage = function(e) {
    let viz = new Viz();
    viz.renderString(e.data.src, e.data.options)
    .then((data) => {
        postMessage(data);
    })
}
