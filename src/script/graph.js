require('svg-pan-zoom');
let Viz = require('viz.js');

let resizeEvent = new Event("paneresize");
let parser = new DOMParser();
let worker;
let result;
let image;

const {ipcRenderer, remote, shell} = require('electron');
const {Menu, dialog, app} = remote;
let fs = require('fs');
let mainWindow = remote.getCurrentWindow();

// ------- State Maintain -------

let edit_state = false;
let current_file = undefined;
const app_version = app.getVersion();

let into_edit = () => {
    edit_state = true;
    if (current_file === undefined) {
        mainWindow.setTitle('VizGraph (*)');
    } else {
        mainWindow.setTitle('VizGraph - ' + current_file + ' (*)');
    }
    ipcRenderer.send('cannot_close');
}

let into_read = () => {
    edit_state = false;
    if (current_file === undefined) {
        mainWindow.setTitle('VizGraph');
    } else {
        mainWindow.setTitle('VizGraph - ' + current_file);
    }
    
    ipcRenderer.send('can_close');
}

// ------- Split -------

let Split = require('split.js');
let split_size = 40;
let split = Split(['#editor', '#graph'], {
    sizes: [split_size, 100 - split_size],
    onDragEnd: function() {
        let svgOutput = document.getElementById("svg_output");
        if (svgOutput != null) {
            svgOutput.dispatchEvent(resizeEvent);
        }
    }
});

// console.log(split.getSizes());

// ------- Ace Editor -------

let language_tools = ace.require('ace/ext/language_tools');
let editor = ace.edit("editor");
editor.getSession().setMode("ace/mode/dot");
editor.setOptions({
    enableBasicAutocompletion: true, //boolea 或 completer数组,
    enableLiveAutocompletion: true, //boolean 或 completer数组,
    enableSnippets: true, // boolean
});

language_tools.addCompleter({
    getCompletions: function(editor, session, pos, prefix, callback) {
        callback(null, [
            // {
            //     name: "test",
            //     value: "test",
            //     caption: "test",
            //     meta: "test",
            //     type: "local",
            //     score: 1000
            // }
        ]);
    }
});

editor.on("change", function() {
    if (!edit_state) {
        into_edit();
    }
    updateGraph();
});

// ------- Listening Action -------

document.querySelector("#engine select").addEventListener("change", function() {
    last_engin = document.querySelector("#engine select").value;
    updateGraph();
});

let svg_button = document.querySelector('button#save_svg');
let png_button = document.querySelector('button#save_png');
let json_button = document.querySelector('button#save_json');
let xdot_button = document.querySelector('button#save_xdot');
let plain_button = document.querySelector('button#save_plain');
let ps_button = document.querySelector('button#save_ps');

