require('svg-pan-zoom');
var Viz = require('viz.js');

var beforeUnloadMessage = null;
var resizeEvent = new Event("paneresize");
var parser = new DOMParser();
var worker;
var result;

// ------- Split -------

var Split = require('split.js');
Split(['#editor', '#graph'], {
    sizes: [40, 60],
    onDragEnd: function() {
        var svgOutput = document.getElementById("svg_output");
        if (svgOutput != null) {
        svgOutput.dispatchEvent(resizeEvent);
        }
    }
});

// ------- Ace Editor -------

var editor = ace.edit("editor");
//editor.setTheme("ace/theme/monokai");
document.getElementById('editor').style.fontSize='12px';
editor.getSession().setMode("ace/mode/dot");
editor.on("change", function() {
    updateGraph();
    beforeUnloadMessage = "Your changes will not be saved.";
});

// ------- Listening Action -------

window.addEventListener("beforeunload", function(e) {
    return beforeUnloadMessage;
});

document.querySelector("#engine select").addEventListener("change", function() {
    updateGraph();
});

document.querySelector("#format select").addEventListener("change", function() {
    // if (document.querySelector("#format select").value === "svg") {
    //     document.querySelector("#raw").classList.remove("disabled");
    //     document.querySelector("#raw input").disabled = false;
    // } else {
    //     document.querySelector("#raw").classList.add("disabled");
    //     document.querySelector("#raw input").disabled = true;
    // }

    updateGraph();
});

// document.querySelector("#raw input").addEventListener("change", function() {
//     updateOutput();
// });

document.querySelector('#save_svg').addEventListener("click", function() {
    var url = window.URL.createObjectURL(new Blob([result], { "type" : "text\/xml" }));

    var a = document.createElement("a");
    document.body.appendChild(a);
    a.setAttribute("class", "svg-crowbar");
    a.setAttribute("download", "new_graph.svg");
    a.setAttribute("href", url);
    a.style["display"] = "none";
    a.click();
})

// ------- Key Function -------

function updateGraph()
{
    if (worker)
    {
        worker.terminate();
    }

    document.querySelector("#output").classList.add("working");
    document.querySelector("#output").classList.remove("error");

    worker = new Worker("src/worker.js");
    worker.onmessage = function(e) {
        document.querySelector("#output").classList.remove("working");
        document.querySelector("#output").classList.remove("error");

        result = e.data;

        updateOutput();
    }

    worker.onerror = function(e) {
        document.querySelector("#output").classList.remove("working");
        document.querySelector("#output").classList.add("error");

        var message = e.message === undefined ? "An error occurred while processing the graph input." : e.message;

        var error = document.querySelector("#error");
        while (error.firstChild) {
            error.removeChild(error.firstChild);
        }

        document.querySelector("#error").appendChild(document.createTextNode(message));
        
        console.error(e);
        e.preventDefault();
    }

    var params = {
        src: editor.getSession().getDocument().getValue(),
        options: {
            engine: document.querySelector("#engine select").value,
            format: document.querySelector("#format select").value
        }
    };

    // Instead of asking for png-image-element directly, which we can't do in a worker,
    // ask for SVG and convert when updating the output.
    
    if (params.options.format == "png-image-element") {
        params.options.format = "svg";
    }

    worker.postMessage(params);
}

function updateOutput()
{
    var graph = document.querySelector("#output");

    var svg = graph.querySelector("svg");
    if (svg) {
        graph.removeChild(svg);
    }

    var text = graph.querySelector("#text");
    if (text) {
        graph.removeChild(text);
    }

    var img = graph.querySelector("img");
    if (img) {
        graph.removeChild(img);
    }

    if (!result) {
        return;
    }

    if (document.querySelector("#format select").value == "svg") { //&& !document.querySelector("#raw input").checked) {
        var svg = parser.parseFromString(result, "image/svg+xml").documentElement;
        svg.id = "svg_output";
        graph.appendChild(svg);

        panZoom = svgPanZoom(svg, {
            zoomEnabled: true,
            controlIconsEnabled: true,
            fit: true,
            center: true,
            minZoom: 0.1
        });

        svg.addEventListener('paneresize', function(e) {
            panZoom.resize();
        }, false);

        window.addEventListener('resize', function(e) {
            panZoom.resize();
        });
    } else if (document.querySelector("#format select").value == "png-image-element") {
        var image = Viz.svgXmlToPngImageElement(result);
        graph.appendChild(image);
    } else {
        var text = document.createElement("div");
        text.id = "text";
        text.appendChild(document.createTextNode(result));
        graph.appendChild(text);
    }
}

updateGraph();
