type Property = {
	name: string;
	options?: string[];
};

// type Flux = Record<string, string[]>;

const properties: Property[] = [
	{ name: "Name" },
	{ name: "Controls" },
	{ name: "Monitors" },
	{ name: "QueriedProperty" },
	{ name: "AchieveCondition" },
	// { 	name: "Runtime Annotation",
	// 	options: ["sequencial","parallel", "fallback"] 
	// },
	{ name: "Monitors" },
	{
		name: "Goal type",	
		options: ["Achieve", "Query","Perform"]
	},
	{
		name: "Group",
	},
	{
		name: "Divisible",
	},
	{
		name: "Location",
	},
	{
		name: "Params",
	},
	{ 
		name: "RobotNumber",
	},
];

// const flux = {
	// "Goal Types" : ["Achieve", "Query", "Perform"],
	// "Constraints" : ["Group", "Divisible"],
	// "Task Attributes": ["Location", "Params", "RobotNumber"],
	// "Teste": ["Goal Types", "Constraints"],
	// "Teste2": ["Teste", "Task Attributes"],

	// "Define Name" : [type: "input"],
	// "Define Goal Type" : [flows: [{targetFlow: "Define Achieve", value: "Achieve"}, {targetFlow: "Define Querry", value: "Query"}, {targetFlow: "Define Perform", value: "Perform"}]],
	// "Define Goal" : [flows: [{targetFlow: "Define Name"}, {targetFlow: "Define Goal Type"}]],
	// "Define Task" : ["Name"],
	// "Define Type" : {flows: [{targetFlow: "Define Goal", value: "Goal"}, {targetFlow: "Define Task", value: "Task"}]},
	// "Create Node" : {flows: ["Define Type"]},
// };

const flux = {
	"Define Type": {
		"childs": [
			{
				"Goal": {
					"goalType":{
						"childs":[
							{
								"achieve": {
									"achieveCondition": "textInput",
									"controls": "textInput",
									"monitors": "select(controlledVariables)"
								},
								"query":{
									
								},
								"perform": "null"
							}
						]
					},
					"name": "textInput"
				}
			}, 
			{
				"Task": {},
			}
		]
	},
};

export function getAllProperties (){
	return properties;
}

// export function getPropertyType(name: string){
// 	const property = properties.find(prop => prop.name === name);
// 	return property?.type;
// }

export function getFlux() {
	return flux;
}

function expand(key: string, symbolTable: {}) : string[] {
	if (symbolTable[key]) return symbolTable[key];

	const expanded: string[] = [];
	if (flux[key]) {
		for (const elem of flux[key]) {
			if (flux[elem]) {
				expanded.push(...expand(elem, symbolTable));
			} else {
				expanded.push(elem);
			}
		}
	}
	symbolTable[key] = expanded;
	return expanded;
}

export function parseFlux(){
	const symbolTable = {};

	for (const key in flux) {
		expand(key, symbolTable);
	}

	console.log(symbolTable);
	return symbolTable;
}