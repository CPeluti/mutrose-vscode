import * as vscode from 'vscode';


export class PistarEditorProvider implements vscode.CustomTextEditorProvider {
	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		const provider = new PistarEditorProvider(context);
		const providerRegistration = vscode.window.registerCustomEditorProvider(PistarEditorProvider.viewType, provider);
		return providerRegistration;
	}

    changeByWrite = false;
    private static readonly viewType = 'mutrose.pistar';

    constructor(
		private readonly context: vscode.ExtensionContext
	) { }
    public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		// Setup initial content for the webview
		webviewPanel.webview.options = {
			enableScripts: true,
		};
		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

		function updateWebview() {
			webviewPanel.webview.postMessage({
				type: 'update',
				data: document.getText(),
			});
		}

		// Hook up event handlers so that we can synchronize the webview with the text document.
		//
		// The text document acts as our model, so we have to sync change in the document to our
		// editor and sync changes in the editor back to the document.
		// 
		// Remember that a single text document can also be shared between multiple custom
		// editors (this happens for example when you split a custom editor)

		const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
			if (e.document.uri.toString() === document.uri.toString() && !this.changeByWrite) {
				updateWebview();
			}
            if(this.changeByWrite){
                this.changeByWrite = false;
            }
		});

		// Make sure we get rid of the listener when our editor is closed.
		webviewPanel.onDidDispose(() => {
			changeDocumentSubscription.dispose();
		});

		// Receive message from the webview.
		webviewPanel.webview.onDidReceiveMessage(e => {
			switch (e.type) {
				case 'change':
					this.updateDocument(document, e.text).then(()=>{
                        this.changeByWrite=true;
                    });
					return;
			}
		}, undefined,);

		updateWebview();
	}

    private updateDocument(document: vscode.TextDocument, newDocument: JSON) {
		const json = this.getDocumentAsJson(document);

		return this.updateTextDocument(document, newDocument);
	}

    private updateTextDocument(document: vscode.TextDocument, json: any) {
		const edit = new vscode.WorkspaceEdit();

		// Just replace the entire document every time for this example extension.
		// A more complete extension should compute minimal edits instead.
		edit.replace(
			document.uri,
			new vscode.Range(0, 0, document.lineCount, 0),
			JSON.stringify(json, null, 2));
        const apply = vscode.workspace.applyEdit(edit);
        // this.changeByWrite=false;
		return apply;
	}

    private getDocumentAsJson(document: vscode.TextDocument): any {
		const text = document.getText();
		if (text.trim().length === 0) {
			return {};
		}

		try {
			return JSON.parse(text);
		} catch {
			throw new Error('Could not get document as json. Content is not valid json');
		}
	}

    private getHtmlForWebview(webview: vscode.Webview): string {
		const getUri = (path: string) => {
            return webview.asWebviewUri(vscode.Uri.joinPath(
                this.context.extensionUri,"src","piStar","tool",path
            ));
        };
        
		return `
			<!DOCTYPE html>
            <html lang="en">
                <head>
                    <style>
                        body{
                            padding: 0;
                        }
                    </style>
                    <meta charset="utf-8">
                    <meta http-equiv="X-UA-Compatible" content="IE=edge">
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <!-- The 3 meta tags above *must* come first in the head; any other head content must come *after* these tags -->
                    <title>piStar tool</title>
                    <meta name="description"
                        content="piStar is an online Goal Modeling tool, compliant with iStar 2.0. Useful for creating diagrams
                        for requirements documents.">
                    <meta name="author" content="João Pimentel">
                    <link rel="icon" href="app/ui/images/favicon.ico">

                    <!-- bootstrap styles -->
                    <link href="${getUri('app/ui/lib/bootstrap/bootstrap.min.css')}" rel="stylesheet">  <!-- Bootstrap core CSS -->
                    <!-- library-specific styles -->
                    <link href="${getUri('app/istarcore/lib/joint.min.css')}" rel="stylesheet"> <!-- joint js -->
                    <link href="${getUri('app/ui/lib/bootstrap3-editable/bootstrap-editable.css')}" rel="stylesheet"> <!-- x-editable -->
                    <!-- tool styles -->
                    <link href="${getUri('pistar.css')}" rel="stylesheet">
                </head>

                <body>
                <div id="tool">
                <div id="menu-bodies">
                    <div id="menu-file" class="menu-body hidden">
                        <div class="menu-group">
                            <div class="menu-line">
                                <a class="btn btn-default button-vertical" id="menu-button-new-model" title="Create a new model in the same window">
                                    <!--data-toggle="modal" data-target="#modal-new-model"-->
                                    <span class="glyphicon glyphicon-file" aria-hidden="true"></span><br>
                                    New Model
                                </a>

                                <a class="btn btn-default button-vertical" id="menu-button-save-model"
                                title="Save (download) the model to your computer">
                                    <span class="glyphicon glyphicon-floppy-save" aria-hidden="true"></span><br>
                                    Save Model
                                </a>

                                <a class="btn btn-default button-vertical" id="menu-button-load-model" data-toggle="modal" data-target="#modal-load-model"
                                title="Load a previously saved model">
                                    <span class="glyphicon glyphicon-floppy-open" aria-hidden="true"></span><br>
                                    Load Model
                                </a>

                            </div>
                        </div>
                        <div class="menu-group">
                            <div class="menu-line">

                                <a class="btn btn-default button-vertical" id="menu-button-save-image" title="Save (download) model as a SVG or PNG image file"
                                data-toggle="modal" data-target="#modal-save-image">
                                    <span class="glyphicon glyphicon-picture" aria-hidden="true"></span><br>
                                    Save Image
                                </a>

                            </div>
                        </div>
                    </div>
                    <div id="menu-add" class="menu-body">
                        <div class="menu-group">
                            <div class="menu-line">

                                <div class="add-dropdown-button dropdown">
                                    <button class="btn add-button btn-default dropdown-toggle" type="button" id="menu-dropdown-actors"
                                            data-toggle="dropdown" aria-haspopup="true" aria-expanded="true" title="Add some kind of Actor">
                                        <img src="${getUri('language/images/Actor.svg')}" height="25" alt=""/><br>
                                        Actor...
                                        <span class="caret"></span>
                                    </button>
                                    <ul id="add-actor-dropdown" class="dropdown-menu" aria-labelledby="menu-dropdown-actors"></ul>
                                </div>

                                <div class="add-dropdown-button dropdown">
                                    <button class="btn add-button btn-default dropdown-toggle" type="button" id="menu-dropdown-actor-links"
                                            data-toggle="dropdown" aria-haspopup="true" aria-expanded="true"
                                            title="Add links between actors">
                                        <img src="${getUri('language/images/IsALink.svg')}" height="25" alt=""/><br>
                                        Actor links...
                                        <span class="caret"></span>
                                    </button>
                                    <ul id="add-actor-link-dropdown" class="dropdown-menu" aria-labelledby="menu-dropdown-actor-links"></ul>
                                </div>

                                <div class="add-dropdown-button dropdown">
                                    <button class="btn add-button btn-default dropdown-toggle" type="button" id="menu-dropdown-dependency-links"
                                            data-toggle="dropdown" aria-haspopup="true" aria-expanded="true" title="Add dependency link">
                                        <img src="${getUri('language/images/DependencyLink.svg')}" height="25" alt=""/><br>
                                        Dependency...
                                        <span class="caret"></span>
                                    </button>
                                    <ul id="add-dependency-dropdown" class="dropdown-menu" aria-labelledby="menu-dropdown-dependency-links"></ul>
                                </div>
                            </div>
                        </div>

                        <div class="menu-group">
                            <div class="menu-line">
                                <span id="add-internal-cells-palette" class="add-button"></span>
                            </div>
                        </div>

                        <div class="line-break"></div>
                        <div id="status-bar">
                            <span id="status"></span>
                        </div>
                    </div>

                    <div id="menu-diagram" class="menu-body hidden">
                        <div class="menu-group">
                            <div class="title">Diagram Size</div>
                            <div class="menu-line">
                                Width:&nbsp; <input id="input-diagram-width" type="text" name="width" value="500" size="4" maxlength="6"
                                                    title="Set the diagram's width (in pixels)"> px
                            </div>
                            <div class="menu-line">
                                Height:&nbsp; <input id="input-diagram-height" type="text" name="height" value="1200" size="4" maxlength="6"
                                                    title="Set the diagram's height (in pixels)"> px
                            </div>
            <!--                <span class="menu-line"><a id="fit-to-content-button" class="btn btn-default btn-xs button-horizontal"><i class="glyphicon glyphicon-resize-small"></i> Fit to content</a></span> TODO issue due to negative origins-->
                        </div>
                        <!--<div class="menu-group">-->
                        <!--<span class="title">colors</span>-->
                        <!--<span class="menu-line">Actor boundary:-->
                        <!--<input id="all-actor-boundary-color-picker" onchange="console.log('change event');" class="jscolor {hash:true}" value="e6e6e6" size="8">-->
                        <!--</span>-->
                        <!--<span class="menu-line">Elements:-->
                        <!--<input id="all-elements-color-picker" class="jscolor {hash:true}" value="ccfacd" size="8">-->
                        <!--</span>-->
                        <!--<span class="menu-line">-->
                        <!--<a id="reset-all-colors-button" class="btn btn-default btn-xs button-horizontal"><i class="glyphicon glyphicon-erase"></i> Reset colors</a>-->
                        <!--</span>-->
                        <!--</div>-->
                        <!--<div class="menu-group">-->
                        <!--<span class="title">text</span>-->
                        <!--<span class="menu-line">Font size: <input type="number" name="fontsize" value="12" min="4" max="999"></span>-->
                        <!--<span class="menu-line"><a class="btn btn-default btn-xs" data-toggle="button"><i class="glyphicon glyphicon-italic"></i></a></span>-->
                        <!--</div>-->
                        <div class="menu-group">
                            <span class="menu-line">
                                <a id="menu-button-precise-links" class="btn btn-default btn-xs button-horizontal"
                                title="Remove gaps between links and elements; recommended to apply before saving an image. It may take some seconds">
                                <span class="glyphicon glyphicon-screenshot"></span> Pixel-perfect links
                                </a>
                                </span>
                            <span class="menu-line">
                                <a id="menu-button-auto-layout" class="btn btn-default btn-xs button-horizontal"
                                title="Automatically update the layout of the actors and their links">
                                <span class="glyphicon glyphicon-move"></span> Auto-layout
                                </a>
                                </span>
                            <span class="menu-line">
                                <a id="menu-button-straighten-links" class="btn btn-default btn-xs button-horizontal"
                                title="Straighten all links">
                                <span class="glyphicon glyphicon-minus"></span> Straighten all links
                                </a>
                            </span>
                        </div>

                        <div class="menu-group">
                            <span class="menu-line">
                                <a id="menu-button-toggle-fullscreen" class="btn btn-default btn-xs button-horizontal"
                                title="Fullscreen toggle">
                                <span class="glyphicon glyphicon-fullscreen"></span> Toggle fullscreen
                                </a>
                            </span>
                        </div>

                        <!--<div class="menu-group">-->
                            <!--<div class="title">View</div>-->
                            <!--<span class="menu-line">-->
                                <!--<a id="menu-button-toggle-dependencies-display" class="btn btn-default btn-xs button-horizontal"-->
                                <!--title="Toggle between partially hiding, completely hiding, or displaying dependencies">-->
                                <!--<span class="glyphicon glyphicon-eye-close"></span> Hide/show dependencies-->
                                <!--</a>-->
                            <!--</span>-->
                            <!--<span class="menu-line">-->
                                <!--<a id="menu-button-toggle-contributions-display" class="btn btn-default btn-xs button-horizontal"-->
                                <!--title="Toggle between partially hiding, completely hiding, or displaying contribution links">-->
                                <!--<span class="glyphicon glyphicon-eye-close"></span> Hide/show contribution links-->
                                <!--</a>-->
                            <!--</span>-->
                        <!--</div>-->
                    </div>
                    <div id="menu-help" class="menu-body hidden">
                        <div class="menu-group">
                            <div class="menu-line">

                                <a id="menu-button-examples" class="btn btn-default" data-toggle="modal" data-target="#modal-examples">Examples</a>
                                <a id="menu-button-quickhelp" class="btn btn-default" data-toggle="modal" data-target="#modal-instructions">Quick Guide</a>
                                <a id="menu-button-language-guide" class="btn btn-default" href="https://sites.google.com/site/istarlanguage/" target="_blank">
                                    iStar 2.0 Language Guide <span class="glyphicon glyphicon-new-window" aria-hidden="true"></span>
                                </a>
                                <a id="menu-button-research" class="btn btn-default" href="https://github.com/jhcp/piStar/blob/master/RESEARCH.md#research" target="_blank">
                                    Research <span class="glyphicon glyphicon-new-window" aria-hidden="true"></span>
                                </a>

                            </div>
                        </div>
                    </div>
                    <div id="menu-plugin" class="menu-body hidden">
                        <div id="appToolbar"></div> <!-- this div is DEPRECATED. Instead, add elements directly to #menu-plugin -->
                    </div>

                </div>

                    <div id="workspace">

                        <div id="out">
                            <div class="cell-selection" style="display: none;"></div>
                            <div id="resize-handle" style="display: none;"></div>
                            <div id="diagram">
                            </div>

                        </div>

                    </div>

                </div>



                <!-- backbone templates -->
                <script type="text/template" id="add-button-template">
                    <button type="button" class="btn btn-default add-button" id="add-<%- label %>" title="<%- tooltip %>">
                        <img
                                src="${getUri('language/images/')}<%- name %>.svg" height="25" alt="" onError="this.onerror=null;this.src=${getUri('language/images/')}<%- defaultButtonImage %>;"/>
                        <br><%- label %>
                    </button>
                </script>

                <script type="text/template" id="add-dropdown-button-template">
                    <div class="add-dropdown-button dropdown">
                        <button class="btn add-button btn-default dropdown-toggle" type="button" id="menu-dropdown-<%- name %>"
                                data-toggle="dropdown" aria-haspopup="true" aria-expanded="true"
                                title="<%- tooltip %>">
                            <img src="${getUri('language/images/')}<%- name %>.svg')}" height="25" alt="" onError="this.onerror=null;this.src=${getUri('language/images/')}<%- defaultButtonImage %>;"/><br>
                            <%- label %>...
                            <span class="caret"></span>
                        </button>
                        <ul id="add-<%- name %>-dropdown" class="dropdown-menu" aria-labelledby="menu-dropdown-<%- name %>"></ul>
                    </div>
                </script>

                <script type="text/template" id="add-dropdown-item-template">
                    <a id="d-add-<%- name %>" title="<%- tooltip %>" href="#">
                        <img id="d-add-<%- name %>-img" src="${getUri('language/images/')}<%- buttonImage %>.svg" height="35" alt=""
                            onError="this.onerror=null;this.src=${getUri('language/images/')}<%- defaultButtonImage %>;"/>
                        <%- label %>
                    </a>
                </script>


                <script type="text/template" id="property-template">
                    <tr>
                        <th scope="row" class="property-name"><%- propertyName %></th>
                        <td class="property-value">
                            <a href="#" id="current<%- propertyName %>" class="property-value" data-type="<%- dataType %>" data-pk="1"
                            data-name="<%- propertyName %>" data-title="Enter <%- propertyName %>"><%- propertyValue %></a>
                        </td>
                    </tr>
                </script>

                <div id="modals">

                    <div class="modal fade" id="modal-save-image" tabindex="-1" role="dialog" aria-labelledby="label-save-image-modal">
                        <div class="modal-dialog" role="document">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span
                                            aria-hidden="true">×</span></button>
                                    <h4 class="modal-title" id="label-save-image-modal">Save model as image</h4>
                                </div>
                                <div class="modal-body">
                                    <form id="modal-save-image-form" class="form-horizontal">
                                        <div class="form-group">
                                            <label for="input-filename" class="col-sm-2 control-label">File name: </label>
                                            <div class="col-sm-4">
                                                <input type="text" class="form-control" id="input-filename" value="goalDiagram" placeholder="goalDiagram">
                                            </div>
                                            <div class="col-sm-10">
                                                <div class="checkbox">
                                                    <label>
                                                        <input id="modal-input-precise-links" type="checkbox"> Pixel-perfect links (it may take some seconds longer)
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="form-group">
                                            <div class="col-sm-3">
                                                <select id="input-file-format" class="form-control" title="Select file format">
                                                    <option>SVG</option>
                                                    <option>PNG</option>
                                                </select>

                                            </div>
                                            <div id="save-png-options" class="col-sm-6 hidden">
                                                <div class="checkbox">
                                                    <label title="If you're having trouble downloading large models, try to uncheck this">
                                                        <input id="modal-input-hi-res" type="checkbox" checked> High resolution
                                                    </label>
                                                </div>
                                                <div class="checkbox">
                                                    <label title="Transparent background">
                                                        <input id="modal-input-transparent-background" type="checkbox" checked> Transparent background
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                    </form>
                                </div>
                                <div class="modal-footer">
                                    <button id="modal-button-save-image" type="button" class="btn btn-primary"
                                            data-save-text="Saving..." data-preparing-text="Preparing image... (please wait)">Save image
                                    </button>
                                    <button type="button" class="btn" data-dismiss="modal">Cancel</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="modal fade" id="modal-load-model" tabindex="-1" role="dialog" aria-labelledby="label-load-model-modal">
                        <div class="modal-dialog" role="document">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span
                                            aria-hidden="true">×</span></button>
                                    <h4 class="modal-title" id="label-load-model-modal">Load i* model from file</h4>
                                </div>
                                <div class="modal-body">
                                    <input type="file" id="input-file-to-load" name="file"/>
                                    <br>
                                </div>
                                <div class="modal-footer">
                                    <button id="modal-button-load-model" type="button" class="btn btn-primary" data-loading-text="Loading...">Load
                                        model
                                    </button>
                                    <button id="modal-button-close-load-model" type="button" class="btn" data-dismiss="modal">Close</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="modal fade" id="modal-examples" tabindex="-1" role="dialog" aria-labelledby="label-examples-modal">
                        <div class="modal-dialog" role="document">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span
                                            aria-hidden="true">×</span></button>
                                    <h4 class="modal-title" id="label-examples-modal">Load Examples</h4>
                                </div>
                                <div class="modal-body">
                                    <em>Loading may take a while, please wait a few seconds after clicking on an example below.</em><br><br>
                                    <div class="alert alert-danger" role="alert">WARNING! If you click on an example below,
                                        your current model will be erased. This action is irreversible.</div>
                                    <ul>
                                        <li>
                                            <a class="modal-button-load-example" href="#" data-model="everyElementAndLink">
                                                Example with every iStar 2.0 element and link, along with its definitions
                                            </a>
                                        </li>
                                        <li><a class="modal-button-load-example" href="#" data-model="travelReimbursement">University Travel Reimbursement (iStar 2.0 guide example)</a></li>
                                        <li><a class="modal-button-load-example" href="#" data-model="smartHome">Contextual Smart Home (105 elements)</a></li>
                                        <li><a class="modal-button-load-example" href="#" data-model="buyerDrivenECommerce">Buyer Driven e-Commerce</a></li>
                                    </ul>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn" data-dismiss="modal">Close</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="modal fade" id="modal-instructions" tabindex="-1" role="dialog" aria-labelledby="label-instructions-modal">
                        <div class="modal-dialog modal-lg" role="document">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span
                                            aria-hidden="true">×</span></button>
                                    <h3 class="modal-title" id="label-instructions-modal">A Quick Guide to the piStar Tool</h3>
                                </div>
                                <div class="modal-body">
                                    <h4>Visualization</h4>
                                    <ul>
                                        <li>Use the tool in fullscreen by clicking "Toggle fullscreen" within the <em>Options</em> menu.</li>
                                        <li>Remove the gaps between links and elements by clicking "Pixel-perfect links" within the
                                            <em>Options</em> menu (this operation takes some time).</li>
                                        <li>You can use your regular browser's zoom options to zoom in and out.</li>
                                    </ul>
                                    <h4>Change</h4>
                                    <ul>
                                        <li>To change the name of an element: double-click it.</li>
                                        <li>To collapse/expand an actor/role/agent: press <kbd>alt</kbd> and click it.</li>
                                        <li>To change the diagram size: use the <em>Options</em> menu.</li>
                                        <li>To change the label of a contribution link: select the link; on the
                                            <em>Properties panel</em>, click on the current value of the link; select a new value.</li>
                                        <li>To change the type of a dependency: select the dependum; on the
                                            <em>Properties panel</em>, click on the current type of the dependency; select a new type.</li>
                                        <li>To change the type of an actor: select the actor; on the
                                            <em>Properties panel</em>, click on the current type of the actor; select a new type.</li>
                                        <li>To change the direction of a dependency: select the dependum; on the
                                            <em>Properties panel</em>, click on "Flip direction".</li>
                                    </ul>
                                    <h4>Delete</h4>
                                    <ul>
                                        <li>To delete an element: click on the element, then press the <kbd>delete</kbd> key.</li>
                                        <li>To delete a dependency: click on its dependum, then press the <kbd>delete</kbd> key.</li>
                                        <li>To delete a link: click over the link, then press the <kbd>delete</kbd> key.</li>
                                        <li>To delete a vertex in a link: double-click the vertex.</li>
                                    </ul>
                                    <h4>Add</h4>
                                    <ul>
                                        <li>To add a property to an element or link: click on the element or link, then click on the <em>Add Property</em> button in
                                            the sidepanel.
                                        </li>
                                        <li>To add an actor/role/agent in the diagram: click on the ACTOR... button, select the respective option,
                                            and then click on the diagram.
                                        </li>
                                        <li>To add a goal/task/resource/quality in the diagram: click on the respective button and then click on the
                                            actor that will contain the element. (OBS: all elements must be inside an actor/role/agent)
                                        </li>
                                        <li>To add a refinement/qualification/needed-by link: click on the respective link button, then click on the
                                            source element, and lastly click on the target element.
                                        </li>
                                        <li>To add a contribution link: click on the CONTRIBUTION... button, select the respective label, then click
                                            on the source element, and lastly click on the target element.
                                        </li>
                                        <li>To add a dependency link: click on the DEPENDENCY... button, select the respective dependency type, then
                                            click on the source element (in the depender), and lastly click on the target element (on the dependee).
                                        </li>
                                        <li>To add an is-a/participates-in link: click on the ACTOR LINKS... button, select the respective option,
                                            then click on the source, and lastly click on the target.
                                        </li>
                                    </ul>

                                    <em>piStar tool version 2.1.0</em><br>
                                    For more info on this project, please visit the <a href="https://github.com/jhcp/piStar/" target="_blank">
                                    piStar repository <span class="glyphicon glyphicon-new-window" aria-hidden="true"></span></a>.

                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn" data-dismiss="modal">Close</button>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>


                <!-- dependencies -->
                <script src="${getUri('app/istarcore/lib/jquery.min.js')}"></script>
                <script src="${getUri('app/istarcore/lib/lodash.min.js')}"></script>
                <script src="${getUri('app/istarcore/lib/backbone-min.js')}"></script>
                <script src="${getUri('app/istarcore/lib/joint.min.js')}"></script>

                <script src="${getUri('app/ui/lib/jscolor/jscolor.min.js')}"></script>
                <script src="${getUri('app/ui/lib/bootstrap/bootstrap.min.js')}"></script>
                <script src="${getUri('app/ui/lib/bootstrap3-editable/bootstrap-editable.min.js')}"></script>
                <script src="${getUri('app/ui/lib/bootbox/bootbox.min.js')}"></script>

                <!-- istar core -->
                <script src="${getUri('app/istarcore/istarFunctions.js')}"></script>
                <script src="${getUri('app/istarcore/metamodelManager.js')}"></script>
                <script src="${getUri('app/istarcore/fileManager.js')}"></script>
                <script src="${getUri('app/istarcore/defaultShapes.js')}"></script>
                <script src="${getUri('app/istarcore/undoManager.js')}"></script>
                <script src="${getUri('app/ui/ui.js')}"></script>
                <script src="${getUri('app/ui/models/addButton.js')}"></script>
                <script src="${getUri('app/ui/views/addButton.js')}"></script>
                <script src="${getUri('app/ui/views/addButtonDropdown.js')}"></script>
                <script src="${getUri('app/ui/views/addButtonDropdownItem.js')}"></script>
                <script src="${getUri('app/ui/controllers/addButton.js')}"></script>
                <script src="${getUri('app/ui/views/propertiesTable.js')}"></script>
                <script src="${getUri('app/ui/istarmodels.js')}"></script>

                <!-- auto-layout -->
                <script src="${getUri('app/layout/lib/d3-collection.v1.min.js')}"></script>
                <script src="${getUri('app/layout/lib/d3-dispatch.v1.min.js')}"></script>
                <script src="${getUri('app/layout/lib/d3-quadtree.v1.min.js')}"></script>
                <script src="${getUri('app/layout/lib/d3-timer.v1.min.js')}"></script>
                <script src="${getUri('app/layout/lib/d3-force.v1.min.js')}"></script>
                <script src="${getUri('app/layout/layout.js')}"></script>

                <!-- language specific -->
                <script src="${getUri('language/shapes.js')}"></script>
                <script src="${getUri('language/metamodel.js')}"></script>
                <script src="${getUri('language/constraints.js')}"></script>
                <script src="${getUri('language/ui.metamodel.js')}"></script>

                <!-- insert your plugin(s) here, after this line -->

                <!-- end of plugin(s) area -->

                <script src="${getUri('app/ui/main.js')}"></script>
                <script>
                    window.addEventListener('message', event => {
                        const message = event.data; // The JSON data our extension sent
                        switch (message.type) {
                            case 'update':
                                istar.fileManager.loadModel(message.data)
                                break;
                        }
                    });
                </script>
                </body>
            </html>
            `;
	}
}