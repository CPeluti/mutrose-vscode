import {z} from 'zod';
import {link, writeFileSync} from 'fs';
type Node = {
	id:number,
	text:string,
	type: string,
	x:number,
	y:number,
	customProperties:{
		Description:string
	}
}

const nodeSchema = z.object({
	name: z.string(),
	type: z.enum(["action","task", "method"]),
	parent: z.coerce.number(),
	agents: z.string().array().catch([]),
	agentId: z.number().optional(),
	children: z.coerce.number().array().catch([])
});
const ihtnSchema = z.record(z.coerce.number(), nodeSchema);
type NodeType = z.infer<typeof nodeSchema>;
type IhtnType = z.infer<typeof ihtnSchema>;
export class Ihtn {
	ihtn: IhtnType = {};
	constructor(content:any){
		this.ihtn = ihtnSchema.parse(content);
	}
	convert(){
		const model = new piStarModel();
		let id = Object.keys(this.ihtn).length+2;
		Object.keys(this.ihtn).forEach((key)=>{
			const node: NodeType = this.ihtn[key];
			const type = (node.type == 'action'? 'Task' : (node.type == 'method' ? 'Task' : 'Task'));
			model.addNode(
				parseInt(key),
				node.name,
				type
			);
			node.children.forEach(childKey=>{
				model.addRefinement(id++,parseInt(key),childKey, 'or');
			});
			const agents = node.agents.join(",");
			const oldId = id;
			node.agentId = id;
			model.addNode(id++, agents, 'Resource');
			model.addRefinement(id++,oldId,parseInt(key), 'needed');
		});
		const order = [];
		Object.keys(this.ihtn).forEach((el)=>{
			order[el] = this.ihtn[el].children.length? this.ihtn[el].children.map(element=>{return{key:element, type:'node', childrenCount:this.ihtn[element].children.length};}) : [];
			order[el] = [{key:this.ihtn[el].agentId, type: 'agent', parent: el}, ...order[el]];
		});
		Object.keys(order).forEach(el=>{
			order[el] = {
				name: this.ihtn[el]?.name,
				items: order[el]
			};
			// order[el].forEach(element => {
			// 	if(element.type != 'agent'){
			// 		element.name = this.ihtn[element.key-1]?.name;
			// 	}
			// });
		});
		model.space(order, 150, 200, 150, 50);
		return model.generate(id++);
	}
}

export class piStarModel {
	nodes: Node[] = [];
	links = [];
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	constructor(){}
	addNode(id: number, text: string, type: "Task"|"Goal"|"Resource"|'Quality'){
		const istarType = `istar.${type}`;
		this.nodes.push({
			id,
			text,
			type: istarType,
			x:1,
			y:1,
			customProperties:{
				Description:''
			}
		});
	}
	addRefinement(id:number, source:number, target: number, type: 'and'|'or'|'needed'){
		let istarType;
		switch(type){
			case 'and':
				istarType = 'istar.AndRefinementLink';
				break;
			case 'or':
				istarType = 'istar.OrRefinementLink';
				break;
			case 'needed':
				istarType='istar.NeededByLink';
				break;
		}
		this.links.push({
			id,
			type: istarType,
			source,
			target
		});
	}
	space(order:Record<number,{ name:string, items: Array<{key:number,  type: 'node' | 'agent', name:string, parent?: string, childrenCount?:number}>}>,offsetX: number, offsetY: number, startingPosX: number, startingPosY: number){
		//set Root
		const root = 0;
		//calculate max size & max depth
		const iter:Array<{key:number,  type: 'node' | 'agent', name:string, parent?: string, childrenCount?:number}>[] = [[{
			name:'ROOT',
			key: 0,
			type: "node",
			parent: "-1",
			childrenCount: 1
		}]];
		let depth = 0;
		let maxSize = iter[depth].reduce(
			(acc, current)=>acc+(current.type=='node'?1:0)
			,0
		);
		while(iter[depth].length){
			let newIter = [];
			iter[depth].forEach(el=>{
				if(el.type != "agent"){
					newIter = [...newIter, ...order[el.key].items];
				}
			});
			if(newIter.length){
				iter.push(newIter);
				depth++;
			} else {
				break;
			}
			maxSize = Math.max(
				iter[depth].reduce(
					(acc, current)=>acc+(current.type=='node'?1:0)
					,0
				), 
				maxSize
			);
		}
		for(let i = depth; i >=0; i--){
			let AgentCount = 0;
			iter[i].forEach((el, index)=>{
				if(el.type!='agent'){
					const node = this.nodes.find(n=>el.key == n.id);
					node.y = startingPosY+Math.max(i* offsetY,1);
					node.x = startingPosX+Math.max((index - AgentCount)*offsetX,1);
				}else {
					AgentCount++;
				}
			});
		}

		for(let i = depth; i >=0; i--){
			iter[i].forEach((el, index)=>{
				if(el.type!='agent' && el.childrenCount > 0){
					const node = this.nodes.find(n=>el.key == n.id);
					const childs = order[el.key].items.filter(el=>el.type!='agent');
					const pivot = childs[Math.floor(childs.length/2)-(childs.length%2?0:1)];
					const nextToPivot = childs[Math.floor(childs.length/2)];
					const nodePivot = this.nodes.find(n=>pivot.key == n.id);
					const nextToPivotNode = this.nodes.find(n=>nextToPivot.key == n.id);
					const newPos = childs.length%2? nodePivot.x : ((nodePivot.x+nextToPivotNode.x)/2);
					node.x = newPos;

				}
			});
		}

		for(let i = depth; i >=0; i--){
			iter[i].forEach((el, index)=>{
				if(el.type=='agent'){
					const node = this.nodes.find(n=>el.key == n.id);
					const parent = this.nodes.find(n=>parseInt(el.parent) == n.id);
					node.x = parent.x-(offsetX/1.2);
					node.y = parent.y + (offsetY/3);
				}
			});
		}

	}
	generate(id){
		const output = {
			actors: [
				{
					id: "34dadeac-cc9c-466c-9752-5bd519d8e53c",
					text: "ihtn",
					type: "istar.Actor",
					x: 1,
					y: 1,
					customProperties: {
						Description: ""
					},
					nodes: this.nodes.map(el=>{
						el.id = el.id+1;
						return el;
					})
				}
			],
			orphans: [],
			dependencies: [],
			links: this.links.map(link=>{
				link.target = link.target+1;
				link.source = link.source+1;
				return link;
			}),
			tool: "pistar.2.1.0",
			istar: "2.0",
			saveDate: "Thu, 13 Feb 2025 16:31:31 GMT",
			diagram: {
				width: 2000,
				height: 1300,
				name: "Welcome Model",
				customProperties: {
					Description: "Welcome to the piStar tool! This model describe some of the recent improvements in the tool.\n\nFor help using this tool, please check the Help menu above"
				}
			}
		};
		return JSON.stringify(output);
	}
}