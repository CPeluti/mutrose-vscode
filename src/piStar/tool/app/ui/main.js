/* eslint-disable*/

/*!
 * This is open-source. Which means that you can contribute to it, and help
 * make it better! Also, feel free to use, modify, redistribute, and so on.
 *
 * If you are going to edit the code, always work from the source-code available for download at
 * https://github.com/jhcp/pistar
 */

$(document).ready(function () {
    'use strict';

    istar.graph = istar.setup.setupModel();
    istar.paper = istar.setup.setupDiagram(istar.graph);
    istar.setupMetamodel(istar.metamodel);
    istar.vscode = acquireVsCodeApi();
    ui.setupUi();
    istar.graph.on('change', (cell, opt) => {
        const changedButDidntMove = !Object.keys(opt).includes('translateBy') && Object.keys(opt).length && 'attrs' in cell.changed && cell.finished && !istar.fileManager.loading;
        if (changedButDidntMove) {
            // console.log("coisa nova");
            istar.vscode.postMessage({
                type: 'change',
                payload: istar.fileManager.saveModel()
            })
            // --> ['attrs', 'body', 'fill'] 'was changed'
        }
    })

    istar.paper.on('cell:pointerup',(cell, opt)=>{
        istar.vscode.postMessage({
            type: 'change',
            payload: istar.fileManager.saveModel()
        }) 
    })

    istar.graph.on('add', (cell, opt) => {
        if(!istar.fileManager.loading){
            cell.promise.then(()=>{
                istar.vscode.postMessage({
                    type: 'change',
                    payload: istar.fileManager.saveModel()
                })
            })
        }
    })

    istar.graph.on('remove', (cell, opt) => {
        if(!istar.fileManager.loading){
            istar.vscode.postMessage({
                type: 'change',
                payload: istar.fileManager.saveModel()
            })
        }
    })
    //wait the ui finish loading before loading a model
    $(document).ready(function () {
        setTimeout(function () {
            // istar.fileManager.loadModel(istar.models.processModelParameter());
            // ui.selectPaper();//clear selection
            }, 5);
    });

    // ui.alert('Hi there, this is a beta version of the tool, currently under testing. Please send us your feedback at <a href="https://goo.gl/forms/SaJlelSfkTkp819t2">https://goo.gl/forms/SaJlelSfkTkp819t2</a>',
    //     'Beta version');
});

/*definition of globals to prevent undue JSHint warnings*/
/*globals istar:false, ui:false, console:false, $:false */