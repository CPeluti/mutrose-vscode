interface Flow {
  message: string;
  options: { label: string; next?: string }[];
  metadata?: Record<string, any>;
  onChange?: (input: string) => Promise<void> | void;
}

export const flow: Record<string, Flow> = {
	// defineType: {
	// 	message: "Define Type",
	// 	options: [
	// 		{ label: "Goal", next: "goal" },
  //     { label: "Task", next: "task" },
	// 	],
	// 	metadata: { initial: true, type: "option", propertyName: "type", requiresConfirmation: true },
	// },
	goal: {
		message: "Define Goal",
		options: [
			{ label: "Name", next: "goalName" },
			{ label: "Goal Type", next: "goalType" },
		],
		metadata: {type: "option", propertyName: "istar.Goal"}
	},
	goalName: {
		message: "Define Goal Name",
		options: [],
		metadata: {type: "input", goTo: "goal", propertyName: "Name"},
	},
	goalType: {
		message: "Define Goal Type",
		options: [
			{ label: "Achieve", next: "achieve" },
      { label: "Query", next: "query" },
      { label: "Perform", next: "goalType" },
		],
		metadata: {type: "option", propertyName: "GoalType", requiresConfirmation: true },
	},
	achieve: {
		message: "Define the attributes",
		options: [
			{ label: "Achieve Condition", next: "achieveCondition" },
      { label: "Controls", next: "controls" },
      { label: "Monitors", next: "monitors" },
			{ label: "Group", next: "group" },
		],
		metadata: {type: "option"}
	},
	achieveCondition: {
		message: "Define the achieve condition",
		options: [],
		metadata: {type: "input", goTo: "achieve", propertyName: "AchieveCondition"},
	},
	controls: {
		message: "Define the controls",
		options: [],
		metadata: {type: "input", goTo: "achieve", propertyName: "Controls"},
		onChange: async (input) => {
			// verify
		},
	},
	monitors: {
		message: "Define the monitors",
		options: [],
		metadata: {type: "input", goTo: "achieve", propertyName: "Monitors"},
		onChange: async (input) => {
			// verify
		},
	},
	group: {
		message: "Define the group",
		options: [
			{ label: "True", next: "divisible" },
			{ label: "False", next: "achieve" },
		],
		metadata: {type: "boolean", propertyName: "Group"},
	},
	divisible: {
		message: "Define the divisible",
		options: [
			{ label: "True", next: "achieve" },
			{ label: "False", next: "achieve" },
		],
		metadata: {type: "boolean", propertyName: "Divisible"},
	},
	query: {
		message: "Define the attributes",
		options: [
			{ label: "Queried Property", next: "queriedProperty" },
		],
		metadata: {type: "option", goTo: "goalType"}
	},
	queriedProperty: {
		message: "Define the queried property",
		options: [],
		metadata: {type: "input", goTo: "goalType", propertyName: "QueriedProperty"},
	},
	task : {
		message: "Define Task",
		options: [
			{ label: "Name", next: "taskName" },
			{ label: "Task Attributes", next: "taskAttributes" },
		],
		metadata: {type: "option", propertyName: "istar.Task"}
	},
	taskName: {
		message: "Define Task Name",
		options: [],
		metadata: {type: "input", goTo: "task", propertyName: "Name"},
	},
	taskAttributes: {
		message: "Define the task attributes",
		options: [
			{ label: "Location", next: "location" },
      { label: "Params", next: "params" },
      { label: "Robot Numbers", next: "robotNumbers" },
		],
		metadata: {type: "option" }
	},
	location: {
		message: "Choose an option to define the location",
		options: [
			{ label: "Variables", next: "locationVariables" },
      { label: "Name", next: "locationName" },
      { label: "Type", next: "locationType" },
      { label: "Collection", next: "locationCollection" },
		],
		metadata: {type: "option" },
		onChange: async (input) => {
			// verify
		},
	},
	locationVariables: {
		message: "Choose the variables to define the location",
		options: [],
		metadata: {type: "input", goTo: "task", propertyName: "Location"},
		onChange: async (input) => {
			// verify
		},
	},
	locationName: {
		message: "Choose the name to define the location",
		options: [],
		metadata: {type: "input", goTo: "task", propertyName: "Location"},
		onChange: async (input) => {
			// verify
		},
	},
	locationType: {
		message: "Choose the type to define the location",
		options: [],
		metadata: {type: "input", goTo: "task", propertyName: "Location"},
		onChange: async (input) => {
			// verify
		},
	},
	locationCollection: {
		message: "Choose the collection to define the location",
		options: [],
		metadata: {type: "input", goTo: "task", propertyName: "Location"},
		onChange: async (input) => {
			// verify
		},
	},
	params: {
		message: "Define the params",
		options: [],
		metadata: {type: "input", goTo: "task", propertyName: "Params"},
		onChange: async (input) => {
			// verify
		},
	},
	robotNumbers: {
		message: "Define the number of robots",
		options: [
			{ label: "Number", next: "robotSingleNumber" },
			{ label: "Range", next: "robotNumRange" },
		],
		metadata: {type: "option" },
		onChange: async (input) => {
			// verify
		},
	},
	robotSingleNumber: {
		message: "Choose the range of number",
		options: [],
		metadata: {type: "input", goTo: "task", propertyName: "RobotNumber"},
		onChange: async (input) => {
			// verify
		},
	},
	robotNumRange: {
		message: "Choose the range of number",
		options: [],
		metadata: {type: "input", goTo: "task", propertyName: "RobotNumber"},
		onChange: async (input) => {
			// verify
		},
	},
};

export function subFlowToDeleteFunction(initialStep: string): Set<string>{
	const filteredFlow = {...flow};

	function findSubflowToDelete(key: string, visited: Set<string>) {
		if (visited.has(key) || !filteredFlow[key]) return;
		visited.add(key);

		const	nextSteps = filteredFlow[key].options.map(option => option.next) || [];
		nextSteps.forEach(step => findSubflowToDelete(step, visited));
	}

	const subFlowToDelete = new Set<string>();
	findSubflowToDelete(initialStep, subFlowToDelete);

	return subFlowToDelete;
}