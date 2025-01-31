type Property = {
	name: string;
	options?: Property[];
	isValid?: (input: string) => boolean;
};

const properties: Property[] = [
	{ name: "Controls" },
	{ name: "Monitors" },
	{
		name: "Goal types",
		options: [
			{ name: "Achieve" },
			{ name: "Query" },
			{ name: "Perform" },
		],
	},
	{ name: "OCL expressions" },
	{
		name: "Constraints",
		options: [
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
		],
	},
	{
		name: "Task attributes",
		options: [
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
		],
	},
];

export function getAllProperties (){
	return properties;
}