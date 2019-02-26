//importScripts("../../node_modules/viz.js/viz.js");
//importScripts("../../node_modules/viz.js/full.render.js");
 let Viz = require('viz.js');
 let { Module, render } = require('viz.js/full.render.js');

onmessage = function(e) {

    let viz = new Viz({Module: () => Module({TOTAL_MEMORY: 1<<26}), render});

    viz.renderString(e.data.src, e.data.options)
    .then((data) => {
        postMessage(data);
    })
}
