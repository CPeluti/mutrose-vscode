const parser = require('xml-js');
import { Actor, Node } from './GoalModel';
import gmDIOElements from './elements/xml_elements';
const fs = require('fs');
function convertJS2XML(obj: { object: { _attributes: any; _text: any; } | { _attributes: any; _text: any; }; }, cmp=false){
    let xml: string = parser.js2xml(obj, {compact: cmp});
    xml = xml.replaceAll('&gt;', '>');
    xml = xml.replaceAll('&lt;', '<');
    return xml;
}
function convertNode2DIO(nodeJson: any, parent: any){
    //Goal format in draw.io
    let style;
    if(nodeJson.type === 'istar.Task'){
        style = gmDIOElements.task;
    }
    else {
        style = gmDIOElements.goal;
    };
    style.elements[0].attributes.parent = parent;
    style.elements[0].elements[0].attributes.x = nodeJson.x;
    style.elements[0].elements[0].attributes.y = nodeJson.y;
    nodeJson.parent = parent;
    delete Object.assign(nodeJson, { label: nodeJson.text })['text'];
    Object.keys(nodeJson?.customProperties).forEach(key=>{
        nodeJson['MR_'+key]=nodeJson.customProperties[key];
    });
    delete nodeJson['customProperties'];
    const newNode = {object: {"_attributes":{...nodeJson}, "_text": parser.json2xml(style)}};
    let xml = convertJS2XML(newNode, true);
    return xml;
}
function getMRAttributes(attributes: Record<string,string>){
    return Object.keys(attributes).reduce((acc, key)=>{
        if(key.startsWith('MR_')){
            return {...acc, [key.substring(3)]: attributes[key]};
        }
        return {...acc};
    }, {} as Record<`MR_${string}`, string>);
}
function getNonMRAttributes(attributes: { [x: string]: any; }){
    return Object.keys(attributes).reduce((acc, key)=>{
        if(!(key.startsWith('MR_'))){
            if(key === "x" || key === "y")
                {attributes[key] = parseInt(attributes[key]);};
            return {...acc, [key]: attributes[key]};
        }
        return {...acc};
    }, {});
}

type ParsedActor = Omit<Actor, "customProperties"> & Record<`MR_${string}`, string>;

function convertActors2DIO(gm: { actors: Actor[]; }){
    return gm.actors.reduce((acc,actor)=>{
        
        const nodes = actor.nodes.map(node=>{
           return convertNode2DIO(node, actor.id);
        });

        // Removing customProperties and substituting with MR_Properties
        const {customProperties: cp, ...newActor} = actor;

        const customProperties = Object.entries(cp).reduce((propAcc, [key, value]) => {
            if(key === 'text'){
                return {...propAcc, label: value};
            }
            return {...propAcc, ['MR_'+key]: value};
        }, {} as Record<`MR_${string}`, string>);
        
        return {nodes: [...acc.nodes, ...nodes], actors: [...acc.actors, {...newActor, ...customProperties}]};
    
    },{actors: [], nodes: []} as {actors: ParsedActor[], nodes: string[]});
}

function convertLinks2DIO(gm: { links: any[]; actors: any[]; }){
    const links: any[] = [];
    gm.links.forEach((link: { type: string; source: any; target: any; id: any; })=>{
        let newLink;
        if(link.type === 'istar.AndRefinementLink')
            {newLink = gmDIOElements.andLink;};
        const res = gm.actors.filter((actor: { nodes: any[]; })=>{
            return actor.nodes.find((node: { id: any; })=> (link.source === node.id||link.target === node.id));
        })[0].id;
        newLink.elements[0].attributes.parent = res;
        newLink.elements[0].attributes.id = link.id;
        newLink.elements[0].attributes.target = link.target;
        newLink.elements[0].attributes.source = link.source;
        newLink = convertJS2XML(newLink);
        links.push(newLink);
    });
    return links;
}
export function convertGM2DIOXML(input: string){
    
    const gm = JSON.parse(input);
    const res = convertActors2DIO(gm);
    const resLinks = convertLinks2DIO(gm);
    
    let output = `<mxfile host="65bd71144e">\n<diagram id="JPszrsa7NkP3LcdA_txE" name="Página-1">\n<mxGraphModel dx="322" dy="417" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${gm.diagram.width}" pageHeight="${gm.diagram.height}" math="0" shadow="0">\n<root>\n<mxCell id="0"/>\n
    <mxCell id="1" parent="0"/>\n`; 
    output+=res.actors;
    output += "\n" + res.nodes.join('\n')+'\n'+resLinks.join('\n')+'\n';
    output += '</root>\n</mxGraphModel>\n</diagram>\n</mxfile>';
    return output;
}
export function convertDIOXML2GM(input: string){
    let gm = parser.xml2js(input);
    gm = gm.elements[0].elements[0].elements[0];
    const size = [parseInt(gm.attributes.pageWidth), parseInt(gm.attributes.pageHeight)];
    const nodes = gm.elements[0].elements;
    const parsedGm: any = {actors: [], orphans:[], dependencies:[], links:[], display: [], diagram: {width:size[0], height: size[1]}};
    nodes.forEach((node: any)=>{
        const type = node.attributes.type;
        if(['istar.Goal','istar.Task'].includes(type)){
            const customProperties = getMRAttributes(node.attributes);
            const attributes = getNonMRAttributes(node.attributes);
            const gmNode: any = {...attributes, customProperties};
            delete Object.assign(gmNode, { text: gmNode.label })['label'];
            parsedGm.actors.filter((actor:any)=>actor.id === gmNode.parent)[0].nodes.push(gmNode);
        } else if (type === 'istar.Actor') {
            const customProperties = getMRAttributes(node.attributes);
            const attributes = getNonMRAttributes(node.attributes);
            const actor: any = {...attributes, customProperties, nodes: []};
            delete Object.assign(actor, { text: actor.label })['label'];
            parsedGm.actors.push(actor);
        } else if (type === 'istar.AndRefinementLink') {
            const attributes = node.attributes;
            const link = {type, id: attributes.id, source: attributes.source, target: attributes.target};
            parsedGm.links.push(link);
        }
    });
    return JSON.stringify(parsedGm);
}
