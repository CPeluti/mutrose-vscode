type Property = {
	name: string;
	options?: string[];
};

interface Flow {
  message: string;
  options: { label: string; next?: string }[];
  metadata?: Record<string, any>;
  onChange?: (input: string) => Promise<void> | void;
}

const properties: Property[] = [
	{ name: "Name" },
	{ name: "Controls" },
	{ name: "Monitors" },
	{ name: "QueriedProperty" },
	{ name: "AchieveCondition" },
	// { 	name: "Runtime Annotation",
	// 	options: ["sequencial","parallel", "fallback"] 
	// },
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

export const flow: Record<string, Flow> = {
	name: {
		message: "Define Name",
		options: [],
		metadata: {type: "input", goBackTo: "defineType"}
	},
	defineType: {
		message: "Define Type",
		options: [
			{ label: "Goal", next: "goalType" },
      { label: "Task", next: "taskAttributes" },
		],
		metadata: { initial: true, type: "option", requiresConfirmation: false },
	},
	goalType: {
		message: "Define Goal Type",
		options: [
			{ label: "Achieve", next: "achieve" },
      { label: "Query", next: "query" },
      { label: "Perform", next: "defineType" },
		],
		metadata: {type: "option"},
		// precisa desse onChange??
		onChange: async (input) => {
			if (input === "Perform") {
				// value === null
			}
		},
	},
	achieve: {
		message: "Define the attributes",
		options: [
			{ label: "Achieve Condition", next: "achieveCondition" },
      { label: "Controls", next: "controls" },
      { label: "Monitors", next: "monitors" },
		],
		metadata: {type: "option"}
	},
	achieveCondition: {
		message: "Define the achieve condition",
		options: [],
		metadata: {type: "input", goBackTo: "goalType"}
	},
	controls: {
		message: "Define the controls",
		options: [],
		metadata: {type: "input", goBackTo: "goalType"},
		onChange: async (input) => {
			// verify
		},
	},
	monitors: {
		message: "Define the monitors",
		options: [],
		metadata: {type: "input", goBackTo: "goalType"},
		onChange: async (input) => {
			// verify
		},
	},
	query: {
		message: "Define the attributes",
		options: [
			{ label: "Achieve Condition", next: "achieveCondition" },
		],
		metadata: {type: "option", goBackTo: "goalType"}
	},
	taskAttributes: {
		message: "Define the task attributes",
		options: [
			{ label: "Location", next: "location" },
      { label: "Params", next: "params" },
      { label: "Robot Numbers", next: "robotNumbers" },
		],
		metadata: {type: "option"}
	},
	location: {
		message: "Define the location",
		// definir opções de escolher variaveis, nome, tipo ou collection??
		options: [],
		metadata: {type: "input", goBackTo: "taskAttributes"},
		onChange: async (input) => {
			// verify
		},
	},
	params: {
		message: "Define the params",
		options: [],
		metadata: {type: "input", goBackTo: "taskAttributes"},
		onChange: async (input) => {
			// verify
		},
	},
	robotNumbers: {
		message: "Define the number of robots",
		// definir opções de escolher um número ou range??
		options: [],
		metadata: {type: "input", goBackTo: "taskAttributes"},
		onChange: async (input) => {
			// verify
		},
	}
};

// const flux = {
// 	"Define Type": {
// 		"childs": [
// 			{
// 				"Goal": {
// 					"goalType":{
// 						"childs":[
// 							{
// 								"achieve": {
// 									"achieveCondition": "textInput",
// 									"controls": "textInput",
// 									"monitors": "select(controlledVariables)"
// 								},
// 								"query":{
									
// 								},
// 								"perform": "null"
// 							}
// 						]
// 					},
// 					"name": "textInput"
// 				}
// 			}, 
// 			{
// 				"Task": {},
// 			}
// 		]
// 	},
// };

export function getAllProperties (){
	return properties;
}

// export function getPropertyType(name: string){
// 	const property = properties.find(prop => prop.name === name);
// 	return property?.type;
// }

// export function getFlow(): Record<string, Flow> {
// 	return flow;
// }

// function expand(key: string, symbolTable: {}) : string[] {
// 	if (symbolTable[key]) return symbolTable[key];

// 	const expanded: string[] = [];
// 	if (flux[key]) {
// 		for (const elem of flux[key]) {
// 			if (flux[elem]) {
// 				expanded.push(...expand(elem, symbolTable));
// 			} else {
// 				expanded.push(elem);
// 			}
// 		}
// 	}
// 	symbolTable[key] = expanded;
// 	return expanded;
// }

// export function parseFlux(){
// 	const symbolTable = {};

// 	for (const key in flux) {
// 		expand(key, symbolTable);
// 	}

// 	console.log(symbolTable);
// 	return symbolTable;
// }