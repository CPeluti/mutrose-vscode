"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertJSON2JS = void 0;
function getMRAttributes(attributes) {
    return Object.keys(attributes).reduce((acc, key) => {
        if (key.startsWith('MR_')) {
            return { ...acc, [key.substring(3)]: attributes[key] };
        }
        return { ...acc };
    }, {});
}
function getNonMRAttributes(attributes) {
    return Object.keys(attributes).reduce((acc, key) => {
        if (!(key.startsWith('MR_'))) {
            if (key === "x" || key === "y") {
                attributes[key] = parseInt(attributes[key]);
            }
            return { ...acc, [key]: attributes[key] };
        }
        return { ...acc };
    }, {});
}
//set text on mission
function convertJSON2JS(input) {
    let gm = JSON.parse(input);
    gm = gm.elements[0].elements[0].elements[0];
    const size = [parseInt(gm.attributes.pageWidth), parseInt(gm.attributes.pageHeight)];
    const nodes = gm.elements[0].elements;
    const parsedGm = {
        actors: [],
        orphans: [],
        dependencies: [],
        links: [],
        display: [],
        diagram: { width: size[0], height: size[1] },
        tool: '',
        istar: '',
        saveDate: new Date()
    };
    nodes.forEach((node) => {
        const type = node.attributes.type;
        if (['istar.Goal', 'istar.Task'].includes(type)) {
            const customProperties = getMRAttributes(node.attributes);
            const attributes = getNonMRAttributes(node.attributes);
            const gmNode = { ...attributes, customProperties };
            delete Object.assign(gmNode, { text: gmNode.label })['label'];
            parsedGm.actors.filter((actor) => actor.id === gmNode.parent)[0].nodes.push(gmNode);
        }
        else if (type === 'istar.Actor') {
            const customProperties = getMRAttributes(node.attributes);
            const attributes = getNonMRAttributes(node.attributes);
            const actor = { ...attributes, customProperties, nodes: [] };
            delete Object.assign(actor, { text: actor.text })['label'];
            parsedGm.actors.push(actor);
        }
        else if (type === 'istar.AndRefinementLink') {
            const attributes = node.attributes;
            const link = { type, id: attributes.id, source: attributes.source, target: attributes.target };
            parsedGm.links.push(link);
        }
    });
    return parsedGm;
}
exports.convertJSON2JS = convertJSON2JS;
//# sourceMappingURL=parser.js.map