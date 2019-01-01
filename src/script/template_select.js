const {ipcRenderer, shell} = require('electron');

let buttons = document.querySelectorAll("button");

for (let i=0;i<buttons.length;i++) {
    buttons[i].addEventListener('click', () => {
        ipcRenderer.send('proxy_create_new_dot', i);
    });
};

let extra_link = document.querySelector("a#gallery_link");

extra_link.addEventListener('click', () => {
    shell.openExternal('http://www.graphviz.org/gallery/');
});