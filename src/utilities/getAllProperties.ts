type Property = {
	name: string;
	options?: string[];
};

const properties: Property[] = [
	{ name: "Controls" },
	{ name: "Monitors" },
	{ name: "QueriedProperty" },
	{ name: "AchieveCondition" },
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

export function getAllProperties (){
	return properties;
}