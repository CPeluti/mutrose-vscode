import { Actor, Node, Link, GoalModel, Diagram, Display } from './GoalModel/index';

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
                {attributes[key] = parseInt(attributes[key]);}
            return {...acc, [key]: attributes[key]};
        }
        return {...acc};
    }, {});
}

type ParsedActor = Omit<Actor, "customProperties"> & Record<`MR_${string}`, string>;


//set text on mission
export function convertJSON2JS(input: string):GoalModel{
    let gm = JSON.parse(input);
    gm = gm.elements[0].elements[0].elements[0];
    const size = [parseInt(gm.attributes.pageWidth), parseInt(gm.attributes.pageHeight)];
    const nodes = gm.elements[0].elements;
    const parsedGm: GoalModel = {
        actors: [],
        orphans:[],
        dependencies:[],
        links:[],
        display: [] as unknown as Display,
        diagram: {width:size[0], height: size[1]} as Diagram,
        tool: '',
        istar: '',
        saveDate: new Date()
    };
    
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
            delete Object.assign(actor, { text: actor.text })['label'];
            parsedGm.actors.push(actor);
        } else if (type === 'istar.AndRefinementLink') {
            const attributes = node.attributes;
            const link = {type, id: attributes.id, source: attributes.source, target: attributes.target};
            parsedGm.links.push(link);
        }
    });
    return parsedGm;
}