document.querySelector("#format select").addEventListener("change", function() {
    let now_format = document.querySelector("#format select").value;

    if (now_format === "svg") {
        svg_button.style.display = "inline-block";
        png_button.style.display = "none";
        json_button.style.display = "none";
        xdot_button.style.display = "none";
        plain_button.style.display = "none";
        ps_button.style.display = "none";
    } else if (now_format === "png-image-element") {
        svg_button.style.display = "none";
        png_button.style.display = "inline-block";
        json_button.style.display = "none";
        xdot_button.style.display = "none";
        plain_button.style.display = "none";
        ps_button.style.display = "none";
    } else if (now_format === "json") {
        svg_button.style.display = "none";
        png_button.style.display = "none";
        json_button.style.display = "inline-block";
        xdot_button.style.display = "none";
        plain_button.style.display = "none";
        ps_button.style.display = "none";
    } else if (now_format === "xdot") {
        svg_button.style.display = "none";
        png_button.style.display = "none";
        json_button.style.display = "none";
        xdot_button.style.display = "inline-block";
        plain_button.style.display = "none";
        ps_button.style.display = "none";
    } else if (now_format === "plain") {
        svg_button.style.display = "none";
        png_button.style.display = "none";
        json_button.style.display = "none";
        xdot_button.style.display = "none";
        plain_button.style.display = "inline-block";
        ps_button.style.display = "none";
    } else if (now_format === "ps") {
        svg_button.style.display = "none";
        png_button.style.display = "none";
        json_button.style.display = "none";
        xdot_button.style.display = "none";
        plain_button.style.display = "none";
        ps_button.style.display = "inline-block";
    }

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

function download_blod(format) {
    let url = window.URL.createObjectURL(new Blob([result], { "type" : "text\/xml" }));

    let pre = document.querySelector("#engine select").value;

    let a = document.createElement("a");
    document.body.appendChild(a);
    a.setAttribute("class", "svg-crowbar");
    a.setAttribute("download", pre + "_graph." + format);
    a.setAttribute("href", url);
    a.style["display"] = "none";
    a.click();
    document.body.removeChild(a);
};

svg_button.addEventListener("click", function() {
    download_blod("svg");
});

png_button.addEventListener("click", function() {
    let pre = document.querySelector("#engine select").value;

    let a = document.createElement("a");
    document.body.appendChild(a);
    a.setAttribute("class", "svg-crowbar");
    a.setAttribute("download", pre + "_graph.png");
    a.setAttribute("href", image.src);
    a.style["display"] = "none";
    a.click();
    document.body.removeChild(a);
});

json_button.addEventListener("click", function() {
    download_blod("json");
});

xdot_button.addEventListener("click", function() {
    download_blod("xdot");
});

plain_button.addEventListener("click", function() {
    download_blod("plain");
});

ps_button.addEventListener("click", function() {
    download_blod("ps");
});

// ------- Key Function -------

function updateGraph()
{
    if (worker)
    {
        worker.terminate();
    }

    document.querySelector("#output").classList.add("working");
    document.querySelector("#output").classList.remove("error");

    worker = new Worker("script/worker.js");
    worker.onmessage = function(e) {
        document.querySelector("#output").classList.remove("working");
        document.querySelector("#output").classList.remove("error");

        result = e.data;

        updateOutput();
    }

    worker.onerror = function(e) {
        document.querySelector("#output").classList.remove("working");
        document.querySelector("#output").classList.add("error");

        let message = e.message === undefined ? "An error occurred while processing the graph input." : e.message;

        let error = document.querySelector("#error");
        while (error.firstChild) {
            error.removeChild(error.firstChild);
        }

        document.querySelector("#error").appendChild(document.createTextNode(message));
        
        console.error(e);
        e.preventDefault();
    }

    let params = {
        src: editor.getSession().getDocument().getValue(),
        options: {
            engine: document.querySelector("#engine select").value,
            format: document.querySelector("#format select").value,
            totalMemory: 104857600
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
    let graph = document.querySelector("#output");

    let svg = graph.querySelector("svg");
    if (svg) {
        graph.removeChild(svg);
    }

    let text = graph.querySelector("#text");
    if (text) {
        graph.removeChild(text);
    }

    let img = graph.querySelector("img");
    if (img) {
        graph.removeChild(img);
    }

    if (!result) {
        return;
    }

    if (document.querySelector("#format select").value == "svg") { //&& !document.querySelector("#raw input").checked) {
        let svg = parser.parseFromString(result, "image/svg+xml").documentElement;
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
        image = Viz.svgXmlToPngImageElement(result);
        graph.appendChild(image);
    } else {
        let text = document.createElement("div");
        text.id = "text";
        text.appendChild(document.createTextNode(result));
        graph.appendChild(text);
    }
}

// ------- Save Dot File -------

let save_dot_to_file = (callback, args) => {
    let dot_text = editor.getSession().getDocument().getValue();
    dialog.showSaveDialog(mainWindow, {
        filters: [
            {name: 'GraphViz Dot Files', extensions: ['gv']},
            {name: 'All Files', extensions: ['*']}
        ]}, (filename) => {
            if (filename === undefined){
                console.log("File Save canceled.");
                return;
            }
            fs.writeFile(filename, dot_text, (err) => {
                if (err) {
                    alert("An error ocurred creating the file "+ err.message);
                    return;
                }
                current_file = filename;
                into_read();
                callback && callback(args);
            });
    });
}

let try_to_save_dot_to_file = (callback, args) => {
    if (edit_state) {
        if (current_file === undefined) {
            save_dot_to_file(callback, args);
        } else {
            let dot_text = editor.getSession().getDocument().getValue();
            fs.writeFile(current_file, dot_text, (err) => {
                if (err) {
                    alert("An error ocurred creating the file "+ err.message);
                    return;
                }
                into_read();
                callback && callback(args);
            });
        }
    }
}

let read_file = (filename) => {
    if (filename === undefined) {
        console.log("No file selected.");
        return;
    }
    current_file = filename;
    fs.readFile(current_file, 'utf-8', (err, data) => {
        if (err) {
            alert("An error ocurred reading the file :" + err.message);
            return;
        }
        editor.getSession().getDocument().setValue(data);
        into_read();
    });
}

let read_dot_from_file = (filepath) => {
    if (filepath === undefined) {
        dialog.showOpenDialog(mainWindow, {
            filters: [
                {name: 'GraphViz Dot Files', extensions: ['gv', 'dot']},
                {name: 'All Files', extensions: ['*']}
            ]}, (filename) => {
                if (filename != undefined) {
                    read_file(filename[0]);
                } 
        });
    } else {
        read_file(filepath);
    }
}

let try_to_read_dot_from_file = (filepath) => {
    if (edit_state) {
        dialog.showMessageBox(mainWindow, {
            type: "question",
            message: "Save Current Dot File & Open another?",
            buttons: ["Yes", "No", "Cancel"],
            title: "Save Dot File"
        }, (response) => {
            switch(response) {
                case 0:
                    try_to_save_dot_to_file(read_dot_from_file, filepath);
                    break;
                case 1:
                    read_dot_from_file(filepath);
                    break;
                default:
                    return;
            }
        });
    } else {
        read_dot_from_file(filepath);
    }
}

let create_new_dot_file = () => {
    ipcRenderer.send('open_module_select_window');
}

document.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();

    console.log(e.dataTransfer.files[0].path);
    try_to_read_dot_from_file(e.dataTransfer.files[0].path);
});

document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

ipcRenderer.on('save_dot_file', () => {
    dialog.showMessageBox(mainWindow, {
        type: "question",
        message: "VizGraph Exit && Save Current Dot File?",
        buttons: ["Yes", "No", "Cancel"],
        title: "Save Dot File"
    }, (response) => {
        switch(response) {
            case 0:
                try_to_save_dot_to_file(mainWindow.close);
                break;
            case 1:
                ipcRenderer.send('can_close');
                mainWindow.close();
            default:
                return;
        }
    });
});

ipcRenderer.on('argv', (event, message) => {
    fs.stat(message, (err, stat) => {
        if (stat && stat.isFile()) {
            console.log(message)
            try_to_read_dot_from_file(message);
        } else {
            console.log("Not a file.");
            ipcRenderer.send('open_module_select_window');
        }
    })
});

ipcRenderer.on('create_new_dot', (event, message) => {
    switch (message) {
    case 0:
        editor.getSession().getDocument().setValue('digraph G {\n}');
        current_file = undefined;
        into_read();
        break;
    case 1:
        fs.readFile('template/clusters.gv', 'utf-8', (err, data) => {
            editor.getSession().getDocument().setValue(data);
            current_file = undefined;
            into_read();
        });
        break;
    case 2:
        fs.readFile('template/datastruct.gv', 'utf-8', (err, data) => {
            editor.getSession().getDocument().setValue(data);
            current_file = undefined;
            into_read();
        });
        break;
    case 3:
        fs.readFile('template/fsm.gv', 'utf-8', (err, data) => {
            editor.getSession().getDocument().setValue(data);
            current_file = undefined;
            into_read();
        });
        break;
    case 4:
        fs.readFile('template/familytree.gv', 'utf-8', (err, data) => {
            editor.getSession().getDocument().setValue(data);
            current_file = undefined;
            into_read();
        });
        break;
    case 5:
        fs.readFile('template/lion_share.gv', 'utf-8', (err, data) => {
            editor.getSession().getDocument().setValue(data);
            current_file = undefined;
            into_read();
        });
        break;
    case 6:
        fs.readFile('template/polygons.gv', 'utf-8', (err, data) => {
            editor.getSession().getDocument().setValue(data);
            current_file = undefined;
            into_read();
        });
        break;
    case 7:
        fs.readFile('template/switch.gv', 'utf-8', (err, data) => {
            editor.getSession().getDocument().setValue(data);
            current_file = undefined;
            into_read();
        });
        break;
    }
    ipcRenderer.send('close_module_select_window');
});

// ------- Menu -------

let menutemplate = [
    {
        label: 'File',
        submenu: [
            {
                label: 'New Dot File',
                click: () => {
                    if (edit_state) {
                        dialog.showMessageBox(mainWindow, {
                            type: "question",
                            message: "Save Current Dot File & Start a New Dot File?",
                            buttons: ["Yes", "No", "Cancel"],
                            title: "Save Dot File"
                        }, (response) => {
                            switch(response) {
                                case 0:
                                    try_to_save_dot_to_file(create_new_dot_file);
                                    break;
                                case 1:
                                    create_new_dot_file();
                                    break;
                                default:
                                    return;
                            }
                        });
                    } else {
                        create_new_dot_file();
                    }
                }
            },
            { type: 'separator' },
            {
                label: 'Open Dot File',
                click: () => {
                    try_to_read_dot_from_file();
                }
            },
            {
                label: 'Save Dot File',
                accelerator: 'Ctrl+S',
                click: () => {
                    try_to_save_dot_to_file();
                }
            },
            {
                label: 'Save Dot File to ...',
                click: () => {
                    save_dot_to_file()
                }
            },
            { type: 'separator' },
            {
                label: 'Editor Setting',
                click: () => {
                    editor.execCommand("showSettingsMenu");
                }
            },
            { type: 'separator' },
            { role: 'quit' }
        ]
    },
    {
        role: 'editMenu'
    },
    {
        label: 'View',
        submenu: [
            //{role: 'reload'},
            //{role: 'forcereload'},
            //{role: 'toggledevtools'},
            //{type: 'separator'},
            //{role: 'resetzoom'},
            //{role: 'zoomin'},
            //{role: 'zoomout'},
            //{type: 'separator'},
            {
                label: 'Reset Window Size',
                click: () => {
                    mainWindow.setSize(1024, 768);
                }
            },
            {role: 'togglefullscreen'},
            {type: 'separator'},
            {role: 'minimize'}
        ]
    },
    {
        role: 'help',
        submenu: [
            {
                label: 'Help Documentation',
                click: () => {
                    shell.openExternal('http://www.graphviz.org/documentation/');
                }
            },
            {
                role: 'about',
                click: () => {
                    open_about_dialog();
                }
            }
        ]
    }
];

const nativeImage = remote.nativeImage;

let open_about_dialog = () => {
    dialog.showMessageBox(mainWindow, {
        title: 'About VizGraph',
        icon: nativeImage.createFromPath('src/img/ico.png'),
        message: 'VizGraph',
        detail: 'A simple tool for Using Graphviz.\nPowered by Viz.js & Electron.\n\n' +
        'App version: Beta ' + app_version
    }, () => {});
}

let menu = Menu.buildFromTemplate(menutemplate);
Menu.setApplicationMenu(menu);

// ------- Other -------

updateGraph();