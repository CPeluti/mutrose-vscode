import {z} from 'zod'
import {link, writeFileSync} from 'fs'
const nodeSchema = z.object({
	name: z.string(),
	type: z.enum(["action","task", "method"]),
	parent: z.coerce.number(),
	agents: z.string().array().catch([]),
	children: z.coerce.number().array().catch([])
})
const ihtnSchema = z.record(z.coerce.number(), nodeSchema)
type NodeType = z.infer<typeof nodeSchema>;
type IhtnType = z.infer<typeof ihtnSchema>;
export class Ihtn {
	ihtn: IhtnType = {}
	constructor(content:any){
		this.ihtn = ihtnSchema.parse(content);
	}
	convert(outputPath: string){
		const model = new piStarModel();
		let id = Object.keys(this.ihtn).length+2;
		Object.keys(this.ihtn).forEach((key)=>{
			const node: NodeType = this.ihtn[key];
			const type = (node.type == 'action'? 'Task' : (node.type == 'method' ? 'Goal' : 'Task'))
			model.addNode(
				parseInt(key)+1,
				node.name,
				type
			)
			node.children.forEach(childKey=>{
				model.addRefinement(id++,parseInt(key)+1,childKey+1, 'or')
			})
			node.agents.forEach(agentKey=>{
				const oldId = id
				model.addNode(id++, agentKey, 'Quality')
				model.addRefinement(id++,oldId,parseInt(key)+1, 'qualification')
			})
		})
		model.space();
		model.generate(outputPath, id++);
	}
}

export class piStarModel {
	nodes = []
	links = []
	constructor(){}
	addNode(id: number, text: string, type: "Task"|"Goal"|"Resource"|'Quality'){
		const istarType = `istar.${type}`
		this.nodes.push({
			id,
			text,
			type: istarType,
			x:1,
			y:1,
			customProperties:{
				Description:''
			}
		})
	}
	addRefinement(id:number, source:number, target: number, type: 'and'|'or'|'qualification'){
		let istarType
		switch(type){
			case 'and':
				istarType = 'istar.AndRefinementLink'
				break
			case 'or':
				istarType = 'istar.OrRefinementLink'
				break
			case 'qualification':
				istarType='istar.QualificationLink'
				break
		}
		this.links.push({
			id,
			type: istarType,
			source,
			target
		})
	}
	space(){}
	generate(name: string, id){
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
					nodes: this.nodes
				}
			],
			orphans: [],
			dependencies: [],
			links: this.links,
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
		}
		writeFileSync(name, JSON.stringify(output))
	}
}