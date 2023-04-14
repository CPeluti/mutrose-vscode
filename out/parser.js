"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertDIOXML2GM = exports.convertGM2DIOXML = void 0;
const parser = require('xml-js');
const xml_elements_1 = require("./elements/xml_elements");
const fs = require('fs');
function convertJS2XML(obj, cmp = false) {
    let xml = parser.js2xml(obj, { compact: cmp });
    xml = xml.replaceAll('&gt;', '>');
    xml = xml.replaceAll('&lt;', '<');
    return xml;
}
function convertNode2DIO(nodeJson, parent) {
    //Goal format in draw.io
    let style;
    if (nodeJson.type === 'istar.Task') {
        style = xml_elements_1.default.task;
    }
    else {
        style = xml_elements_1.default.goal;
    }
    ;
    style.elements[0].attributes.parent = parent;
    style.elements[0].elements[0].attributes.x = nodeJson.x;
    style.elements[0].elements[0].attributes.y = nodeJson.y;
    nodeJson.parent = parent;
    //renaming text to label
    delete Object.assign(nodeJson, { label: nodeJson.text })['text'];
    //adding MR_ to every customProperties key
    Object.keys(nodeJson?.customProperties).forEach(key => {
        nodeJson['MR_' + key] = nodeJson.customProperties[key];
    });
    delete nodeJson['customProperties'];
    const newNode = { object: { "_attributes": { ...nodeJson }, "_text": parser.json2xml(style) } };
    let xml = convertJS2XML(newNode, true);
    return xml;
}
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
            ;
            return { ...acc, [key]: attributes[key] };
        }
        return { ...acc };
    }, {});
}
function convertActors2DIO(gm) {
    return gm.actors.reduce((acc, actor) => {
        const nodes = actor.nodes.map(node => {
            return convertNode2DIO(node, actor.id);
        });
        // Removing customProperties and substituting with MR_Properties
        const { customProperties: cp, ...newActor } = actor;
        const customProperties = Object.entries(cp).reduce((propAcc, [key, value]) => {
            if (key === 'text') {
                return { ...propAcc, label: value };
            }
            return { ...propAcc, ['MR_' + key]: value };
        }, {});
        const style = xml_elements_1.default.actor;
        return { nodes: [...acc.nodes, ...nodes], actors: [...acc.actors, { ...newActor, ...customProperties }] };
    }, { actors: [], nodes: [] });
}
function convertLinks2DIO(gm) {
    return gm.links.map(link => {
        let newLink;
        switch (link.type) {
            case 'istar.AndRefinementLink':
                newLink = xml_elements_1.default.andLink;
                break;
            case 'istar.OrRefinementLink':
                break;
        }
        const parent = gm.actors.find(actor => {
            return actor.nodes.find(node => node.id === link.source || node.id === link.target);
        });
        newLink.elements[0].attributes.parent = parent?.id;
        newLink.elements[0].attributes.id = link.id;
        newLink.elements[0].attributes.target = link.target;
        newLink.elements[0].attributes.source = link.source;
        newLink = convertJS2XML(newLink);
        return newLink;
    });
}
function convertGM2DIOXML(input) {
    const gm = JSON.parse(input);
    const res = convertActors2DIO(gm);
    const resLinks = convertLinks2DIO(gm);
    const actors = res.actors.map(actor => {
        const { nodes, ...newActor } = actor;
        const style = xml_elements_1.default.actor;
        return convertJS2XML({ object: { _attributes: { ...newActor }, _text: parser.json2xml({ ...style }) } }, true);
    });
    console.log(actors);
    let output = `<mxfile host="65bd71144e">\n<diagram id="JPszrsa7NkP3LcdA_txE" name="Página-1">\n<mxGraphModel dx="322" dy="417" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${gm.diagram.width}" pageHeight="${gm.diagram.height}" math="0" shadow="0">\n<root>\n<mxCell id="0"/>\n
    <mxCell id="1" parent="0"/>\n`;
    output += "\n" + actors.join('\n') + '\n' + res.nodes.join('\n') + '\n' + resLinks.join('\n') + '\n';
    output += '</root>\n</mxGraphModel>\n</diagram>\n</mxfile>';
    return output;
}
exports.convertGM2DIOXML = convertGM2DIOXML;
function convertDIOXML2GM(input) {
    let gm = parser.xml2js(input);
    gm = gm.elements[0].elements[0].elements[0];
    const size = [parseInt(gm.attributes.pageWidth), parseInt(gm.attributes.pageHeight)];
    const nodes = gm.elements[0].elements;
    const parsedGm = { actors: [], orphans: [], dependencies: [], links: [], display: [], diagram: { width: size[0], height: size[1] } };
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
            delete Object.assign(actor, { text: actor.label })['label'];
            parsedGm.actors.push(actor);
        }
        else if (type === 'istar.AndRefinementLink') {
            const attributes = node.attributes;
            const link = { type, id: attributes.id, source: attributes.source, target: attributes.target };
            parsedGm.links.push(link);
        }
    });
    return JSON.stringify(parsedGm);
}
exports.convertDIOXML2GM = convertDIOXML2GM;
//# sourceMappingURL=parser.js.map