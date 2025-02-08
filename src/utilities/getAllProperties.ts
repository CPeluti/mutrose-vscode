type Property = {
	name: string;
	isValid?: (input: string) => boolean;
};

type Flux = {
	[key: string] : string[]
}

const properties: Property[] = [
	{ name: "Controls" },
	{ name: "Monitors" },
	{
	//name: "Goal types",
		name: "Achieve" ,
	},
	{
		name: "Query",
	},
	{
		name: "Perform",
	},
	{ name: "OCL expressions" },
	// name: "Constraints",
	{
		name: "Group",
		isValid: (input: string) => {
			return input === "true" || input === "false";
		}
	},
	{
		name: "Divisible",
		isValid: (input: string) => {
			return input === "true" || input === "false";
		}
	},
	// name: "Task attributes",
	{
		name: "Location",
	},
	{
		name: "Params",
		isValid: (input: string) => {
			return Array.isArray(input) && input.every(item => typeof item === 'string');
		}
	},
	{ 
		name: "RobotNumber",
		isValid : (input: string) => {
			return !isNaN(parseInt(input)) || (Array.isArray(input) && input.length === 2 && input.every(item => typeof item === 'number'));
		}
	},
];

const flux: Flux = {
	"Goal Types" : ["Achieve", "Query", "Perform"],
	"Constraints" : ["Group", "Divisible"],
	"Task Attributes": ["Location", "Params", "RobotNumber"],
	"Teste": ["Goal Types", "Constraints"]
};

export function getAllProperties (){
	return properties;
}

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